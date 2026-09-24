# Browser-Based Mini IDE with Docker Sandbox & Real-Time Output

A full-stack, distributed, browser-based Integrated Development Environment (IDE) for writing, managing, and executing multi-file Python and JavaScript projects in isolated Docker containers with real-time output streaming over WebSockets.

---

## 📑 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Key Features](#-key-features)
- [System Components](#-system-components)
- [Security & Sandboxing](#-security--sandboxing)
- [API & WebSocket Contracts](#-api--websocket-contracts)
- [Project Structure](#-project-structure)
- [Environment Configuration](#-environment-configuration)
- [Quick Start with Docker Compose](#-quick-start-with-docker-compose)
- [Running Automated Tests](#-running-automated-tests)
- [Workflow Guide](#-workflow-guide)

---

## 🏛 Architecture Overview

The system uses a decoupled, event-driven microservices architecture:

```
                                  ┌───────────────────────────────┐
                                  │      Browser Frontend         │
                                  │   (React + Monaco + Vite)     │
                                  └──────┬─────────────────▲──────┘
                                         │                 │
                           1. POST /api/v1/run    4. WebSocket /ws/run/{id}
                                         │                 │
                                         ▼                 │
                                  ┌─────────────┐          │
                                  │ FastAPI API │          │
                                  │   Gateway   │──────────┤
                                  └──────┬──────┘          │
                                         │                 │
                                  2. Enqueue Job   5. Stream Output
                                         │                 │
                                         ▼                 │
                                  ┌─────────────┐          │
                                  │ Redis Queue ├──────────┤
                                  │  & Pub/Sub  │          │
                                  └──────┬──────┘          │
                                         │                 │
                                  3. Dequeue Job           │
                                         ▼                 │
                                  ┌─────────────┐          │
                                  │   Sandbox   │──────────┘
                                  │   Worker    │
                                  └──────┬──────┘
                                         │
                         ┌───────────────┴───────────────┐
                         │                               │
                         ▼                               ▼
                 ┌───────────────┐               ┌───────────────┐
                 │ Docker Sandbox│               │ Docker Sandbox│
                 │ (Python 3.10) │               │ (Node.js 18)  │
                 │  --net=none   │               │  --net=none   │
                 │  --mem=256m   │               │  --mem=256m   │
                 └───────────────┘               └───────────────┘
```

### Execution Flow:
1. **Initiation**: The user edits files in the browser and clicks **Run Code**. The frontend packages the project file tree and selected language into a JSON payload.
2. **API Request**: The frontend sends `POST /api/v1/run` to the backend API service.
3. **Enqueue Job**: The API validates the language and files, generates a unique UUID `job_id`, enqueues the job onto the Redis queue, and immediately responds with `202 Accepted` and the `job_id`.
4. **WebSocket Connection**: The frontend establishes a WebSocket connection to `/ws/run/{job_id}` to subscribe to execution logs.
5. **Worker Execution**: An independent worker process pops the job from Redis, constructs the project directory hierarchy on host, and spawns a secure, resource-limited Docker container.
6. **Real-Time Streaming**: The worker captures `stdout` and `stderr` streams in real-time, publishing them to Redis Pub/Sub (`job_output:{job_id}`). The API server forwards these messages directly to the user's browser.
7. **Cleanup**: Upon process exit or timeout (30 seconds limit), the worker publishes the exit event, forcefully terminates the container, and removes temporary directories.

---

## ✨ Key Features

- **Monaco Code Editor**: VS Code-grade editing experience with syntax highlighting, indentation, and multi-file tab navigation.
- **Hierarchical File Tree**: Create, rename, delete files and folders with instant synchronization.
- **Starter Template Gallery**:
  - `Python Multi-File Math & Greetings` (`template-python-script`)
  - `Python Data Processing Pipeline` (`template-python-api`)
  - `JavaScript / Node.js Modular CLI` (`template-js-cli`)
- **Docker Sandbox Security**: Non-root user execution, network isolation (`--net=none`), CPU and memory bounds (`256MB`), and automatic 30s timeout kills.
- **Real-Time Output Terminal**: Live streaming of standard output, standard error, exit codes, and system diagnostic events.
- **Project Export**: Download entire project directory as a standard `.zip` archive.

---

## 🛡 Security & Sandboxing

| Security Layer | Implementation |
|---|---|
| **Process Isolation** | Each job runs in an ephemeral, single-use Docker container. |
| **Network Isolation** | Containers run with `network_mode="none"` preventing internet/intranet access. |
| **Resource Limits** | `--memory=256m`, `--cpus=1.0`, `--pids-limit=64` to prevent DoS or fork bombs. |
| **Execution Timeout** | Worker enforces a strict **30-second** execution limit, killing infinite loops. |
| **Filesystem Isolation** | Clean temporary workspace created per job and purged immediately in `finally` blocks. |
| **Unprivileged User** | Execution runs under an unprivileged user (`1000:1000` / `nobody`). |

---

## 📡 API & WebSocket Contracts

### 1. Health Check
- **Endpoint**: `GET /health`
- **Response** `200 OK`:
  ```json
  {
    "status": "ok"
  }
  ```

### 2. Submit Execution Job
- **Endpoint**: `POST /api/v1/run`
- **Request Body**:
  ```json
  {
    "language": "python",
    "files": [
      {
        "path": "main.py",
        "content": "from utils import greet\nprint(greet('World'))"
      },
      {
        "path": "utils.py",
        "content": "def greet(name):\n    return f'Hello, {name}!'"
      }
    ]
  }
  ```
- **Validation**:
  - `language` must be `"python"` or `"javascript"`. Invalid languages return `400 Bad Request`.
  - `files` array must not be empty. Empty files return `400 Bad Request`.
- **Response** `202 Accepted`:
  ```json
  {
    "job_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
  ```

### 3. Real-Time Output Stream
- **Endpoint**: `WebSocket /ws/run/{job_id}`
- **Standard Output (stdout)**:
  ```json
  {
    "stream": "stdout",
    "data": "Hello, World!\n"
  }
  ```
- **Standard Error (stderr)**:
  ```json
  {
    "stream": "stderr",
    "data": "Traceback (most recent call last):\n..."
  }
  ```
- **Exit Event**:
  ```json
  {
    "stream": "system",
    "event": "exit",
    "code": 0
  }
  ```
- **Timeout Error**:
  ```json
  {
    "stream": "system",
    "event": "error",
    "message": "Execution timed out after 30 seconds."
  }
  ```

---

## 📂 Project Structure

```
.
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── docker-compose.yml        # Multi-service stack orchestration
├── README.md                 # Project documentation & architecture
├── backend/
│   ├── api/
│   │   ├── Dockerfile        # API service container definition
│   │   ├── requirements.txt  # FastAPI & Redis dependencies
│   │   ├── config.py         # API configuration
│   │   └── main.py           # FastAPI app & WebSocket handler
│   └── worker/
│       ├── Dockerfile        # Worker service container definition
│       ├── requirements.txt  # Worker dependencies
│       ├── config.py         # Worker configuration
│       ├── runner.py         # Docker sandbox & execution runner
│       └── worker.py         # Redis queue consumer loop
├── frontend/
│   ├── Dockerfile            # Multi-stage production Nginx container
│   ├── nginx.conf            # Nginx reverse proxy configuration
│   ├── package.json          # React + Vite dependencies
│   ├── tailwind.config.js    # Tailwind CSS styling config
│   ├── tsconfig.json         # TypeScript configuration
│   ├── vite.config.ts        # Vite build configuration
│   └── src/
│       ├── App.tsx           # Main application state & layout
│       ├── main.tsx          # React DOM entry
│       ├── types.ts          # TypeScript interfaces
│       ├── templates.ts      # Multi-file starter templates
│       ├── components/
│       │   ├── Header.tsx    # Navigation bar & run triggers
│       │   ├── FileTree.tsx  # Explorer tree with create/rename/delete
│       │   ├── EditorTabs.tsx# Tabbed navigation
│       │   ├── CodeEditor.tsx# Monaco editor integration
│       │   └── Terminal.tsx  # Real-time output stream panel
│       └── utils/
│           └── exportZip.ts  # JSZip project export utility
└── tests/
    ├── test_api.py           # API endpoint & validation tests
    └── test_execution.py     # Sandbox runner & multi-file execution tests
```

---

## ⚙ Environment Configuration

Copy the sample environment file:
```bash
cp .env.example .env
```

Default configuration variables:
```env
API_PORT=8000
API_HOST=0.0.0.0
REDIS_HOST=queue
REDIS_PORT=6379
REDIS_URL=redis://queue:6379/0
WORKER_CONCURRENCY=2
EXECUTION_TIMEOUT=30
DOCKER_PYTHON_IMAGE=python:3.10-slim
DOCKER_NODE_IMAGE=node:18-alpine
FRONTEND_PORT=3000
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## 🚀 Quick Start with Docker Compose

To start the entire application stack:

```bash
docker-compose up --build
```

Services started:
- **Frontend SPA**: [http://localhost:3000](http://localhost:3000)
- **API Gateway**: [http://localhost:8000](http://localhost:8000)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)
- **Redis Queue**: `localhost:6379`
- **Worker Daemon**: Ephemeral container sandbox manager

To stop all services:
```bash
docker-compose down -v
```

---

## 🧪 Running Automated Tests

Run backend unit and integration tests with pytest:

```bash
# Run all tests
pytest tests/ -v
```

Tests verify:
- Health check `GET /health` returns 200 OK.
- `POST /api/v1/run` returns 202 with `job_id`.
- Unsupported language rejection (400 status).
- Empty files rejection (400 status).
- Multi-file Python execution with local module imports.
- Multi-file JavaScript execution with ES module imports.
- Standard error (`stderr`) capture and formatting.
- 30-second timeout handling.

---

## 💻 Workflow Guide

1. **Load Starter Template**:
   - Click the **Templates** dropdown in the header and select `Python Multi-File Math & Greetings` or `JavaScript / Node.js Modular CLI`.
2. **Edit Files**:
   - Click files in the **Explorer** to open them in tabs. Edit code in the Monaco Editor.
   - Use the `+` icons to create new files or folders.
   - Click the pencil or trash icon on any file item to rename or delete it.
3. **Execute Project**:
   - Click **Run Code** in the top right.
   - Watch the **Terminal Output** panel stream stdout and stderr in real-time as your code runs inside the sandbox.
4. **Export Project**:
   - Click **Export ZIP** to download a compressed archive of your files.
