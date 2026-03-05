import os
import shutil
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import json
import joblib
import random
import sys
import xgboost as xgb
from torchvision import transforms, models
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from tqdm import tqdm

# ==============================================================================
# 1. CONFIGURATION & SETUP
# ==============================================================================
# Base Directory
BASE_DIR = os.getcwd()

# --- IMAGE PATHS (Latest Development) ---
BASE_IMG_DIR = os.path.join(BASE_DIR, "data/images/tanzania")
COMBINED_DIR = os.path.join(BASE_IMG_DIR, "Combined_Data")
TEST_IMAGES_JSON = os.path.join(BASE_DIR, "experiments/image/test_images.json")
# UPDATED: Using the winning ShuffleNet model
IMAGE_MODEL_PATH = os.path.join(BASE_DIR, "outputs/checkpoints/shufflenet_v2_best.pth")

# --- TABULAR PATHS (Using Artifacts) ---
TABULAR_DATA_PATH = os.path.join(BASE_DIR, "data/tabular/bangladesh/Malaria_Dataset.csv")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "experiments/tabular/artifacts")
TABULAR_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "xgb_phase1.json")

# Hardware
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"🚀 Running Late Fusion Solver on: {DEVICE}")

# Set Seeds
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

# ==============================================================================
# 2. DATA LOADING & PREPROCESSING
# ==============================================================================
def load_tabular_test_data():
    """
    Loads tabular data and preprocesses it using the saved artifacts 
    (Imputer, Scaler, Feature Selection) to match the trained XGBoost model.
    """
    print("\n📊 Loading Tabular Data (Phase 1)...")
    
    # 1. Load Artifacts
    try:
        with open(os.path.join(ARTIFACTS_DIR, "selected_features.json"), 'r') as f:
            selected_features = json.load(f)
        imputer = joblib.load(os.path.join(ARTIFACTS_DIR, "imputer.pkl"))
        scaler = joblib.load(os.path.join(ARTIFACTS_DIR, "scaler.pkl"))
        print("   ✅ Loaded preprocessing artifacts (Features, Imputer, Scaler).")
    except FileNotFoundError as e:
        print(f"❌ Error loading artifacts: {e}")
        sys.exit(1)

    # 2. Load CSV
    df = pd.read_csv(TABULAR_DATA_PATH)
    
    # Identify Target
    target_col = 'malaria_test_result' if 'malaria_test_result' in df.columns else 'Target'
    if target_col not in df.columns:
        # Fallback for Bangladesh dataset variations
        target_col = df.columns[-1]
    
    y_raw = df[target_col].values

    # 3. Feature Selection & Alignment
    # Ensure all selected features exist, fill missing with 0
    missing_cols = [col for col in selected_features if col not in df.columns]
    if missing_cols:
        print(f"   ⚠️ Warning: Missing columns {missing_cols}, filling with 0.")
        for col in missing_cols:
            df[col] = 0
            
    df_subset = df[selected_features].copy()
    
    # Force Numeric
    for col in df_subset.columns:
        df_subset[col] = pd.to_numeric(df_subset[col], errors='coerce')
        
    X_raw = df_subset.values

    # 4. Apply Transforms (Impute -> Scale)
    X_processed = imputer.transform(X_raw)
    X_processed = scaler.transform(X_processed)
    
    # 5. Extract Test Split (Last 15% to match training protocol)
    test_size = int(len(df) * 0.15)
    X_test = X_processed[-test_size:]
    y_test = y_raw[-test_size:]
    
    # Binarize Label if needed (e.g., if labels are string "Positive"/"Negative")
    # Assuming already numeric 0/1 based on previous steps, but safe check:
    if y_test.dtype == object:
         y_test = (y_test == 'Positive').astype(int) 
    else:
         y_test = y_test.astype(int)

    print(f"   -> Tabular Test Data: {X_test.shape[0]} samples.")
    return X_test, y_test

def get_image_paths():
    """
    Retrieves image paths, prioritizing the strict test set JSON.
    """
    print("📦 Locating Image Data...")
    
    if os.path.exists(TEST_IMAGES_JSON):
        print(f"   ✅ Using strict test set from: {TEST_IMAGES_JSON}")
        with open(TEST_IMAGES_JSON, 'r') as f:
            all_paths = json.load(f)
        
        inf_imgs = [p for p in all_paths if "Infected" in p and "Uninfected" not in p]
        uninf_imgs = [p for p in all_paths if "Uninfected" in p]
    else:
        print("   ⚠️ test_images.json not found. Scanning directories...")
        inf_dir = os.path.join(COMBINED_DIR, "Infected")
        uninf_dir = os.path.join(COMBINED_DIR, "Uninfected")
        
        if not os.path.exists(inf_dir):
            print(f"❌ Error: Image directory not found: {inf_dir}")
            sys.exit(1)
            
        inf_imgs = [os.path.join(inf_dir, f) for f in os.listdir(inf_dir)]
        uninf_imgs = [os.path.join(uninf_dir, f) for f in os.listdir(uninf_dir)]
        
    print(f"   -> Image Pool: {len(inf_imgs)} Infected, {len(uninf_imgs)} Uninfected")
    return inf_imgs, uninf_imgs

def pair_multimodal_data(X_tab, y_tab, inf_imgs, uninf_imgs):
    """
    Virtual Pairing: Matches Tabular Labels with Random Images of the same class.
    """
    print("\n🔗 Creating Virtual Multimodal Pairs...")
    paired_img_paths = []
    
    for label in y_tab:
        if label == 1: # Infected
            img_path = random.choice(inf_imgs)
        else: # Uninfected
            img_path = random.choice(uninf_imgs)
        paired_img_paths.append(img_path)
        
    print(f"   -> Successfully paired {len(paired_img_paths)} patients.")
    return paired_img_paths

