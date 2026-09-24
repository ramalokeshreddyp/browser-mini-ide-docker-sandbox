# Architecture and Technical Questionnaire

## 1. Architectural Decisions: Job Queue & Real-Time Communication Protocol

### Why a Job Queue?
Executing arbitrary code inside sandboxed environments is a computationally heavy, I/O-intensive, and variable-duration process. A job queue (implemented via Redis in our system) decouples the frontend API gateway from the sandbox execution workers.

- **Non-Blocking Gateway**: The API endpoint `POST /api/v1/run` validates the request, pushes the job to the Redis queue (`code_execution_queue`), and immediately returns `202 Accepted` with a `job_id` within milliseconds.
- **Backpressure & Spike Smoothing**: When traffic spikes (e.g., hundreds of users clicking "Run" simultaneously), the API remains responsive while the worker pool processes jobs at a controlled, sustainable rate.
- **Fault Isolation**: A worker crash, container crash, or heavy resource spike does not affect the web API server.

### Real-Time Communication: WebSocket vs. Server-Sent Events (SSE)
In this project, we implemented **WebSockets** (`/ws/run/{job_id}`).

#### Trade-offs & Rationale:
| Feature | WebSockets (Our Choice) | Server-Sent Events (SSE) |
|---|---|---|
| **Directionality** | Full-duplex (Bidirectional: Client $\leftrightarrow$ Server) | Unidirectional (Server $\rightarrow$ Client only) |
| **Protocol** | Protocol upgrade (`ws://` / `wss://`) over TCP | Standard HTTP/1.1 or HTTP/2 streaming |
| **Future Interactivity** | Allows users to send real-time `stdin` input to running interactive processes (e.g. `input()` prompts in CLI tools) without opening separate HTTP channels. | Requires separate `POST` HTTP requests for `stdin`. |
| **Message Framing & Overhead** | Extremely lightweight binary/text framing (2–10 bytes per frame) with minimal overhead. | Uses `text/event-stream` with `data:` prefixes; slightly higher framing overhead. |
| **Proxy / Firewall Traversal** | Can require specific reverse proxy configuration (e.g. `Upgrade` / `Connection` headers in Nginx). | Operates over standard HTTP; easily proxied and cached. |
| **Reconnection** | Managed client-side with retry/reconnect handlers. | Native automatic browser reconnect support. |

---

## 2. Docker Sandbox Security & Hardening Measures

### Implemented Security Measures in Our Codebase
1. **Container Process Isolation**: Every job execution creates an isolated, ephemeral Docker container from `python:3.10-slim` or `node:18-alpine` with an entrypoint limited to the user's project files.
2. **Network Isolation**: Containers are launched with `network_mode="none"` (`--net=none`), completely preventing outbound/inbound network connections. Malicious scripts cannot exfiltrate data, communicate with command-and-control servers, or probe private network subnets.
3. **Resource Constraints**:
   - `--memory=256m`: Prevents memory exhaustion and out-of-memory crashes on the host.
   - `--nano_cpus=1000000000` (1 CPU core): Limits CPU consumption and mitigates cryptomining or denial-of-service attempts.
   - `--pids-limit=64`: Restricts process creation to prevent fork bombs.
4. **Unprivileged Execution**: Containers run under a dedicated unprivileged user (`user="1000:1000"` / `nobody`), mitigating container breakout vulnerabilities that rely on root privileges.
5. **Execution Timeout**: Enforced hard **30-second** timeout. If execution exceeds 30 seconds, the worker terminates the container, kills child processes, and sends a system error event to the client.
6. **Guaranteed Ephemeral Cleanup**: A `try...finally` block in `runner.py` guarantees container removal (`container.remove(force=True)`) and host directory deletion (`shutil.rmtree`), preventing disk and container leaks.

### Additional Hardening Steps for Production
- **Read-Only Root Filesystem**: Mount the container root filesystem as `--read-only`, providing a small in-memory `tmpfs` (`/tmp:rw,noexec,nosuid,size=32m`) for temporary files.
- **Seccomp & AppArmor Profiles**: Restrict dangerous Linux system calls (e.g., `ptrace`, `sys_chroot`, `mount`, `bpf`, `reboot`, `process_vm_writev`) via custom Seccomp filter profiles.
- **Drop Linux Capabilities**: Apply `--cap-drop=ALL` so the container retains zero kernel capabilities.
- **gVisor / Firecracker MicroVMs**: Replace the runc runtime with **gVisor** (`runsc`) or **Firecracker** to create a user-space kernel layer that intercepts and sandboxes all syscalls, completely isolating the host kernel from 0-day exploits.

---

## 3. Scaling to Thousands of Concurrent Users

### Potential Bottlenecks
1. **Host CPU/Memory & Docker Daemon Contention**: Creating hundreds of containers per second on a single machine causes lock contention on the Docker daemon and exhausts cgroup allocations.
2. **WebSocket Connection Concurrency**: Thousands of persistent open WebSockets can exhaust file descriptors and socket buffers on single server instances.
3. **Queue Throughput**: High-frequency job serialization and pub/sub message throughput.

