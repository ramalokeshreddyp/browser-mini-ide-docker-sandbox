import os
import sys
import shutil
import tempfile
import time
import json
import logging
import threading
import subprocess
from typing import Dict, Any, List, Optional
import redis
import docker
from docker.errors import DockerException, APIError

try:
    from config import (
        REDIS_URL,
        EXECUTION_TIMEOUT,
        DOCKER_PYTHON_IMAGE,
        DOCKER_NODE_IMAGE,
    )
except ImportError:
    from backend.worker.config import (
        REDIS_URL,
        EXECUTION_TIMEOUT,
        DOCKER_PYTHON_IMAGE,
        DOCKER_NODE_IMAGE,
    )

logger = logging.getLogger("sandbox_runner")
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] %(message)s")


class SandboxRunner:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.docker_client: Optional[docker.DockerClient] = None
        self._init_docker()

    def _init_docker(self):
        self.docker_client = None
        if os.getenv("DISABLE_DOCKER", "false").lower() in ("1", "true"):
            return

        # Connect if docker.sock exists or explicitly enabled
        if os.path.exists("/var/run/docker.sock") or os.getenv("DOCKER_HOST") or os.getenv("ENABLE_DOCKER_LOCAL") == "true":
            try:
                client = docker.from_env(timeout=2)
                if client.ping():
                    self.docker_client = client
                    logger.info("Successfully connected to Docker daemon.")
            except Exception as e:
                logger.info(f"Docker daemon not available: {e}. Using subprocess.")
                self.docker_client = None

    def publish_event(self, job_id: str, payload: Dict[str, Any]):
        """Publish message to Redis pubsub and append to history list."""
        channel_name = f"job_output:{job_id}"
        history_key = f"job_history:{job_id}"
        json_str = json.dumps(payload)
        try:
            self.redis.publish(channel_name, json_str)
            self.redis.rpush(history_key, json_str)
            self.redis.expire(history_key, 300)  # Expire history after 5 minutes
        except Exception as e:
            logger.error(f"Failed to publish event for job {job_id}: {e}")

    def determine_entrypoint(self, language: str, files: List[Dict[str, str]]) -> str:
        """Determines the main file to execute."""
        file_paths = [f["path"].replace("\\", "/") for f in files]

        if language == "python":
            if "main.py" in file_paths:
                return "main.py"
            for p in file_paths:
                if p.endswith(".py"):
                    return p
            return "main.py"
        elif language == "javascript":
            if "index.js" in file_paths:
                return "index.js"
            if "main.js" in file_paths:
                return "main.js"
            for p in file_paths:
                if p.endswith(".js"):
                    return p
            return "index.js"
        return "main.py"

    def prepare_workspace(self, temp_dir: str, language: str, files: List[Dict[str, str]]):
        """Writes project files to the temporary workspace directory."""
        has_package_json = False
        for file_info in files:
            rel_path = file_info.get("path", "").lstrip("/\\")
            content = file_info.get("content", "")

            if rel_path == "package.json":
                has_package_json = True

            full_path = os.path.join(temp_dir, rel_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

        # For JavaScript ES Module imports, ensure package.json with type: module exists
        if language == "javascript" and not has_package_json:
            pkg_path = os.path.join(temp_dir, "package.json")
            with open(pkg_path, "w", encoding="utf-8") as f:
                f.write(json.dumps({"type": "module"}, indent=2))

    def run_job(self, job_data: Dict[str, Any]):
        """Executes a code job inside a sandboxed environment."""
        job_id = job_data["job_id"]
        language = job_data["language"].lower()
        files = job_data.get("files", [])

        logger.info(f"Starting execution for job {job_id} (Language: {language}, Files: {len(files)})")

        temp_dir = tempfile.mkdtemp(prefix=f"ide_run_{job_id}_")

        try:
            self.prepare_workspace(temp_dir, language, files)
            entrypoint = self.determine_entrypoint(language, files)

            executed = False
            if self.docker_client:
                try:
                    self._run_with_docker(job_id, language, temp_dir, entrypoint)
                    executed = True
                except (DockerException, APIError, Exception) as de:
                    logger.warning(f"Docker execution failed ({de}). Falling back to isolated subprocess.")
                    executed = False

            if not executed:
                self._run_with_subprocess(job_id, language, temp_dir, entrypoint)

        except Exception as e:
            logger.error(f"Execution error for job {job_id}: {e}", exc_info=True)
            self.publish_event(
                job_id,
                {
                    "stream": "system",
                    "event": "error",
                    "message": f"Execution failed: {str(e)}",
                },
            )
        finally:
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Failed to remove temp dir {temp_dir}: {e}")

    def _run_with_docker(self, job_id: str, language: str, temp_dir: str, entrypoint: str):
        """Runs the project inside a secure, resource-limited Docker container."""
        image = DOCKER_PYTHON_IMAGE if language == "python" else DOCKER_NODE_IMAGE
        cmd = ["python", "-u", entrypoint] if language == "python" else ["node", entrypoint]

        container = None
        timed_out = False

        try:
            # Ensure image exists or pull
            try:
                self.docker_client.images.get(image)
            except docker.errors.ImageNotFound:
                logger.info(f"Pulling Docker image {image}...")
                self.docker_client.images.pull(image)

            # Absolute path normalized for Docker volume mount
            abs_temp_dir = os.path.abspath(temp_dir)

            # Create isolated container with strict security settings
            container = self.docker_client.containers.create(
                image=image,
                command=cmd,
                working_dir="/workspace",
                volumes={
                    abs_temp_dir: {"bind": "/workspace", "mode": "rw"}
                },
                network_mode="none",             # Disable networking
                mem_limit="256m",                 # Memory limit
                nano_cpus=1000000000,             # 1 CPU
                pids_limit=64,                    # Prevent fork bombs
                user="1000:1000",                 # Non-root user
                stdin_open=False,
                tty=False,
                detach=True,
            )

            container.start()
            start_time = time.time()

            # Stream logs in real-time
            # Attach to stdout and stderr streams
            def stream_container_logs():
                try:
                    for chunk in container.logs(stdout=True, stderr=False, stream=True, follow=True):
                        if chunk:
                            text = chunk.decode("utf-8", errors="replace")
                            self.publish_event(job_id, {"stream": "stdout", "data": text})
                except Exception:
                    pass

            def stream_container_err():
                try:
                    for chunk in container.logs(stdout=False, stderr=True, stream=True, follow=True):
                        if chunk:
                            text = chunk.decode("utf-8", errors="replace")
                            self.publish_event(job_id, {"stream": "stderr", "data": text})
                except Exception:
                    pass

            t_out = threading.Thread(target=stream_container_logs)
            t_err = threading.Thread(target=stream_container_err)
            t_out.start()
            t_err.start()

            # Wait with timeout
            while container.status in ("created", "running"):
                elapsed = time.time() - start_time
                if elapsed > EXECUTION_TIMEOUT:
                    timed_out = True
                    break
                time.sleep(0.1)
                try:
                    container.reload()
                except Exception:
                    break

            if timed_out:
                try:
                    container.kill()
                except Exception:
                    pass
                t_out.join(timeout=1.0)
                t_err.join(timeout=1.0)
                self.publish_event(
                    job_id,
                    {
                        "stream": "system",
                        "event": "error",
                        "message": f"Execution timed out after {EXECUTION_TIMEOUT} seconds.",
                    },
                )
                return

            t_out.join(timeout=1.0)
            t_err.join(timeout=1.0)

            # Get exit code
            result = container.wait(timeout=2)
            exit_code = result.get("StatusCode", 0)

            self.publish_event(
                job_id,
                {
                    "stream": "system",
                    "event": "exit",
                    "code": exit_code,
                },
            )

        finally:
            if container:
                try:
                    container.remove(force=True)
                except Exception as e:
                    logger.warning(f"Error removing container for job {job_id}: {e}")

    def _run_with_subprocess(self, job_id: str, language: str, temp_dir: str, entrypoint: str):
        """Fallback execution using subprocess when Docker daemon is not directly accessible."""
        cmd = [sys.executable, "-u", entrypoint] if language == "python" else ["node", entrypoint]
        timed_out = False

        process = None
        try:
            process = subprocess.Popen(
                cmd,
                cwd=temp_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )

            def stream_pipe(pipe, stream_name):
                try:
                    for line in iter(pipe.readline, ""):
                        if not line:
                            break
                        self.publish_event(job_id, {"stream": stream_name, "data": line})
                except Exception:
                    pass
                finally:
                    try:
                        pipe.close()
                    except Exception:
                        pass

            t_out = threading.Thread(target=stream_pipe, args=(process.stdout, "stdout"), daemon=True)
            t_err = threading.Thread(target=stream_pipe, args=(process.stderr, "stderr"), daemon=True)
            t_out.start()
            t_err.start()

            start_time = time.time()
            while process.poll() is None:
                elapsed = time.time() - start_time
                if elapsed > EXECUTION_TIMEOUT:
                    timed_out = True
                    process.kill()
                    break
                time.sleep(0.05)

            t_out.join(timeout=1.0)
            t_err.join(timeout=1.0)

            if timed_out:
                self.publish_event(
                    job_id,
                    {
                        "stream": "system",
                        "event": "error",
                        "message": f"Execution timed out after {EXECUTION_TIMEOUT} seconds.",
                    },
                )
            else:
                self.publish_event(
                    job_id,
                    {
                        "stream": "system",
                        "event": "exit",
                        "code": process.returncode,
                    },
                )

        except Exception as e:
            self.publish_event(
                job_id,
                {
                    "stream": "system",
                    "event": "error",
                    "message": f"Execution error: {str(e)}",
                },
            )
