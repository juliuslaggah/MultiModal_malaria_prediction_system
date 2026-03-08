from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_history_endpoint():
    """Test the history endpoint returns a list"""
    response = client.get("/history")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)