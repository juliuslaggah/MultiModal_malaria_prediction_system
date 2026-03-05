from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, Index
from sqlalchemy.sql import func
from .database import Base

class Prediction(Base):
    """
    Database Model for Auditability and Traceability.
    Aligned with Thesis Section 4.9 (Database Design).
    
    Stores complete prediction records with explanations for all operational modes.
    """
    __tablename__ = "predictions"

    # ==========================================
    # 1. IDENTIFIERS & METADATA
    # ==========================================
    id = Column(Integer, primary_key=True, index=True)
    
    # Audit: When did this happen?
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Traceability: Which version of the system generated this?
    model_version = Column(String, default="v1.0-shufflenet-xgboost")
    
    # Operational Mode (Thesis Section 4.2.1: Flexible Operational Modes)
    mode = Column(String, nullable=False, default="fusion")  # clinical_only, image_only, fusion

    # ==========================================
    # 2. INPUT DATA SNAPSHOT (Section 4.2.1)
    # ==========================================
    # Patient Demographics (Searchable)
    age = Column(Integer, nullable=True)  # Nullable for image-only mode
    sex = Column(String, nullable=True)   # Nullable for image-only mode
    
    # Full Clinical Data (Raw JSON snapshot of symptoms)
    # Stores the complete clinical input for reproducibility
    clinical_data_snapshot = Column(JSON, nullable=True)
    
    # Image Reference (Path to the original uploaded file in static/uploads)
    filename = Column(String, nullable=True)  # Nullable for clinical-only mode

    # ==========================================
    # 3. DIAGNOSTIC OUTCOME
    # ==========================================
    # The Prediction Result
    prediction = Column(String, nullable=False)      # "Infected" or "Uninfected"
    confidence_score = Column(Float, nullable=False) # Final Weighted Probability (P_final)
    risk_level = Column(String, nullable=False)      # "High", "Moderate", "Low"
    
    # Modality-Specific Scores (Thesis Section 3.2.4)
    clinical_score = Column(Float, nullable=True)   # P_clinical (XGBoost) - nullable for image-only
    image_score = Column(Float, nullable=True)      # P_image (ShuffleNetV2) - nullable for clinical-only

    # ==========================================
    # 4. EXPLAINABILITY ARTIFACTS (Section 4.8)
    # ==========================================
    # Complete Explanation Structure (JSON)
    # Stores the full explanation object matching the schemas
    explanation_json = Column(JSON, nullable=True)
    
    # Individual Explanation Components (for querying/analysis)
    shap_values = Column(JSON, nullable=True)        # SHAP feature contributions
    lime_values = Column(JSON, nullable=True)        # LIME feature weights
    gradcam_metadata = Column(JSON, nullable=True)   # Grad-CAM metadata
    
    # Path to the generated Grad-CAM heatmap image
    heatmap_path = Column(String, nullable=True)

    # ==========================================
    # 5. SYSTEM METRICS & PERFORMANCE
    # ==========================================
    # Proof of "Lightweight" performance (Thesis Section 4.10)
    computation_time = Column(Float, nullable=True)  # Inference latency in seconds
    
    # Additional metrics for system evaluation
    inference_success = Column(String, default="success")  # success, partial_failure, complete_failure
    error_message = Column(Text, nullable=True)           # If inference failed

    # ==========================================
    # 6. INDEXES FOR PERFORMANCE
    # ==========================================
    __table_args__ = (
        # Index for timestamp-based queries (common in history views)
        Index('ix_predictions_timestamp', 'timestamp'),
        
        # Index for risk level filtering (common in clinical dashboards)
        Index('ix_predictions_risk_level', 'risk_level'),
        
        # Index for mode-based queries (analyzing usage patterns)
        Index('ix_predictions_mode', 'mode'),
        
        # Index for prediction outcome (clinical statistics)
        Index('ix_predictions_prediction', 'prediction'),
        
        # Composite index for common query patterns
        Index('ix_predictions_timestamp_mode', 'timestamp', 'mode'),
    )

    def to_dict(self):
        """Convert model to dictionary for API responses."""
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "model_version": self.model_version,
            "mode": self.mode,
            "age": self.age,
            "sex": self.sex,
            "prediction": self.prediction,
            "confidence_score": self.confidence_score,
            "risk_level": self.risk_level,
            "clinical_score": self.clinical_score,
            "image_score": self.image_score,
            "heatmap_path": self.heatmap_path,
            "computation_time": self.computation_time,
            "filename": self.filename,
            # Include explanation if it exists
            "explanation": self.explanation_json if self.explanation_json else None
        }

    def get_explanation_summary(self):
        """Get a human-readable summary of the explanation."""
        if not self.explanation_json:
            return "No explanation available"
        
        mode = self.explanation_json.get("mode", "unknown")
        note = self.explanation_json.get("note", "")
        
        if mode == "clinical_only":
            shap = self.explanation_json.get("shap", {})
            top_features = shap.get("top_positive_features", [])
            if top_features:
                return f"{note} Top factors: {', '.join(top_features[:2])}"
            return note
            
        elif mode == "image_only":
            gradcam = self.explanation_json.get("grad_cam", {})
            regions = gradcam.get("attention_regions", [])
            if regions:
                return f"{note} Focus areas: {', '.join(regions)}"
            return note
            
        elif mode == "fusion":
            clinical_weight = self.explanation_json.get("clinical_weight", 0.5)
            image_weight = self.explanation_json.get("image_weight", 0.5)
            return f"{note} Clinical weight: {clinical_weight:.0%}, Image weight: {image_weight:.0%}"
        
        return note

    def __repr__(self):
        return (f"<Prediction(id={self.id}, mode={self.mode}, "
                f"result={self.prediction}, conf={self.confidence_score:.2f}, "
                f"risk={self.risk_level})>")