### Proposed Scalable Architecture
```
                         ┌─────────────────────────────┐
                         │   Global CDN & Anycast ALB  │
                         └──────────────┬──────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │   FastAPI Gateway Cluster   │  (Kubernetes HPA: Scales on CPU /
                         │ (Stateless, 100k+ WebSockets)│   Active WebSocket Connections)
                         └──────────────┬──────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │   Redis Cluster / Sentinel  │  (Sharded Queue & Pub/Sub Channels)
                         └──────────────┬──────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
           ▼                            ▼                            ▼
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│  Worker Node Pool 1  │     │  Worker Node Pool 2  │     │  Worker Node Pool N  │
│  (K8s / Firecracker) │     │  (K8s / Firecracker) │     │  (K8s / Firecracker) │
└──────────────────────┘     └──────────────────────┘     └──────────────────────┘
```

1. **Horizontal Scaling of API & WebSocket Gateways**:
   - Deploy FastAPI instances as stateless pods behind an Application Load Balancer.
   - With `uvicorn` and `uvloop`, a single API pod can handle 10,000+ idle WebSocket connections.
   - Redis Pub/Sub distributes output messages to the correct API pod serving the client's WebSocket connection.
2. **Dynamic Worker Autoscaling (KEDA)**:
   - Use Kubernetes Event-Driven Autoscaling (KEDA) to scale worker pods dynamically based on the queue depth (`LLEN code_execution_queue`).
3. **Container Pre-Warming (Warm Pool Strategy)**:
   - Cold container startup takes 300–800ms. By maintaining a pool of pre-warmed idle containers (`python:3.10` and `node:18`), code can be injected and executed in **<30ms**, reducing latency by an order of magnitude.
4. **Dedicated MicroVM Sandbox Clusters (e.g., Nomad / Firecracker)**:
   - Distribute isolated microVM workloads across multiple dedicated bare-metal nodes to bypass Docker daemon concurrency limits.

---

## 4. Frontend State Management Strategy

### Architecture & Library Selection
The frontend state is centralized using React's built-in state primitives (`useState`, `useRef`, `useCallback`) alongside immutable data flows.

### Strategy Details:
1. **Single Source of Truth (`ProjectFile[]`)**:
   - All files are stored in a flat array of `{ path: string, content: string }`.
   - The hierarchical directory tree structure is dynamically generated on each render inside `FileTree.tsx`. This guarantees there is **never any state divergence** between the file explorer, Monaco editor tabs, and the API execution payload.
2. **Monaco Editor Integration**:
   - `@monaco-editor/react` provides VS Code-level syntax highlighting, bracket matching, auto-indentation, and multi-file editing buffers.
   - Switching tabs preserves undo/redo history and cursor positions.
3. **Decoupled WebSocket Streaming**:
   - `useRef` maintains the active WebSocket instance across re-renders.
   - Log entries are appended to the `ExecutionLog[]` buffer and rendered inside the auto-scrolling `Terminal.tsx` component with stream badges.
4. **Client-Side Project Export**:
   - `JSZip` and `file-saver` consume the in-memory `files` state directly to generate and download `.zip` archives client-side without burdening the backend.

### Rationale:
For an interactive mini IDE of this scope, centralized React state management avoids unnecessary Redux/Zustand boilerplate while providing fast reactivity, zero memory overhead, and clean testability.

---

## 5. Failure Handling and Recovery Strategy

### 1. Worker and Container Crashes
- **Guaranteed Cleanup**: Every execution runs inside a strict `try...finally` block in `runner.py`. Even if the user code triggers an unhandled exception, syntax error, or segfault, the Docker container is forcefully killed and the temporary workspace directory is purged.
- **Crash Notification**: Any unexpected Python/Node runtime exception or sandbox failure is captured and published to the Redis pub/sub channel as:
  ```json
  { "stream": "system", "event": "error", "message": "Execution failed: <details>" }
  ```
- **Process Signals**: Workers trap `SIGINT` and `SIGTERM` to finish processing active jobs before shutting down gracefully.

### 2. Message Queue & Broker Unavailability
- **API Resilience**: If Redis is temporarily unreachable, the API returns a clean HTTP 500 error with an explanatory message (`Failed to enqueue execution job`) instead of hanging or crashing.
- **Worker Reconnection**: The worker main loop implements an exponential backoff retry loop (`r.ping()`), attempting reconnection every 2 seconds without terminating the worker daemon.

### 3. Client & WebSocket Disconnections
- **Message History Replay**: Worker publishes logs to both Redis Pub/Sub (`job_output:{job_id}`) and an ephemeral Redis List (`job_history:{job_id}` with 5-minute TTL). If a client connects slightly after worker execution starts, the API replays missed log chunks before streaming live output.
- **Client Error State**: If the WebSocket connection drops, `socket.onerror` and `socket.onclose` immediately update the UI state, displaying an error banner in the terminal panel and resetting the "Run" button state.
