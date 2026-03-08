from fastapi.testclient import TestClient
from app.main import app
import json

client = TestClient(app)

def test_clinical_prediction():
    """Test making a clinical-only prediction"""
    clinical_data = {
        "Age": 30,
        "Sex": "Male",
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
    
    # Check response
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields exist
    assert "prediction" in data
    assert "confidence_score" in data
    assert "risk_level" in data
    assert "mode" in data
    
    # Check values are valid
    assert data["prediction"] in ["Infected", "Uninfected"]
    assert 0 <= data["confidence_score"] <= 1
    assert data["risk_level"] in ["Low", "Moderate", "High"]
    assert data["mode"] == "clinical_only"
    