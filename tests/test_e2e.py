import pytest
import sys
import os
import re
import json
import yaml
import asyncio
from fastapi.testclient import TestClient

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, PROJECT_ROOT)

from backend.api.main import app
from backend.worker.runner import SandboxRunner


# ---------------------------------------------------------------------------
# Requirement 1 & 2: docker-compose.yml and .env.example verification
# ---------------------------------------------------------------------------

def test_req1_docker_compose_structure():
    """Requirement 1: Verify docker-compose.yml defines frontend, api, queue, worker with healthchecks."""
    compose_path = os.path.join(PROJECT_ROOT, "docker-compose.yml")
    assert os.path.exists(compose_path), "docker-compose.yml must exist at repository root"

    with open(compose_path, "r", encoding="utf-8") as f:
        compose_data = yaml.safe_load(f)

    services = compose_data.get("services", {})
    required_services = ["frontend", "api", "queue", "worker"]
    for svc in required_services:
        assert svc in services, f"Service '{svc}' must be defined in docker-compose.yml"

    # Health check validations
    assert "healthcheck" in services["api"], "api service must have a healthcheck"
    assert "healthcheck" in services["queue"], "queue service must have a healthcheck"
    assert "healthcheck" in services["worker"], "worker service must have a healthcheck"

    # Dependency validations
    assert "depends_on" in services["api"], "api must declare depends_on"
    assert "depends_on" in services["worker"], "worker must declare depends_on"


