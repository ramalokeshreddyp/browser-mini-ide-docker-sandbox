import pytest
import sys
import os
import json
from unittest.mock import MagicMock

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.worker.runner import SandboxRunner


class MockRedis:
    def __init__(self):
        self.published = []
        self.history = []

    def publish(self, channel, message):
        self.published.append((channel, json.loads(message)))

    def rpush(self, key, message):
        self.history.append((key, json.loads(message)))

    def expire(self, key, seconds):
        pass


def test_multifile_python_execution():
    """Verify runner properly executes multi-file Python project with local imports."""
    mock_redis = MockRedis()
    runner = SandboxRunner(mock_redis)

    job_data = {
        "job_id": "test-py-1",
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

    # Inspect captured events
    stdout_messages = [
        msg["data"]
        for ch, msg in mock_redis.published
        if msg.get("stream") == "stdout"
    ]
    all_stdout = "".join(stdout_messages)
    assert "Hello, World!" in all_stdout

    # Verify exit message
    exit_messages = [
        msg
        for ch, msg in mock_redis.published
        if msg.get("stream") == "system" and msg.get("event") == "exit"
    ]
    assert len(exit_messages) == 1
    assert exit_messages[0]["code"] == 0


def test_multifile_javascript_execution():
    """Verify runner properly executes multi-file JS project with local imports."""
    mock_redis = MockRedis()
    runner = SandboxRunner(mock_redis)

    job_data = {
        "job_id": "test-js-1",
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

    stdout_messages = [
        msg["data"]
        for ch, msg in mock_redis.published
        if msg.get("stream") == "stdout"
    ]
    all_stdout = "".join(stdout_messages)
    assert "Hello, World!" in all_stdout

    exit_messages = [
        msg
        for ch, msg in mock_redis.published
        if msg.get("stream") == "system" and msg.get("event") == "exit"
    ]
    assert len(exit_messages) == 1
    assert exit_messages[0]["code"] == 0


def test_stderr_capture():
    """Verify stderr is captured and streamed with proper schema."""
    mock_redis = MockRedis()
    runner = SandboxRunner(mock_redis)

    job_data = {
        "job_id": "test-err-1",
        "language": "python",
        "files": [
            {
                "path": "main.py",
                "content": "import sys\nsys.stderr.write('Custom Error Message\\n')",
            }
        ],
    }

    runner.run_job(job_data)

    stderr_messages = [
        msg["data"]
        for ch, msg in mock_redis.published
        if msg.get("stream") == "stderr"
    ]
    all_stderr = "".join(stderr_messages)
    assert "Custom Error Message" in all_stderr


def test_timeout_handling(monkeypatch):
    """Verify timeout triggers expected error event with exact message schema."""
    import backend.worker.runner as runner_module
    monkeypatch.setattr(runner_module, "EXECUTION_TIMEOUT", 1)

    mock_redis = MockRedis()
    runner = SandboxRunner(mock_redis)

    job_data = {
        "job_id": "test-timeout-1",
        "language": "python",
        "files": [
            {
                "path": "main.py",
                "content": "import time\ntime.sleep(5)",
            }
        ],
    }

    runner.run_job(job_data)

    timeout_events = [
        msg
        for ch, msg in mock_redis.published
        if msg.get("stream") == "system" and msg.get("event") == "error"
    ]
    assert len(timeout_events) >= 1
    assert "Execution timed out" in timeout_events[0]["message"]

