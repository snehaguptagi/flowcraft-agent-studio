# Optional Flowcraft Agent-node runtime

Flowcraft's main product is the visual AI workflow builder, which does not require this service. This optional service runs the Research, Document, and Data Analyst nodes when a workflow genuinely needs bounded multi-step tool selection. They are orchestrated by LangGraph so their graphs, permissions, limits, traces, and APIs can be tested without a model key or unrestricted external access.

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
- `POST /v1/agents/document/runs`
- `POST /v1/agents/data/runs`
- `GET /docs` for the generated OpenAPI explorer

## LangSmith

LangGraph automatically emits engineering traces when the server has `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, and `LANGSMITH_PROJECT`. These values must never be placed in frontend environment variables.

## Memory boundary

The LangGraph checkpointer owns short-term run/thread state. `app/memory.py` defines the application boundary for future persisted memory. LangMem will be added only for evaluated long-term memory use cases; document retrieval remains a separate indexed knowledge system.

The Document Agent accepts run-scoped TXT, Markdown, CSV, and JSON text. It preserves document and section provenance in every citation and does not write document content to long-term memory.

The Data Analyst accepts CSV or JSON arrays, processes at most 500 rows, calculates deterministic metrics, and flags numeric outliers with the 1.5 × IQR rule. It never executes user-provided code, formulas, SQL, or macros.

## Verify

```powershell
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m pytest
```
