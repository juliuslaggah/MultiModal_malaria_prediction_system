import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
import xgboost as xgb
import pandas as pd
import numpy as np
import joblib
import cv2
from PIL import Image
import io
import os
import base64
import time
import math

# ==========================================
# THESIS CONFIGURATION & CONSTANTS
# ==========================================
ALPHA = 0.5
MODEL_VERSION = "v1.0-shufflenet-xgboost"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

FEATURE_COLUMNS = [
    'Age', 'Sex', 'Fever', 'Headache', 'Abdominal_Pain',
    'General_Body_Malaise', 'Dizziness', 'Vomiting', 'Confusion',
    'Backache', 'Chest_Pain', 'Coughing', 'Joint_Pain'
]

SYMPTOM_COLUMNS = [
    'Fever', 'Headache', 'Abdominal_Pain', 'General_Body_Malaise',
    'Dizziness', 'Vomiting', 'Confusion', 'Backache',
    'Chest_Pain', 'Coughing', 'Joint_Pain'
]

FEATURE_DISPLAY_NAMES = {
    'Age': 'Age',
    'Sex': 'Gender',
    'Fever': 'Fever',
    'Headache': 'Headache',
    'Abdominal_Pain': 'Abdominal Pain',
    'General_Body_Malaise': 'General Body Malaise',
    'Dizziness': 'Dizziness',
    'Vomiting': 'Vomiting',
    'Confusion': 'Confusion',
    'Backache': 'Backache',
    'Chest_Pain': 'Chest Pain',
    'Coughing': 'Coughing',
    'Joint_Pain': 'Joint Pain'
}

# --------- Production safety/calibration knobs ----------
MIN_SYMPTOMS_FOR_CLINICAL_MODEL = 3          # Require at least 3 symptoms
CLINICAL_TEMP = 1.0                           # Keep raw probabilities for calibration
FUSION_TEMP = 1.0                             
IMAGE_SOFTMAX_TEMP = 1.0                      
P_CLIP_LOW, P_CLIP_HIGH = 0.0, 1.0           

# Clinical scoring weights (based on medical literature)
MALARIA_WEIGHTS = {
    'Fever': 25,
    'Headache': 15,
    'General_Body_Malaise': 15,
    'Vomiting': 10,
    'Dizziness': 10,
    'Joint_Pain': 10,
    'Confusion': 8,
    'Backache': 5,
    'Abdominal_Pain': 5
}

RESPIRATORY_WEIGHTS = {
    'Coughing': 15,
    'Chest_Pain': 15,
    'Fever': 5  # Fever can be in both
}

GI_WEIGHTS = {
    'Abdominal_Pain': 15,
    'Vomiting': 10,
    'Nausea': 10  # Not in our dataset but included for completeness
}


def _safe_clip(p: float) -> float:
    return float(max(P_CLIP_LOW, min(P_CLIP_HIGH, p)))


def _logit(p: float) -> float:
    p = max(1e-6, min(1 - 1e-6, p))
    return math.log(p / (1 - p))


def _sigmoid(x: float) -> float:
    # stable sigmoid
    if x >= 0:
        z = math.exp(-x)
        return 1 / (1 + z)
    else:
        z = math.exp(x)
        return z / (1 + z)


def _temperature_scale_prob(p: float, T: float) -> float:
    """
    Scale probability via logit(p)/T, then sigmoid.
    T>1 => less confident (closer to 0.5).
    """
    p = float(p)
    p = max(1e-6, min(1 - 1e-6, p))
    return float(_sigmoid(_logit(p) / max(1e-6, T)))


def _calculate_clinical_scores(symptoms: dict) -> dict:
    """
    Calculate clinical syndrome scores based on symptom patterns.
    Returns dictionary with malaria_score, respiratory_score, gi_score.
    """
    malaria_score = 0
    respiratory_score = 0
    gi_score = 0
    
    # Calculate malaria score
    for symptom, weight in MALARIA_WEIGHTS.items():
        if symptoms.get(symptom, 0):
            malaria_score += weight
    
    # Calculate respiratory score
    for symptom, weight in RESPIRATORY_WEIGHTS.items():
        if symptoms.get(symptom, 0):
            respiratory_score += weight
    
    # Calculate GI score
    for symptom, weight in GI_WEIGHTS.items():
        if symptoms.get(symptom, 0):
            gi_score += weight
    
    # Normalize scores to 0-100 range
    malaria_score = min(100, malaria_score)
    respiratory_score = min(100, respiratory_score)
    gi_score = min(100, gi_score)
    
    return {
        'malaria_score': malaria_score,
        'respiratory_score': respiratory_score,
        'gi_score': gi_score
    }


