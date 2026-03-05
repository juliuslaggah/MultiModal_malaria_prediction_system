import json
import os
import uuid
import base64
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import time
from sqlalchemy import func


# Import internal modules
from . import schemas, models, database
from .ml_service import MalariaPredictor
from .utils import validate_image_bytes, setup_logger
from datetime import datetime

# ==========================================
# 1. SETUP
# ==========================================
router = APIRouter()

# Initialize ML Service (Loads ShuffleNet & XGBoost)
predictor = MalariaPredictor()

# Setup logger for auditability
logger = setup_logger("malaria_api")

# Directory setup for Auditability (Saving images for history)
UPLOAD_DIR = "app/static/uploads"
HEATMAP_DIR = "app/static/heatmaps"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(HEATMAP_DIR, exist_ok=True)

# ==========================================
# 2. HELPER FUNCTIONS
# ==========================================

def extract_explanation_components(explanation: dict):
    """Extract individual explanation components for database storage."""
    components = {
        "shap_values": None,
        "lime_values": None,
        "gradcam_metadata": None
    }
    
    if not explanation:
        return components
    
    # Extract SHAP values
    if "shap" in explanation and explanation["shap"]:
        shap_data = explanation["shap"]
        components["shap_values"] = {
            "feature_contributions": shap_data.get("feature_contributions", {}),
            "base_value": shap_data.get("base_value"),
            "top_features": {
                "positive": shap_data.get("top_positive_features", []),
                "negative": shap_data.get("top_negative_features", [])
            }
        }
    
    # Extract LIME values
    if "lime" in explanation and explanation["lime"]:
        lime_data = explanation["lime"]
        components["lime_values"] = {
            "local_prediction": lime_data.get("local_prediction"),
            "feature_weights": lime_data.get("feature_weights", {}),
            "interpretable_features": lime_data.get("interpretable_features", [])
        }
    
    # Extract Grad-CAM metadata
    if "grad_cam" in explanation and explanation["grad_cam"]:
        gradcam_data = explanation["grad_cam"]
        components["gradcam_metadata"] = {
            "heatmap_generated": gradcam_data.get("heatmap_generated", False),
            "attention_regions": gradcam_data.get("attention_regions", []),
            "confidence_in_visual": gradcam_data.get("confidence_in_visual", 0.0)
        }
    
    return components

# ==========================================
# 3. ENDPOINTS
# ==========================================

