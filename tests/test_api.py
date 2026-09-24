import pytest
import sys
import os
from fastapi.testclient import TestClient

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.api.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    """Verify /health endpoint returns 200 OK with {'status': 'ok'}."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_run_valid_python_request(client):
    """Verify /api/v1/run accepts valid Python request and returns 202 with job_id."""
    payload = {
        "language": "python",
        "files": [
            {
                "path": "main.py",
                "content": "print('hello')"
            }
        ]
    }
    response = client.post("/api/v1/run", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert isinstance(data["job_id"], str)
    assert len(data["job_id"]) > 0


def test_run_valid_javascript_request(client):
    """Verify /api/v1/run accepts valid JavaScript request and returns 202 with job_id."""
    payload = {
        "language": "javascript",
        "files": [
            {
                "path": "index.js",
                "content": "console.log('hello');"
            }
        ]
    }
    response = client.post("/api/v1/run", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data


def test_run_unsupported_language(client):
    """Verify /api/v1/run rejects unsupported languages with 400 Bad Request."""
    payload = {
        "language": "ruby",
        "files": [
            {
                "path": "main.rb",
                "content": "puts 'hello'"
            }
        ]
    }
    response = client.post("/api/v1/run", json=payload)
    assert response.status_code == 400
    assert "Unsupported language" in response.json()["detail"]


def test_run_empty_files_list(client):
    """Verify /api/v1/run rejects empty files array with 400 Bad Request."""
    payload = {
        "language": "python",
        "files": []
    }
    response = client.post("/api/v1/run", json=payload)
    assert response.status_code == 400
    assert "Files array cannot be empty" in response.json()["detail"]