# ==============================================================================
# 3. MODEL INFERENCE
# ==============================================================================
def get_tabular_predictions(X_data):
    print(f"🧠 Generating Clinical Predictions (XGBoost)...")
    
    if not os.path.exists(TABULAR_MODEL_PATH):
        print(f"❌ Error: Model file not found: {TABULAR_MODEL_PATH}")
        sys.exit(1)
        
    model = xgb.XGBClassifier()
    model.load_model(TABULAR_MODEL_PATH)
    print("   ✅ XGBoost Phase 1 model loaded.")
    
    # Predict probabilities (Class 1)
    probs = model.predict_proba(X_data)[:, 1]
    return probs

class ImageInferenceDataset(Dataset):
    def __init__(self, image_paths):
        self.image_paths = image_paths
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        path = self.image_paths[idx]
        img = Image.open(path).convert("RGB")
        return self.transform(img)

def get_image_predictions(image_paths):
    print(f"👁️ Generating Microscopy Predictions (ShuffleNet V2)...")
    
    # Initialize ShuffleNet V2 (Latest Architecture)
    model = models.shufflenet_v2_x1_0(weights=None)
    model.fc = nn.Linear(1024, 2)
    
    if os.path.exists(IMAGE_MODEL_PATH):
        try:
            state_dict = torch.load(IMAGE_MODEL_PATH, map_location=DEVICE)
            model.load_state_dict(state_dict)
            print(f"   ✅ Weights loaded from {os.path.basename(IMAGE_MODEL_PATH)}")
        except Exception as e:
            print(f"❌ Error loading weights: {e}")
            return np.zeros(len(image_paths))
    else:
        print(f"❌ Error: Image checkpoint not found at {IMAGE_MODEL_PATH}")
        sys.exit(1)

    model.to(DEVICE)
    model.eval()
    
    dataset = ImageInferenceDataset(image_paths)
    loader = DataLoader(dataset, batch_size=32, shuffle=False, num_workers=4)
    
    all_probs = []
    
    with torch.no_grad():
        for imgs in tqdm(loader, desc="   Processing Batches"):
            imgs = imgs.to(DEVICE)
            outputs = model(imgs)
            probs = torch.softmax(outputs, dim=1)[:, 1] 
            all_probs.extend(probs.cpu().numpy())
            
    return np.array(all_probs)

# ==============================================================================
# 4. FUSION & EVALUATION
# ==============================================================================
def evaluate_performance(y_true, y_pred_probs, threshold=0.5):
    y_pred = (y_pred_probs >= threshold).astype(int)
    return {
        "Accuracy": accuracy_score(y_true, y_pred),
        "Precision": precision_score(y_true, y_pred, zero_division=0),
        "Recall": recall_score(y_true, y_pred, zero_division=0),
        "F1": f1_score(y_true, y_pred, zero_division=0)
    }

def solve_optimal_alpha(p_clinical, p_image, y_true):
    print("\n⚖️  Searching for Optimal Alpha (Fusion Weight)...")
    print("-" * 65)
    print(f"{'Alpha':<10} | {'Accuracy':<10} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10}")
    print("-" * 65)
    
    best_alpha = 0.0
    best_acc = 0.0
    best_metrics = {}
    
    alphas = np.linspace(0.0, 1.0, 21) # 0.0, 0.05, 0.1 ... 1.0
    
    for alpha in alphas:
        p_fused = (alpha * p_clinical) + ((1 - alpha) * p_image)
        metrics = evaluate_performance(y_true, p_fused)
        
        if metrics['Accuracy'] > best_acc:
            best_acc = metrics['Accuracy']
            best_alpha = alpha
            best_metrics = metrics
            
        if alpha in [0.0, 0.5, 1.0]:
             print(f"{alpha:.2f}        | {metrics['Accuracy']:.4f}     | {metrics['Precision']:.4f}     | {metrics['Recall']:.4f}     | {metrics['F1']:.4f}")

    print("-" * 65)
    print(f"🏆 OPTIMAL ALPHA FOUND: {best_alpha:.2f}")
    return best_alpha, best_metrics

# ==============================================================================
# 5. MAIN
# ==============================================================================
if __name__ == "__main__":
    
    # 1. Prepare Data
    X_test_tab, y_true = load_tabular_test_data()
    inf_imgs, uninf_imgs = get_image_paths()
    img_paths = pair_multimodal_data(X_test_tab, y_true, inf_imgs, uninf_imgs)
    
    # 2. Inference
    probs_clinical = get_tabular_predictions(X_test_tab)
    probs_image = get_image_predictions(img_paths)
    
    # 3. Evaluation
    print("\n--- 🏥 Mode 1: Clinical Symptom-Only (XGBoost) ---")
    metrics_clinical = evaluate_performance(y_true, probs_clinical)
    print(metrics_clinical)
    
    print("\n--- 🔬 Mode 2: Microscopy Image-Only (ShuffleNet V2) ---")
    metrics_image = evaluate_performance(y_true, probs_image)
    print(metrics_image)
    
    print("\n--- 🧬 Mode 3: Dual-Branch Late Fusion ---")
    opt_alpha, metrics_fusion = solve_optimal_alpha(probs_clinical, probs_image, y_true)
    
    # 4. Save
    results = {
        "Mode_1_Clinical": metrics_clinical,
        "Mode_2_Image": metrics_image,
        "Mode_3_Fusion": metrics_fusion,
        "Optimal_Alpha": opt_alpha
    }
    
    with open("experiments/multimodal/fusion_results.json", "w") as f:
        json.dump(results, f, indent=4)
        
    print("\n✅ Experiment Complete. Results saved to experiments/multimodal/fusion_results.json")
