from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Prediction
import json

client = TestClient(app)

def test_prediction_saved_to_database():
    """Test that predictions are actually saved in the database"""
    
    # Get initial count
    db = SessionLocal()
    initial_count = db.query(Prediction).count()
    db.close()
    
    # Make a prediction
    clinical_data = {
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
        "Joint_Pain": 0
    }
    
    response = client.post(
        "/predict",
        data={"clinical_data": json.dumps(clinical_data)}
    )
    assert response.status_code == 200
    prediction_data = response.json()
    
    # Check database count increased
    db = SessionLocal()
    new_count = db.query(Prediction).count()
    db.close()
    
    assert new_count == initial_count + 1
    print(f"✅ Prediction saved! ID: {prediction_data.get('id')}")

    