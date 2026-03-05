import os
import yaml
import json
import csv
from datetime import datetime

import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader, random_split, Subset
from tqdm import tqdm
import sys

# --- CONFIGURATION SETUP ---
current_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(current_dir, "../../configs/image/benchmark_config.yaml")

if not os.path.exists(config_path):
    print(f"❌ Error: Config file not found at {config_path}")
    sys.exit(1)

with open(config_path, "r") as f:
    config = yaml.safe_load(f)

# Define Output Paths
CHECKPOINT_DIR = config['training']['output_paths']['checkpoints']
os.makedirs(CHECKPOINT_DIR, exist_ok=True)

# --- LOGGING SETUP (ADDED) ---
LOG_DIR = config['training']['output_paths'].get('logs', 'outputs/logs')
os.makedirs(LOG_DIR, exist_ok=True)
run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_CSV_PATH = os.path.join(LOG_DIR, f"{config.get('experiment_name','CNN')}_shufflenetv2_{run_id}.csv")

# Set Device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"✅ Device: {device}")

# --- CUSTOM UTILS FOR ROBUSTNESS (MATCHING MOBILENET) ---
class AddGaussianNoise(object):
    """
    Adds Gaussian Noise to simulate low-quality sensor grain.
    Matches MobileNet severity (std=0.1).
    """
    def __init__(self, mean=0., std=0.1):
        self.std = std
        self.mean = mean
        
    def __call__(self, tensor):
        return tensor + torch.randn(tensor.size()) * self.std + self.mean

# --- CUSTOM DATASET CLASS ---
class MalariaCombinedDataset(datasets.ImageFolder):
    def __getitem__(self, index):
        path, target = self.samples[index]
        sample = self.loader(path)
        if self.transform is not None:
            sample = self.transform(sample)
        
        original_class_name = self.classes[target]
        
        # Dynamic Mapping
        if "Uninfected" in original_class_name:
            new_target = 0
        elif "Infected" in original_class_name:
            new_target = 1
        else:
            raise ValueError(f"Unknown class type: '{original_class_name}'.")
            
        return sample, new_target

# --- ROBUST DATA TRANSFORMS ---
aug_cfg = config['data']['augmentation']
img_size = config['data']['image_size']

print(f"🔧 Configuring HIGH SEVERITY Pipeline (ShuffleNet):")
print(f"   - Blur Prob: {aug_cfg['gaussian_blur_prob']} (Kernel: {aug_cfg['gaussian_blur_kernel']})")
print(f"   - Jitter: {aug_cfg['color_jitter']}")
print(f"   - Noise Level: High (std=0.1)")

data_transforms = {
    'train': transforms.Compose([
        transforms.Resize((img_size, img_size)),
        
        # 1. Geometric
        transforms.RandomHorizontalFlip(p=aug_cfg['horizontal_flip_prob']),
        transforms.RandomVerticalFlip(p=aug_cfg['vertical_flip_prob']),
        transforms.RandomRotation(aug_cfg['rotation_degrees']),
        
        # 2. Photometric
        transforms.ColorJitter(
            brightness=aug_cfg['color_jitter'], 
            contrast=aug_cfg['color_jitter'],
            saturation=aug_cfg['color_jitter'],
            hue=0.05
        ),
        
        # 3. Quality Degradation (Blur)
        transforms.RandomApply([
            transforms.GaussianBlur(kernel_size=aug_cfg['gaussian_blur_kernel'], sigma=(0.1, 2.0))
        ], p=aug_cfg['gaussian_blur_prob']),

        transforms.ToTensor(),
        
        # 4. Sensor Noise (High Severity)
        transforms.RandomApply([AddGaussianNoise(0., 0.1)], p=0.5), 

        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ]),
    
    'eval': transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ]),
}

# --- LOAD AND SPLIT DATA ---
print("\n📂 Loading Data...")
base_data_dir = config['data']['image_dir']
combined_data_path = os.path.join(base_data_dir, "Combined_Data")
data_dir = combined_data_path if os.path.exists(combined_data_path) else base_data_dir

full_dataset = MalariaCombinedDataset(data_dir, transform=data_transforms['eval'])
total_size = len(full_dataset)

train_size = int(0.70 * total_size)
val_size = int(0.15 * total_size)
test_size = total_size - train_size - val_size

# FIXED SEED 42 ENSURES IDENTICAL SPLIT TO MOBILENET
generator = torch.Generator().manual_seed(config['random_seed'])
train_dataset, val_dataset, test_dataset = random_split(
    full_dataset, [train_size, val_size, test_size], generator=generator
)

# --- INDEPENDENT DATASET COPIES ---
train_indices = train_dataset.indices
val_indices = val_dataset.indices
test_indices = test_dataset.indices

train_base = MalariaCombinedDataset(data_dir, transform=data_transforms['train'])
eval_base = MalariaCombinedDataset(data_dir, transform=data_transforms['eval'])

train_subset = Subset(train_base, train_indices)
val_subset = Subset(eval_base, val_indices)
test_subset = Subset(eval_base, test_indices)

# --- DATALOADERS ---
dataloaders = {
    'train': DataLoader(train_subset, batch_size=config['data']['batch_size'], shuffle=True, num_workers=config['data']['num_workers']),
    'val': DataLoader(val_subset, batch_size=config['data']['batch_size'], shuffle=False, num_workers=config['data']['num_workers']),
    'test': DataLoader(test_subset, batch_size=config['data']['batch_size'], shuffle=False, num_workers=config['data']['num_workers'])
}

# --- MODEL SETUP (ShuffleNet V2) ---
def get_shufflenet():
    print("   Initializing ShuffleNet V2 (x1.0)...")
    model = models.shufflenet_v2_x1_0(weights='IMAGENET1K_V1')
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, 2)
    return model.to(device)

model = get_shufflenet()
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=config['training']['learning_rate'])

# --- TRAINING LOOP ---
def train():
    best_acc = 0.0
    epochs = config['training']['epochs']

    # --- INIT LOG FILE (ADDED) ---
    print(f"📝 Logging training metrics to: {LOG_CSV_PATH}")
    with open(LOG_CSV_PATH, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["epoch", "train_loss", "val_acc", "best_val_acc"])

    print(f"\n🚀 Starting ShuffleNet Training for {epochs} epochs...")

    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        
        pbar = tqdm(dataloaders['train'], desc=f"Ep {epoch+1}/{epochs}", leave=False)
        for inputs, labels in pbar:
            inputs, labels = inputs.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            pbar.set_postfix(loss=f"{loss.item():.4f}")
            
        # Validation
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for inputs, labels in dataloaders['val']:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                _, predicted = torch.max(outputs, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
        
        val_acc = 100 * correct / total
        epoch_loss = running_loss / len(dataloaders['train'])
        
        print(f"   Epoch {epoch+1}: Loss {epoch_loss:.4f} | Val Acc: {val_acc:.2f}%")
        
        if val_acc > best_acc:
            best_acc = val_acc
            save_path = os.path.join(CHECKPOINT_DIR, "shufflenet_best.pth")
            torch.save(model.state_dict(), save_path)
            print(f"      💾 Checkpoint saved: {val_acc:.2f}%")

        # --- APPEND LOG ROW (ADDED) ---
        with open(LOG_CSV_PATH, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([epoch + 1, epoch_loss, val_acc, best_acc])

    print(f"\n🏆 Training Complete. Best ShuffleNet Acc: {best_acc:.2f}%")

if __name__ == "__main__":
    train()
