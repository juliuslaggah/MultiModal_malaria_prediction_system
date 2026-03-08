from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_history_returns_data():
    """Test that history endpoint returns predictions"""
    response = client.get("/history")
    assert response.status_code == 200
    data = response.json()
    
    # If there are predictions, check they have the right structure
    if len(data) > 0:
        first_prediction = data[0]
        assert "id" in first_prediction
        assert "prediction" in first_prediction
        assert "confidence_score" in first_prediction
        