@router.post("/predict", response_model=schemas.PredictionResponse)
async def predict(
    clinical_data: Optional[str] = Form(None), 
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(database.get_db)
):
    """
    Unified Inference Endpoint supporting three operational modes:
    1. Clinical-only prediction (when clinical_data provided, file=None)
    2. Image-only prediction (when file provided, clinical_data=None)
    3. Fusion prediction (when both provided)
    
    Aligns with Thesis Section 4.2.1: Flexible operational modes for low-resource settings.
    """
    request_start = time.time()
    request_id = str(uuid.uuid4())
    
    try:
        logger.info(f"📥 Request {request_id}: Starting prediction")
        
        # --- A. VALIDATE AT LEAST ONE INPUT PROVIDED ---
        if clinical_data is None and file is None:
            error_msg = "At least one of clinical_data or image file must be provided"
            logger.warning(f"Request {request_id}: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        clinical_validated = None
        image_bytes = None
        filename_original = None
        heatmap_filename = None
        clinical_dict = None
        
        # --- B. PROCESS CLINICAL DATA (IF PROVIDED) ---
        if clinical_data is not None:
            try:
                clinical_dict = json.loads(clinical_data)
                clinical_validated = schemas.ClinicalDataInput(**clinical_dict)
                logger.info(f"Request {request_id}: Clinical data validated - Age: {clinical_validated.Age}, Sex: {clinical_validated.Sex}")
            except json.JSONDecodeError as e:
                error_msg = f"Invalid JSON in clinical_data: {e}"
                logger.error(f"Request {request_id}: {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)
            except Exception as e:
                error_msg = f"Invalid clinical data: {e}"
                logger.error(f"Request {request_id}: {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)
        
        # --- C. PROCESS IMAGE FILE (IF PROVIDED) ---
        if file is not None:
            try:
                # Validate image
                image_bytes = await file.read()
                if not validate_image_bytes(image_bytes):
                    error_msg = "Invalid or corrupted image file"
                    logger.error(f"Request {request_id}: {error_msg}")
                    raise HTTPException(status_code=400, detail=error_msg)
                
                # Save image for audit trail
                file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
                filename_original = f"{request_id}_orig.{file_extension}"
                path_original = os.path.join(UPLOAD_DIR, filename_original)
                
                with open(path_original, "wb") as f:
                    f.write(image_bytes)
                
                logger.info(f"Request {request_id}: Image saved - {filename_original}")
                
            except Exception as e:
                error_msg = f"Error processing image: {e}"
                logger.error(f"Request {request_id}: {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)
        
        # --- D. RUN INFERENCE (AUTOMATIC MODE SELECTION) ---
        logger.info(f"Request {request_id}: Starting inference")
        inference_start = time.time()
        
        try:
            result = predictor.predict(
                clinical_data=clinical_validated.model_dump() if clinical_validated else None,
                image_bytes=image_bytes
            )
            inference_time = time.time() - inference_start
            result["computation_time"] = inference_time
            logger.info(f"Request {request_id}: Inference completed in {inference_time:.3f}s")
            
        except Exception as e:
            error_msg = f"Inference failed: {e}"
            logger.error(f"Request {request_id}: {error_msg}")
            raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
        
        # --- E. HANDLE HEATMAP (IF GENERATED) ---
        heatmap_base64 = result.get("heatmap_base64")
        if heatmap_base64:
            try:
                # Save heatmap to disk for history
                heatmap_filename = f"{request_id}_cam.jpg"
                path_heatmap = os.path.join(HEATMAP_DIR, heatmap_filename)
                
                with open(path_heatmap, "wb") as f:
                    f.write(base64.b64decode(heatmap_base64))
                
                logger.info(f"Request {request_id}: Heatmap saved - {heatmap_filename}")
            except Exception as e:
                logger.warning(f"Request {request_id}: Failed to save heatmap: {e}")
        
        # --- F. EXTRACT EXPLANATION COMPONENTS ---
        explanation = result.get("explanation", {})
        explanation_components = extract_explanation_components(explanation)
        
        # --- G. SAVE TO DATABASE (FULL AUDIT TRAIL) ---
        try:
            db_record = models.Prediction(
                # Metadata
                filename=filename_original,
                heatmap_path=heatmap_filename,
                mode=result.get("mode", "unknown"),
                
                # Clinical Info (if provided)
                age=clinical_validated.Age if clinical_validated else None,
                sex=clinical_validated.Sex if clinical_validated else None,
                clinical_data_snapshot=clinical_dict if clinical_data else None,
                
                # Inference Results
                prediction=result['prediction'],
                confidence_score=result['confidence_score'],
                clinical_score=result['clinical_score'],
                image_score=result['image_score'],
                risk_level=result['risk_level'],
                
                # Explainability
                explanation_json=explanation,
                shap_values=explanation_components["shap_values"],
                lime_values=explanation_components["lime_values"],
                gradcam_metadata=explanation_components["gradcam_metadata"],
                
                # System Metrics
                model_version=result.get('model_version', 'unknown'),
                computation_time=result.get('computation_time'),
                inference_success="success",
                error_message=None
            )
            
            db.add(db_record)
            db.commit()
            db.refresh(db_record)
            
            total_time = time.time() - request_start
            logger.info(f"Request {request_id}: Complete - ID: {db_record.id}, Prediction: {result['prediction']}, "
                       f"Confidence: {result['confidence_score']:.2f}, Total time: {total_time:.3f}s")
            
        except Exception as e:
            logger.error(f"Request {request_id}: Database save failed: {e}")
            # Don't raise here - we still want to return the result to the user
            # The prediction was successful even if database save failed
        
        # --- H. RETURN RESPONSE ---
        response_data = {
            "id": db_record.id if 'db_record' in locals() else None,
            "timestamp": db_record.timestamp if ('db_record' in locals() and db_record.timestamp is not None) else datetime.now(),
            "prediction": result['prediction'],
            "confidence_score": result['confidence_score'],
            "risk_level": result['risk_level'],
            "clinical_score": result['clinical_score'],
            "image_score": result['image_score'],
            "heatmap_path": result.get('heatmap_path'),
            "heatmap_base64": heatmap_base64,
            "explanation": explanation,
            "model_version": result.get('model_version', 'unknown'),
            "mode": result.get('mode', 'unknown'),
            "computation_time": result.get('computation_time')
        }
        
        # Convert explanation to appropriate schema type
        # This will be validated by the Pydantic schema
        return response_data

    except HTTPException:
        # Log HTTP exceptions
        total_time = time.time() - request_start
        logger.warning(f"Request {request_id}: HTTP Exception - Time: {total_time:.3f}s")
        raise
        
    except Exception as e:
        # Log unexpected errors
        total_time = time.time() - request_start
        logger.error(f"Request {request_id}: Unexpected error: {e} - Time: {total_time:.3f}s")
        
        # Save error to database if possible
        try:
            error_record = models.Prediction(
                mode="error",
                prediction="Error",
                confidence_score=0.0,
                risk_level="Unknown",
                clinical_score=None,
                image_score=None,
                inference_success="complete_failure",
                error_message=str(e),
                computation_time=time.time() - request_start
            )
            db.add(error_record)
            db.commit()
        except:
            pass  # If database is also failing, just continue
        
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/history", response_model=list[schemas.PredictionRecord])
def read_history(
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(database.get_db)
):
    """
    Retrieves past predictions for the 'History' tab.
    Supports Thesis Section 4.9: Auditability and Traceability.
    """
    try:
        predictions = db.query(models.Prediction)\
            .filter(models.Prediction.inference_success == "success")\
            .order_by(models.Prediction.timestamp.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
        
        logger.info(f"History request: Returning {len(predictions)} predictions")
        return predictions
        
    except Exception as e:
        logger.error(f"History request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve history: {str(e)}")


@router.get("/health")
async def health_check(db: Session = Depends(database.get_db)):
    """
    Health check endpoint for deployment monitoring.
    Returns system status and basic statistics.
    """
    try:
        # Get basic statistics
        total_predictions = db.query(models.Prediction).count()
        successful_predictions = db.query(models.Prediction)\
            .filter(models.Prediction.inference_success == "success").count()
        
        # Get mode distribution
        clinical_count = db.query(models.Prediction)\
            .filter(models.Prediction.mode == "clinical_only").count()
        image_count = db.query(models.Prediction)\
            .filter(models.Prediction.mode == "image_only").count()
        fusion_count = db.query(models.Prediction)\
            .filter(models.Prediction.mode == "fusion").count()
        
        # Get average computation time
        avg_time_result = db.query(func.avg(models.Prediction.computation_time))\
            .filter(models.Prediction.computation_time.isnot(None))\
            .scalar()
        avg_time = float(avg_time_result) if avg_time_result else 0.0
        
        return {
            "status": "healthy",
            "service": "Malaria Multimodal Diagnostic System",
            "timestamp": time.time(),
            "statistics": {
                "total_predictions": total_predictions,
                "successful_predictions": successful_predictions,
                "success_rate": successful_predictions / total_predictions if total_predictions > 0 else 0,
                "mode_distribution": {
                    "clinical_only": clinical_count,
                    "image_only": image_count,
                    "fusion": fusion_count
                },
                "average_inference_time": round(avg_time, 3)
            },
            "model_architecture": "Late Fusion (ShuffleNetV2 + XGBoost)",
            "operational_modes": ["clinical_only", "image_only", "fusion"],
            "explainability": ["SHAP", "LIME", "Grad-CAM"],
            "database": "connected" if total_predictions >= 0 else "disconnected"
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "degraded",
            "error": str(e),
            "timestamp": time.time()
        }


@router.get("/predictions/{prediction_id}")
async def get_prediction(prediction_id: int, db: Session = Depends(database.get_db)):
    """
    Get detailed information about a specific prediction.
    Includes full explanation data.
    """
    try:
        prediction = db.query(models.Prediction)\
            .filter(models.Prediction.id == prediction_id)\
            .first()
        
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")
        
        logger.info(f"Retrieved prediction {prediction_id}")
        return prediction.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve prediction {prediction_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve prediction: {str(e)}")