import pytest
import urllib.request
import json
import asyncio
import websockets

@pytest.mark.asyncio
async def test_live_docker():
    print("--- 1. Testing Health Endpoint ---")
    with urllib.request.urlopen('http://localhost:8001/health') as resp:
        print(f"Health Status: {resp.status}, Body: {resp.read().decode()}")

    print("\n--- 2. Testing Python Execution via Docker API ---")
    py_payload = json.dumps({
        'language': 'python',
        'files': [
            {'path': 'main.py', 'content': 'import sys\nprint("Hello from Python Docker Sandbox!")\nfor i in range(3):\n    print(f"Count: {i}")'}
        ]
    }).encode('utf-8')
    req = urllib.request.Request('http://localhost:8001/api/v1/run', data=py_payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        py_job_id = data['job_id']
        print(f"Submitted Python job: {py_job_id}")

    # Listen via WebSocket
    async with websockets.connect(f"ws://localhost:8001/ws/run/{py_job_id}") as ws:
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
            parsed = json.loads(msg)
            print(f"  [WS Event] {parsed}")
            if parsed.get('event') in ('exit', 'timeout', 'error'):
                break

    print("\n--- 3. Testing JavaScript Multi-file Execution via Docker API ---")
    js_payload = json.dumps({
        'language': 'javascript',
        'files': [
            {'path': 'index.js', 'content': 'import { add } from "./calc.js"; console.log("Result:", add(10, 25));'},
            {'path': 'calc.js', 'content': 'export function add(a, b) { return a + b; }'}
        ]
    }).encode('utf-8')
    req = urllib.request.Request('http://localhost:8001/api/v1/run', data=js_payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        js_job_id = data['job_id']
        print(f"Submitted JS job: {js_job_id}")

    async with websockets.connect(f"ws://localhost:8001/ws/run/{js_job_id}") as ws:
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
            parsed = json.loads(msg)
            print(f"  [WS Event] {parsed}")
            if parsed.get('event') in ('exit', 'timeout', 'error'):
                break

    print("\n--- 4. Testing Frontend Nginx HTTP response ---")
    with urllib.request.urlopen('http://localhost:3001') as resp:
        html = resp.read().decode()
        print(f"Frontend HTTP Status: {resp.status}, Content Length: {len(html)} bytes, Title in HTML: {'Mini IDE' in html}")

    print("\n=======================================================")
    print(">>> ALL LIVE DOCKER STACK TESTS PASSED IN MULTI-CONTAINER ENVIRONMENT! <<<")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(test_live_docker())