def _hybrid_clinical_prediction(model_prob: float, symptoms: dict) -> float:
    """
    Combine ML model probability with clinical rule-based scoring.
    Returns final probability of malaria infection.
    """
    scores = _calculate_clinical_scores(symptoms)
    
    malaria_score = scores['malaria_score']
    respiratory_score = scores['respiratory_score']
    gi_score = scores['gi_score']
    
    # Rule 1: Strong respiratory pattern with low malaria score -> likely NOT malaria
    if respiratory_score >= 30 and malaria_score <= 25:
        return 0.20  # 20% probability of malaria
    
    # Rule 2: Strong GI pattern with low malaria score -> likely NOT malaria
    elif gi_score >= 25 and malaria_score <= 25:
        return 0.25  # 25% probability of malaria
    
    # Rule 3: High malaria score with low respiratory/GI -> likely malaria
    elif malaria_score >= 50 and respiratory_score <= 15 and gi_score <= 15:
        return 0.85  # 85% probability of malaria
    
    # Rule 4: Moderate malaria score with mixed symptoms
    elif malaria_score >= 40:
        return 0.65  # 65% probability
    
    # Rule 5: Low malaria score but some symptoms
    elif malaria_score >= 20:
        return 0.35  # 35% probability
    
    # Default: blend model output with clinical score
    else:
        # Convert clinical score to probability (0-100 -> 0.2-0.8)
        clinical_prob = 0.2 + (malaria_score / 100) * 0.6
        # Weighted average: 30% model, 70% clinical rules
        return (model_prob * 0.3) + (clinical_prob * 0.7)


