import torch
import torch.nn.functional as F
import numpy as np
import cv2
import io
import os
import base64
from PIL import Image

class GradCAM:
    """
    Computes Class Activation Maps for the ShuffleNet Model.
    Implements Thesis Section 4.8 (Visual Explainability).
    """
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        
        # Hook into the model to capture gradients and activations
        # These hooks allow us to inspect the internal state during inference
        target_layer.register_forward_hook(self.save_activation)
        target_layer.register_full_backward_hook(self.save_gradient)

    def save_activation(self, module, input, output):
        self.activations = output

    def save_gradient(self, module, grad_input, grad_output):
        # Access the first element of the tuple
        self.gradients = grad_output[0]

    def generate(self, input_tensor, class_idx=None):
        """
        Generates the raw heatmap array.
        """
        # 1. Forward Pass
        self.model.zero_grad()
        output = self.model(input_tensor)
        
        if class_idx is None:
            # Default to the predicted class
            class_idx = torch.argmax(output, dim=1)

        # 2. Backward Pass to get Gradients
        score = output[0, class_idx]
        score.backward(retain_graph=True)
        
        # 3. Global Average Pooling of Gradients
        # gradients shape: [Batch, Channels, Height, Width] -> [1, C, H, W]
        gradients = self.gradients[0] 
        pooled_gradients = torch.mean(gradients, dim=[1, 2])
        
        # 4. Weight the activations by the gradients
        activations = self.activations[0] # [C, H, W]
        for i in range(activations.shape[0]):
            activations[i, :, :] *= pooled_gradients[i]
            
        # 5. Create Heatmap (Average across channels)
        heatmap = torch.mean(activations, dim=0).cpu().detach()
        
        # 6. Apply ReLU (We only care about features that have a Positive influence)
        heatmap = F.relu(heatmap) 
        
        # 7. Normalize (Min-Max scaling)
        max_val = torch.max(heatmap)
        if max_val > 0:
            heatmap /= max_val
        
        return heatmap.numpy()

def overlay_heatmap(original_image_bytes, heatmap_array, output_path=None):
    """
    Overlays the heatmap onto the original image.
    
    Args:
        original_image_bytes: Raw bytes of the uploaded image.
        heatmap_array: 2D numpy array from GradCAM.generate().
        output_path: If provided, saves the image to disk (for DB linking).
        
    Returns:
        Base64 string of the image (for immediate API response).
    """
    try:
        # 1. Load original image and convert to RGB
        img_pil = Image.open(io.BytesIO(original_image_bytes)).convert("RGB")
        img = np.array(img_pil)
        
        # 2. Convert RGB to BGR for OpenCV
        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        
        # 3. Resize heatmap to match original image dimensions
        heatmap = cv2.resize(heatmap_array, (img.shape[1], img.shape[0]))
        
        # 4. Colorize heatmap
        # Convert to 0-255 range and apply JET colormap
        heatmap = np.uint8(255 * heatmap)
        heatmap_color = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
        
        # 5. Superimpose
        # 0.4 intensity for heatmap, 0.6 for original image
        superimposed_img = cv2.addWeighted(img_bgr, 0.6, heatmap_color, 0.4, 0)
        
        # 6. Save to Disk (Required for Thesis Auditability)
        if output_path:
            # Ensure directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            cv2.imwrite(output_path, superimposed_img)

        # 7. Return Base64 (Optional, for direct frontend display)
        is_success, buffer = cv2.imencode(".jpg", superimposed_img)
        if is_success:
            return base64.b64encode(buffer).decode("utf-8")
        else:
            return None
            
    except Exception as e:
        print(f"Error in overlay_heatmap: {e}")
        return None
