from pydantic import BaseModel, field_validator, ConfigDict, Field
from typing import Optional, Dict, Any, List, Union
from datetime import datetime

# ==============================================================================
# 1. INPUT SCHEMA (The Clinical Interface)
# ==============================================================================
class ClinicalDataInput(BaseModel):
    # Strictly aligned with the Sierra Leone Phase 2 Dataset Features
    Age: int
    Sex: str                # "Male" or "Female"
    Fever: int              # 0 or 1
    Headache: int           # 0 or 1
    Abdominal_Pain: int     # 0 or 1
    General_Body_Malaise: int
    Dizziness: int
    Vomiting: int
    Confusion: int
    Backache: int
    Chest_Pain: int
    Coughing: int
    Joint_Pain: int

    # Validator to ensure data integrity (Thesis Section 4.2.2 - Reliability)
    @field_validator('Sex')
    @classmethod
    def validate_sex(cls, v: str) -> str:
        if v.lower() not in ['male', 'female']:
            raise ValueError("Sex must be 'Male' or 'Female'")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "Age": 25,
                "Sex": "Female",
                "Fever": 1,
                "Headache": 1,
                "Abdominal_Pain": 0,
                "General_Body_Malaise": 1,
                "Dizziness": 0,
                "Vomiting": 0,
                "Confusion": 0,
                "Backache": 0,
                "Chest_Pain": 0,
                "Coughing": 0,
                "Joint_Pain": 1
            }
        }

# ==============================================================================
# 2. EXPLANATION SCHEMAS (Thesis Section 4.8)
# ==============================================================================

class BaseExplanation(BaseModel):
    """Base class for all explanation types"""
    mode: str = Field(..., description="Operational mode: clinical_only, image_only, or fusion")
    note: str = Field(..., description="Human-readable explanation of the prediction")

class SHAPExplanation(BaseModel):
    """SHAP (SHapley Additive exPlanations) for clinical features"""
    feature_contributions: Dict[str, float] = Field(
        ..., 
        description="Dictionary of feature names to their contribution scores"
    )
    base_value: Optional[float] = Field(
        None,
        description="Expected model output (average prediction)"
    )
    top_positive_features: List[str] = Field(
        default_factory=list,
        description="Top features positively contributing to prediction"
    )
    top_negative_features: List[str] = Field(
        default_factory=list,
        description="Top features negatively contributing to prediction"
    )

class LIMEExplanation(BaseModel):
    """LIME (Local Interpretable Model-agnostic Explanations)"""
    local_prediction: float = Field(
        ..., 
        description="Prediction from the local interpretable model"
    )
    feature_weights: Dict[str, float] = Field(
        ..., 
        description="Feature weights from the local model"
    )
    interpretable_features: List[str] = Field(
        ..., 
        description="List of features used in the explanation"
    )

class GradCAMExplanation(BaseModel):
    """Grad-CAM (Gradient-weighted Class Activation Mapping) for images"""
    heatmap_generated: bool = Field(
        ..., 
        description="Whether heatmap was successfully generated"
    )
    attention_regions: List[str] = Field(
        default_factory=list,
        description="Description of attention regions (e.g., 'parasite clusters', 'cell boundaries')"
    )
    confidence_in_visual: float = Field(
        ..., 
        ge=0, le=1,
        description="Confidence score for the visual explanation"
    )

class ClinicalExplanation(BaseExplanation):
    """Explanation for clinical-only predictions"""
    mode: str = "clinical_only"
    shap: Optional[SHAPExplanation] = None
    lime: Optional[LIMEExplanation] = None
    contributing_factors: List[str] = Field(
        default_factory=list,
        description="Top clinical factors contributing to diagnosis"
    )

class ImageExplanation(BaseExplanation):
    """Explanation for image-only predictions"""
    mode: str = "image_only"
    grad_cam: GradCAMExplanation
    image_confidence: float = Field(
        ..., 
        ge=0, le=1,
        description="Model confidence in image analysis"
    )