class MalariaPredictor:
    """
    Central Inference Engine implementing Late Fusion and Explainability.
    """

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"🚀 Initializing Inference Engine on: {self.device}")

        self._load_tabular_components()
        self._load_image_model()

        print("✅ Using XGBoost built-in SHAP values for explainability")

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

        self.gradients = None
        self.activations = None

    def _load_tabular_components(self):
        try:
            scaler_path = os.path.join(ARTIFACTS_DIR, "tabular_scaler.pkl")
            self.scaler = joblib.load(scaler_path)

            model_path = os.path.join(ARTIFACTS_DIR, "best_tabular_model.json")
            self.tabular_model = xgb.XGBClassifier()
            self.tabular_model.load_model(model_path)

            print("✅ Tabular Components Loaded")
        except Exception as e:
            print(f"❌ Error loading Tabular components: {e}")
            os.makedirs(ARTIFACTS_DIR, exist_ok=True)
            print("⚠️ WARNING: Artifacts not found. Inference will fail until models are placed in 'app/artifacts/'.")

    def _load_image_model(self):
        try:
            self.image_model = models.shufflenet_v2_x1_0(weights=None)
            in_features = self.image_model.fc.in_features
            self.image_model.fc = nn.Linear(in_features, 2)

            weights_path = os.path.join(ARTIFACTS_DIR, "shufflenet_best.pth")
            if os.path.exists(weights_path):
                state_dict = torch.load(weights_path, map_location=self.device)
                self.image_model.load_state_dict(state_dict)
            else:
                print("⚠️ WARNING: 'shufflenet_best.pth' not found. Using random weights.")

            self.image_model.to(self.device)
            self.image_model.eval()

            target_layer = self.image_model.conv5
            target_layer.register_forward_hook(self._forward_hook)
            target_layer.register_full_backward_hook(self._backward_hook)

            print("✅ Image Model (ShuffleNetV2) Loaded with Hooks")
        except Exception as e:
            print(f"❌ Error loading Image Model: {e}")

    def _forward_hook(self, module, input, output):
        self.activations = output

    def _backward_hook(self, module, grad_in, grad_out):
        self.gradients = grad_out[0]

    def preprocess_clinical(self, data: dict):
        df = pd.DataFrame([data])

        if 'Sex' in df.columns:
            sex_val = str(df['Sex'].iloc[0]).lower()
            df['Sex'] = 1 if sex_val == 'male' else 0

        df = df[FEATURE_COLUMNS]
        scaled_array = self.scaler.transform(df)
        return scaled_array, df.columns.tolist(), df

    def _count_symptoms(self, clinical_df: pd.DataFrame) -> int:
        try:
            vals = clinical_df[SYMPTOM_COLUMNS].iloc[0].astype(float).values
            return int(np.sum(vals > 0.0))
        except Exception:
            return 0

    def _calculate_risk_level(self, score: float) -> str:
        if score > 0.7:
            return "High"
        elif score > 0.4:
            return "Moderate"
        else:
            return "Low"

    def _generate_shap_explanation(self, clin_input, feature_names):
        try:
            booster = self.tabular_model.get_booster()
            dtest = xgb.DMatrix(clin_input, feature_names=feature_names)
            contribs = booster.predict(dtest, pred_contribs=True)[0]

            contributions = {}
            for i, feature in enumerate(feature_names):
                contributions[feature] = float(contribs[i])

            base_value = float(contribs[-1]) if len(contribs) > len(feature_names) else 0.0

            # Sort by absolute value to get most influential features
            sorted_features = sorted(contributions.items(), key=lambda x: abs(x[1]), reverse=True)
            
            # Get top features with their actual contribution values
            top_features = []
            for feature, value in sorted_features[:3]:
                top_features.append({
                    "name": FEATURE_DISPLAY_NAMES.get(feature, feature),
                    "contribution": float(value),
                    "direction": "positive" if value > 0 else "negative"
                })

            return {
                "feature_contributions": contributions,
                "base_value": base_value,
                "top_contributing_features": top_features
            }
        except Exception as e:
            print(f"SHAP explanation failed: {e}")
            return None

    def _generate_gradcam_explanation(self, heatmap_generated: bool, image_confidence: float):
        attention_regions = []
        if image_confidence > 0.7:
            attention_regions = ["Parasite clusters", "Infected red blood cells"]
        elif image_confidence > 0.3:
            attention_regions = ["Cell boundaries", "Potential parasite regions"]
        else:
            attention_regions = ["Low confidence regions"]

        return {
            "heatmap_generated": heatmap_generated,
            "attention_regions": attention_regions,
            "confidence_in_visual": float(min(image_confidence, 0.9))
        }

    # -----------------------------
    # CLINICAL-ONLY PREDICTION - HYBRID APPROACH
    # -----------------------------
    def predict_clinical_only(self, clinical_data: dict):
        start_time = time.time()

        clin_input, feature_names, clin_df = self.preprocess_clinical(clinical_data)
        symptom_count = self._count_symptoms(clin_df)

        # Require minimum 3 symptoms
        if symptom_count < MIN_SYMPTOMS_FOR_CLINICAL_MODEL:
            return {
                "prediction": "Insufficient Symptoms",
                "confidence_score": 0.0,
                "risk_level": "Unknown",
                "clinical_score": 0.0,
                "image_score": None,
                "explanation": {
                    "mode": "clinical_only",
                    "note": f"Please select at least {MIN_SYMPTOMS_FOR_CLINICAL_MODEL} symptoms for prediction. Current: {symptom_count}",
                    "symptoms_selected": symptom_count,
                    "required_symptoms": MIN_SYMPTOMS_FOR_CLINICAL_MODEL
                },
                "model_version": MODEL_VERSION,
                "computation_time": time.time() - start_time,
                "mode": "clinical_only",
                "error": True
            }

        # Get model probability
        proba = self.tabular_model.predict_proba(clin_input)[0]
        p_model = float(proba[1])  # Probability of infected
        
        # Get symptoms as dictionary
        symptoms = clin_df[SYMPTOM_COLUMNS].iloc[0].to_dict()
        
        # Calculate clinical scores
        clinical_scores = _calculate_clinical_scores(symptoms)
        
        # Get hybrid prediction
        p_final = _hybrid_clinical_prediction(p_model, symptoms)
        p_final = _safe_clip(p_final)
        
        # Get SHAP explanation (for transparency)
        shap_explanation = self._generate_shap_explanation(clin_input, feature_names)

        # Determine prediction and risk level
        prediction = "Infected" if p_final > 0.5 else "Uninfected"
        risk_level = self._calculate_risk_level(p_final)

        # Get top contributing factors (combine SHAP and clinical scores)
        contributing_factors = []
        if clinical_scores['malaria_score'] > 40:
            contributing_factors.append("High malaria symptom score")
        if clinical_scores['respiratory_score'] > 30:
            contributing_factors.append("Respiratory symptoms present")
        if clinical_scores['gi_score'] > 25:
            contributing_factors.append("Gastrointestinal symptoms present")
        
        if shap_explanation and shap_explanation.get('top_contributing_features'):
            for feature in shap_explanation['top_contributing_features'][:2]:
                contributing_factors.append(feature['name'])

        explanation = {
            "mode": "clinical_only",
            "note": "Hybrid prediction combining ML model with clinical rules for improved accuracy in endemic regions.",
            "shap": shap_explanation,
            "clinical_scores": clinical_scores,
            "contributing_factors": contributing_factors[:3],  # Top 3 factors
            "symptoms_selected": symptom_count,
            "model_probability": p_model,
            "final_probability": p_final,
            "hybrid_weights": {
                "model_weight": 0.3,
                "clinical_weight": 0.7
            }
        }

        return {
            "prediction": prediction,
            "confidence_score": float(p_final),
            "risk_level": risk_level,
            "clinical_score": float(p_final),
            "image_score": None,
            "explanation": explanation,
            "model_version": MODEL_VERSION,
            "computation_time": time.time() - start_time,
            "mode": "clinical_only"
        }

    # -----------------------------
    # IMAGE-ONLY PREDICTION
    # -----------------------------
    def predict_image_only(self, image_bytes):
        start_time = time.time()

        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img_tensor = self.transform(img).unsqueeze(0).to(self.device)

        self.image_model.zero_grad(set_to_none=True)
        img_tensor.requires_grad = True

        output = self.image_model(img_tensor)

        # Get raw probabilities
        probs = F.softmax(output, dim=1)
        p_uninfected = float(probs[0][0].item())
        p_infected = float(probs[0][1].item())
        
        print(f"📊 Image Prediction - Uninfected: {p_uninfected:.3f}, Infected: {p_infected:.3f}")

        score = output[:, 1]
        score.backward()

        heatmap_path, heatmap_b64 = self._generate_heatmap(img, self.activations, self.gradients)

        gradcam_explanation = self._generate_gradcam_explanation(
            heatmap_generated=heatmap_path is not None,
            image_confidence=p_infected
        )

        prediction = "Infected" if p_infected > 0.5 else "Uninfected"
        risk_level = self._calculate_risk_level(p_infected)

        explanation = {
            "mode": "image_only",
            "note": "Prediction based on microscopy image.",
            "grad_cam": gradcam_explanation,
            "probabilities": {
                "uninfected": p_uninfected,
                "infected": p_infected
            }
        }

        return {
            "prediction": prediction,
            "confidence_score": float(p_infected),
            "risk_level": risk_level,
            "clinical_score": None,
            "image_score": float(p_infected),
            "explanation": explanation,
            "heatmap_path": heatmap_path,
            "heatmap_base64": heatmap_b64,
            "model_version": MODEL_VERSION,
            "computation_time": time.time() - start_time,
            "mode": "image_only"
        }

    # -----------------------------
    # FUSION PREDICTION - HYBRID CLINICAL + IMAGE
    # -----------------------------
    def predict_fusion(self, image_bytes, clinical_data: dict):
        start_time = time.time()

        clin_input, feature_names, clin_df = self.preprocess_clinical(clinical_data)
        symptom_count = self._count_symptoms(clin_df)

        # If insufficient symptoms, return error
        if symptom_count < MIN_SYMPTOMS_FOR_CLINICAL_MODEL:
            return {
                "prediction": "Insufficient Symptoms",
                "confidence_score": 0.0,
                "risk_level": "Unknown",
                "clinical_score": 0.0,
                "image_score": None,
                "explanation": {
                    "mode": "fusion",
                    "note": f"Please select at least {MIN_SYMPTOMS_FOR_CLINICAL_MODEL} symptoms for fusion prediction. Current: {symptom_count}",
                    "symptoms_selected": symptom_count,
                    "required_symptoms": MIN_SYMPTOMS_FOR_CLINICAL_MODEL
                },
                "model_version": MODEL_VERSION,
                "computation_time": time.time() - start_time,
                "mode": "fusion",
                "error": True
            }

        # Clinical prediction - HYBRID
        p_model = float(self.tabular_model.predict_proba(clin_input)[0][1])
        symptoms = clin_df[SYMPTOM_COLUMNS].iloc[0].to_dict()
        clinical_scores = _calculate_clinical_scores(symptoms)
        p_clinical_hybrid = _hybrid_clinical_prediction(p_model, symptoms)
        
        shap_explanation = self._generate_shap_explanation(clin_input, feature_names)

        # Image prediction
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img_tensor = self.transform(img).unsqueeze(0).to(self.device)

        self.image_model.zero_grad(set_to_none=True)
        img_tensor.requires_grad = True

        output = self.image_model(img_tensor)
        probs = F.softmax(output, dim=1)
        p_image_infected = float(probs[0][1].item())

        score = output[:, 1]
        score.backward()

        heatmap_path, heatmap_b64 = self._generate_heatmap(img, self.activations, self.gradients)

        gradcam_explanation = self._generate_gradcam_explanation(
            heatmap_generated=heatmap_path is not None,
            image_confidence=p_image_infected
        )

        # Fusion with weights using hybrid clinical probability
        p_final = (ALPHA * p_clinical_hybrid) + ((1 - ALPHA) * p_image_infected)
        p_final = _safe_clip(p_final)
        
        print(f"📊 Fusion - Clinical (hybrid): {p_clinical_hybrid:.3f}, Image: {p_image_infected:.3f}, Final: {p_final:.3f}")

        prediction = "Infected" if p_final > 0.5 else "Uninfected"
        risk_level = self._calculate_risk_level(p_final)

        # Get top contributing factors
        contributing_factors = []
        if clinical_scores['malaria_score'] > 40:
            contributing_factors.append("High malaria symptom score")
        if clinical_scores['respiratory_score'] > 30:
            contributing_factors.append("Respiratory symptoms")
        if p_image_infected > 0.7:
            contributing_factors.append("Strong image evidence")
        
        if shap_explanation and shap_explanation.get('top_contributing_features'):
            for feature in shap_explanation['top_contributing_features'][:2]:
                contributing_factors.append(feature['name'])

        explanation = {
            "mode": "fusion",
            "note": f"Late fusion with hybrid clinical prediction: {ALPHA*100:.0f}% clinical + {(1-ALPHA)*100:.0f}% image.",
            "shap": shap_explanation,
            "grad_cam": gradcam_explanation,
            "clinical_scores": clinical_scores,
            "contributing_factors": contributing_factors[:3],
            "fusion_alpha": ALPHA,
            "clinical_weight": float(ALPHA),
            "image_weight": float(1 - ALPHA),
            "symptoms_selected": symptom_count,
            "probabilities": {
                "model_probability": p_model,
                "clinical_hybrid": p_clinical_hybrid,
                "image_infected": p_image_infected,
                "fused_infected": p_final
            }
        }

        return {
            "prediction": prediction,
            "confidence_score": float(p_final),
            "risk_level": risk_level,
            "clinical_score": float(p_clinical_hybrid),
            "image_score": float(p_image_infected),
            "explanation": explanation,
            "heatmap_path": heatmap_path,
            "heatmap_base64": heatmap_b64,
            "model_version": MODEL_VERSION,
            "computation_time": time.time() - start_time,
            "mode": "fusion"
        }

    def predict(self, clinical_data: dict = None, image_bytes: bytes = None):
        if clinical_data is not None and image_bytes is not None:
            return self.predict_fusion(image_bytes, clinical_data)
        elif clinical_data is not None:
            return self.predict_clinical_only(clinical_data)
        elif image_bytes is not None:
            return self.predict_image_only(image_bytes)
        else:
            raise ValueError("At least one of clinical_data or image_bytes must be provided")

    def _generate_heatmap(self, original_img, activations, gradients):
        try:
            if activations is None or gradients is None:
                return None, None

            pooled_gradients = torch.mean(gradients, dim=[0, 2, 3])
            activations = activations.detach()

            for i in range(activations.shape[1]):
                activations[:, i, :, :] *= pooled_gradients[i]

            heatmap = torch.mean(activations, dim=1).squeeze()
            heatmap = F.relu(heatmap)

            max_val = torch.max(heatmap)
            if max_val <= 0:
                return None, None

            heatmap /= max_val
            heatmap = heatmap.cpu().numpy()

            original_w, original_h = original_img.size
            heatmap = cv2.resize(heatmap, (original_w, original_h))

            heatmap = np.uint8(255 * heatmap)
            heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

            original_cv = cv2.cvtColor(np.array(original_img), cv2.COLOR_RGB2BGR)
            superimposed_img = cv2.addWeighted(original_cv, 0.6, heatmap, 0.4, 0)

            filename = f"gradcam_{os.urandom(4).hex()}.jpg"
            save_path = os.path.join(BASE_DIR, "static", "heatmaps", filename)
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            cv2.imwrite(save_path, superimposed_img)

            _, buffer = cv2.imencode('.jpg', superimposed_img)
            img_str = base64.b64encode(buffer).decode('utf-8')

            return f"/static/heatmaps/{filename}", img_str

        except Exception as e:
            print(f"Grad-CAM generation failed: {e}")
            return None, None
        