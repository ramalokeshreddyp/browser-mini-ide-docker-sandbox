import json
import logging
import signal
import sys
import time
import threading
import redis

try:
    from config import REDIS_URL, QUEUE_NAME, WORKER_CONCURRENCY
    from runner import SandboxRunner
except ImportError:
    from backend.worker.config import REDIS_URL, QUEUE_NAME, WORKER_CONCURRENCY
    from backend.worker.runner import SandboxRunner

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s")
logger = logging.getLogger("worker")

running = True


def signal_handler(signum, frame):
    global running
    logger.info("Shutdown signal received. Stopping worker...")
    running = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def heartbeat_thread(r: redis.Redis):
    """Updates a heartbeat key in Redis and touches health file."""
    while running:
        try:
            r.set("worker_heartbeat", str(time.time()), ex=10)
            with open("/tmp/worker_health", "w") as f:
                f.write("ok")
        except Exception:
            pass
        time.sleep(2)


def main():
    logger.info(f"Connecting to Redis at {REDIS_URL}...")
    r = redis.from_url(REDIS_URL, decode_responses=True)

    # Verify Redis connection
    retries = 15
    while retries > 0:
        try:
            r.ping()
            logger.info("Successfully connected to Redis broker.")
            break
        except Exception as e:
            logger.warning(f"Waiting for Redis ({e})... retrying in 2s")
            time.sleep(2)
            retries -= 1

    if retries == 0:
        logger.error("Could not connect to Redis. Exiting.")
        sys.exit(1)

    runner = SandboxRunner(r)

    # Start heartbeat thread
    hb = threading.Thread(target=heartbeat_thread, args=(r,), daemon=True)
    hb.start()

    logger.info(f"Worker started. Listening for jobs on queue: '{QUEUE_NAME}'...")

    while running:
        try:
            # Blocking pop with 1-second timeout to allow graceful shutdown
            item = r.brpop(QUEUE_NAME, timeout=1)
            if item is None:
                continue

            queue_name, job_raw = item
            logger.info(f"Received job from queue '{queue_name}'")

            try:
                job_data = json.loads(job_raw)
                runner.run_job(job_data)
            except Exception as e:
                logger.error(f"Error processing job: {e}", exc_info=True)

        except redis.ConnectionError as ce:
            logger.error(f"Redis connection error: {ce}. Retrying in 2s...")
            time.sleep(2)
        except Exception as ex:
            logger.error(f"Unexpected error in worker loop: {ex}", exc_info=True)
            time.sleep(1)

    logger.info("Worker stopped cleanly.")


if __name__ == "__main__":
    main()
