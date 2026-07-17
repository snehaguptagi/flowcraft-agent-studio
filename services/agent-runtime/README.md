# Flowcraft agent runtime

This service runs Flowcraft specialist agents on the server. Agent 1 is a deterministic Research Agent orchestrated by LangGraph, so the graph, permissions, limits, trace, and API can be tested without a model key or unrestricted web access.

## Start locally

From this directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

The API is then available at `http://localhost:8000`. Set `NEXT_PUBLIC_AGENT_API_URL=http://localhost:8000` in the frontend environment and restart the frontend development server. If the URL is absent or the service is unavailable, Flowcraft safely uses its browser sandbox.

## API

- `GET /health`
- `GET /v1/agents`
- `POST /v1/agents/research/runs`
- `GET /docs` for the generated OpenAPI explorer

## LangSmith

LangGraph automatically emits engineering traces when the server has `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, and `LANGSMITH_PROJECT`. These values must never be placed in frontend environment variables.

## Memory boundary

The LangGraph checkpointer owns short-term run/thread state. `app/memory.py` defines the application boundary for future persisted memory. LangMem will be added only for evaluated long-term memory use cases; document retrieval remains a separate indexed knowledge system.

## Verify

```powershell
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m pytest
```