def test_req2_env_example_format():
    """Requirement 2: Verify .env.example exists and follows standard KEY=VALUE format."""
    env_path = os.path.join(PROJECT_ROOT, ".env.example")
    assert os.path.exists(env_path), ".env.example must exist at repository root"

    with open(env_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    parsed_vars = {}
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            assert "=" in stripped, f"Invalid env line: {stripped}"
            key, val = stripped.split("=", 1)
            parsed_vars[key.strip()] = val.strip()

    required_keys = ["API_PORT", "REDIS_HOST", "REDIS_PORT", "REDIS_URL", "EXECUTION_TIMEOUT", "FRONTEND_PORT"]
    for k in required_keys:
        assert k in parsed_vars, f"Missing required env variable '{k}' in .env.example"


# ---------------------------------------------------------------------------
# Requirements 3-8, 17: Frontend UI & TestID attributes verification
# ---------------------------------------------------------------------------

def test_req3_to_8_and_17_frontend_data_testids():
    """Verify all contract data-testid attributes are present in the frontend source code."""
    frontend_src = os.path.join(PROJECT_ROOT, "frontend", "src")
    
    all_content = ""
    for root, dirs, files in os.walk(frontend_src):
        for f in files:
            if f.endswith((".tsx", ".ts", ".html")):
                with open(os.path.join(root, f), "r", encoding="utf-8") as src_file:
                    all_content += src_file.read() + "\n"

    required_testids = [
        "file-tree-container",     # Req 3: File tree container
        "file-item-",              # Req 3: File item prefix
        "folder-item-",            # Req 3: Folder item prefix
        "create-file-button",      # Req 4: Create file action
        "create-folder-button",    # Req 4: Create folder action
        "delete-item-button",      # Req 4: Delete item action
        "rename-item-input",       # Req 4: Rename item action
        "editor-tabs-container",   # Req 5: Editor tabs container
        "editor-tab-",             # Req 5: Individual editor tab prefix
        "language-selector",       # Req 6: Language selector control
        "run-button",              # Req 7: Run button
        "terminal-output",         # Req 7: Terminal output panel
        "template-python-api",     # Req 8: Template 1
        "template-js-cli",         # Req 8: Template 2
        "template-python-script",  # Req 8: Template 3
        "export-zip-button",       # Req 17: Export ZIP button
    ]

    for testid in required_testids:
        assert testid in all_content, f"data-testid '{testid}' must be present in frontend codebase"


def test_req6_language_selector_options():
    """Requirement 6: Verify language selector contains options for Python and JavaScript."""
    header_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "Header.tsx")
    with open(header_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert 'value="python"' in content and 'Python' in content
    assert 'value="javascript"' in content and 'JavaScript' in content


def test_req8_starter_templates_count():
    """Requirement 8: Verify at least 3 starter templates are configured."""
    template_path = os.path.join(PROJECT_ROOT, "frontend", "src", "templates.ts")
    with open(template_path, "r", encoding="utf-8") as tf:
        template_content = tf.read()
    testids = re.findall(r"testId:\s*'([^']+)'", template_content)
    assert len(testids) >= 3, f"Expected at least 3 templates, found {len(testids)}"


# ---------------------------------------------------------------------------
# Requirements 9-11: API Gateway, Validation, and Health Check
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    return TestClient(app)


def test_req11_health_check_endpoint(client):
    """Requirement 11: GET /health returns 200 OK with {'status': 'ok'}."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_req9_and_10_api_run_validation(client):
    """Requirements 9 & 10: POST /api/v1/run accepts valid payload and rejects invalid inputs."""
    # 1. Valid Python execution job
    valid_payload = {
        "language": "python",
        "files": [
            {"path": "main.py", "content": "print('test e2e')"}
        ]
    }
    res = client.post("/api/v1/run", json=valid_payload)
    assert res.status_code == 202, "Valid run request must return 202 Accepted"
    body = res.json()
    assert "job_id" in body and isinstance(body["job_id"], str)

    # 2. Invalid language ("ruby") -> 400 Bad Request
    invalid_lang_payload = {
        "language": "ruby",
        "files": [{"path": "main.rb", "content": "puts 'hello'"}]
    }
    res_lang = client.post("/api/v1/run", json=invalid_lang_payload)
    assert res_lang.status_code == 400, "Unsupported language must return 400 Bad Request"

    # 3. Empty files array -> 400 Bad Request
    empty_files_payload = {
        "language": "python",
        "files": []
    }
    res_empty = client.post("/api/v1/run", json=empty_files_payload)
    assert res_empty.status_code == 400, "Empty files array must return 400 Bad Request"


# ---------------------------------------------------------------------------
# Requirements 13-16, 18: Multi-File Execution, Streaming, Exit, Timeout
# ---------------------------------------------------------------------------

class EventCollector:
    def __init__(self):
        self.events = []

    def publish(self, channel, message):
        self.events.append(json.loads(message))

    def rpush(self, key, message):
        pass

    def expire(self, key, seconds):
        pass


def test_req13_15_16_python_multifile_execution():
    """Requirements 13, 15, 16: Python multi-file execution with local imports and real-time stdout streaming."""
    collector = EventCollector()
    runner = SandboxRunner(collector)

    job_data = {
        "job_id": "e2e-py-multifile",
        "language": "python",
        "files": [
            {
                "path": "main.py",
                "content": "from utils import greet\nprint(greet('World'))",
            },
            {
                "path": "utils.py",
                "content": "def greet(name):\n    return f'Hello, {name}!'",
            },
        ],
    }

    runner.run_job(job_data)

    # Verify stdout streaming schema: { "stream": "stdout", "data": "Hello, World!\n" }
    stdout_events = [e for e in collector.events if e.get("stream") == "stdout"]
    assert len(stdout_events) >= 1
    combined_stdout = "".join(e["data"] for e in stdout_events)
    assert "Hello, World!" in combined_stdout

    # Verify exit event schema: { "stream": "system", "event": "exit", "code": 0 }
    exit_events = [e for e in collector.events if e.get("stream") == "system" and e.get("event") == "exit"]
    assert len(exit_events) == 1
    assert exit_events[0]["code"] == 0


def test_req13_15_16_javascript_multifile_execution():
    """Requirements 13, 15, 16: JavaScript multi-file execution with ES Module imports."""
    collector = EventCollector()
    runner = SandboxRunner(collector)

    job_data = {
        "job_id": "e2e-js-multifile",
        "language": "javascript",
        "files": [
            {
                "path": "index.js",
                "content": "import { greet } from './utils.js';\nconsole.log(greet('World'));",
            },
            {
                "path": "utils.js",
                "content": "export const greet = (name) => `Hello, ${name}!`;",
            },
        ],
    }

    runner.run_job(job_data)

    stdout_events = [e for e in collector.events if e.get("stream") == "stdout"]
    assert len(stdout_events) >= 1
    combined_stdout = "".join(e["data"] for e in stdout_events)
    assert "Hello, World!" in combined_stdout

    exit_events = [e for e in collector.events if e.get("stream") == "system" and e.get("event") == "exit"]
    assert len(exit_events) == 1
    assert exit_events[0]["code"] == 0


def test_req14_stderr_streaming():
    """Requirement 14: Verify stderr streams with schema { "stream": "stderr", "data": "<chunk>" }."""
    collector = EventCollector()
    runner = SandboxRunner(collector)

    job_data = {
        "job_id": "e2e-stderr-test",
        "language": "python",
        "files": [
            {
                "path": "main.py",
                "content": "import sys\nsys.stderr.write('E2E Stderr Test Output\\n')",
            }
        ],
    }

    runner.run_job(job_data)

    stderr_events = [e for e in collector.events if e.get("stream") == "stderr"]
    assert len(stderr_events) >= 1
    combined_stderr = "".join(e["data"] for e in stderr_events)
    assert "E2E Stderr Test Output" in combined_stderr


def test_req18_timeout_enforcement(monkeypatch):
    """Requirement 18: Verify 30-second timeout emits { "stream": "system", "event": "error", "message": "Execution timed out after 30 seconds." }."""
    import backend.worker.runner as runner_module
    monkeypatch.setattr(runner_module, "EXECUTION_TIMEOUT", 1)

    collector = EventCollector()
    runner = SandboxRunner(collector)

    job_data = {
        "job_id": "e2e-timeout-test",
        "language": "python",
        "files": [
            {
                "path": "main.py",
                "content": "import time\ntime.sleep(10)",
            }
        ],
    }

    runner.run_job(job_data)

    timeout_events = [e for e in collector.events if e.get("stream") == "system" and e.get("event") == "error"]
    assert len(timeout_events) >= 1
    assert "Execution timed out" in timeout_events[0]["message"]