class FusionExplanation(BaseExplanation):
    """Explanation for fusion predictions"""
    mode: str = "fusion"
    shap: Optional[SHAPExplanation] = None
    lime: Optional[LIMEExplanation] = None
    grad_cam: Optional[GradCAMExplanation] = None
    fusion_alpha: float = Field(
        ..., 
        ge=0, le=1,
        description="Weight given to clinical data in fusion (alpha parameter)"
    )
    clinical_weight: float = Field(
        ..., 
        ge=0, le=1,
        description="Percentage contribution from clinical data"
    )
    image_weight: float = Field(
        ..., 
        ge=0, le=1,
        description="Percentage contribution from image data"
    )
    
    @field_validator('clinical_weight', 'image_weight')
    @classmethod
    def validate_weights(cls, v: float) -> float:
        if not 0 <= v <= 1:
            raise ValueError("Weight must be between 0 and 1")
        return v

# Union type for all possible explanations
ExplanationUnion = Union[ClinicalExplanation, ImageExplanation, FusionExplanation]

# ==============================================================================
# 3. OUTPUT SCHEMA (The Immediate Diagnostic Result)
# ==============================================================================
class PredictionResponse(BaseModel):
    # Database Identifiers
    id: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    
    # Thesis Section 4.9: Traceability Requirement
    model_version: str = "v1.0-shufflenet-xgboost"

    # Operational Mode
    mode: str = Field(..., description="clinical_only, image_only, or fusion")

    # Prediction Outcome
    prediction: str = Field(..., description="'Infected' or 'Uninfected'")
    confidence_score: float = Field(
        ..., 
        ge=0, le=1,
        description="Final confidence score (0-1)"
    )
    risk_level: str = Field(
        ..., 
        description="'Low', 'Moderate', or 'High'"
    )
    
    # Component Scores (For Transparency) - Optional based on mode
    clinical_score: Optional[float] = Field(
        None,
        ge=0, le=1,
        description="Clinical model confidence score (None if no clinical data)"
    )
    image_score: Optional[float] = Field(
        None,
        ge=0, le=1,
        description="Image model confidence score (None if no image)"
    )
    
    # Explainability Artifacts (Thesis Section 4.8)
    explanation: ExplanationUnion
    
    # Visuals (Optional based on mode)
    heatmap_path: Optional[str] = Field(
        None,
        description="Path to saved heatmap image for history/download"
    )
    heatmap_base64: Optional[str] = Field(
        None,
        description="Base64 encoded heatmap for immediate UI display"
    )
    
    # System Metrics
    computation_time: Optional[float] = Field(
        None,
        ge=0,
        description="Inference time in seconds"
    )

    # Validators
    @field_validator('risk_level')
    @classmethod
    def validate_risk_level(cls, v: str) -> str:
        valid_levels = ['Low', 'Moderate', 'High']
        if v not in valid_levels:
            raise ValueError(f"risk_level must be one of {valid_levels}")
        return v

    @field_validator('prediction')
    @classmethod
    def validate_prediction(cls, v: str) -> str:
        valid_predictions = ['Infected', 'Uninfected']
        if v not in valid_predictions:
            raise ValueError(f"prediction must be one of {valid_predictions}")
        return v

    @field_validator('confidence_score', 'clinical_score', 'image_score')
    @classmethod
    def validate_probability(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not 0 <= v <= 1:
            raise ValueError("Probability scores must be between 0 and 1")
        return v

    model_config = ConfigDict(from_attributes=True)

# ==============================================================================
# 4. HISTORY SCHEMA (The Database Record)
# ==============================================================================
class PredictionRecord(BaseModel):
    """
    Schema for listing past predictions.
    Matches the columns in models.Prediction
    """
    id: int
    timestamp: datetime
    mode: Optional[str] = Field(None, description="Operational mode used")
    filename: Optional[str] = None
    prediction: str
    confidence_score: float
    risk_level: str
    clinical_score: Optional[float] = None
    image_score: Optional[float] = None
    model_version: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

# ==============================================================================
# 5. SYSTEM METRICS SCHEMA (For Monitoring)
# ==============================================================================
class SystemMetrics(BaseModel):
    """Schema for system performance monitoring"""
    timestamp: datetime = Field(default_factory=datetime.now)
    request_count: int = Field(..., ge=0)
    average_inference_time: float = Field(..., ge=0)
    clinical_only_count: int = Field(..., ge=0)
    image_only_count: int = Field(..., ge=0)
    fusion_count: int = Field(..., ge=0)
    error_rate: float = Field(..., ge=0, le=1)