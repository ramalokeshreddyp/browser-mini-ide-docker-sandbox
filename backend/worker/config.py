import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QUEUE_NAME = os.getenv("QUEUE_NAME", "code_execution_queue")
EXECUTION_TIMEOUT = int(os.getenv("EXECUTION_TIMEOUT", "30"))
DOCKER_PYTHON_IMAGE = os.getenv("DOCKER_PYTHON_IMAGE", "python:3.10-slim")
DOCKER_NODE_IMAGE = os.getenv("DOCKER_NODE_IMAGE", "node:18-alpine")
WORKER_CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "2"))
DOCKER_HOST = os.getenv("DOCKER_HOST", "")
HOST_TEMP_DIR = os.getenv("HOST_TEMP_DIR", "")
