# Jan Agent Team Runtime

Local Python runtime used by Jan Agent Team mode.

It exposes:

- `GET /health`
- `POST /v1/agent-team/runs`

The Tauri app starts this server with the bundled `uv` binary on `127.0.0.1:8765`.
