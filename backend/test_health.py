"""
Tests for /health endpoint (AA-1)
"""
import pytest
from app import app


@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_health_returns_200(client):
    """
    Acceptance Criterion: GET /health returns HTTP 200
    """
    response = client.get('/health')
    assert response.status_code == 200


def test_health_returns_json_content_type(client):
    """
    Acceptance Criterion: Response Content-Type header is application/json
    """
    response = client.get('/health')
    assert response.content_type == 'application/json'


def test_health_returns_correct_body(client):
    """
    Acceptance Criterion: Response body is exactly {"status": "ok"}
    """
    response = client.get('/health')
    assert response.get_json() == {"status": "ok"}
