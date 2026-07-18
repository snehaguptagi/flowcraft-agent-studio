import asyncio
import os
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.data import run_data_agent
from app.agents.document import run_document_agent
from app.agents.research import run_research_agent
from app.models import (
    AgentCatalogItem,
    DataRunRequest,
    DataRunResult,
    DocumentRunRequest,
    DocumentRunResult,
    HealthResponse,
    ResearchRunRequest,
    ResearchRunResult,
    TraceEvent,
)
from app.tools.data import DATA_TOOLS
from app.tools.document import DOCUMENT_TOOLS
from app.tools.research import RESEARCH_TOOLS


def _langsmith_enabled() -> bool:
    return os.getenv("LANGSMITH_TRACING", "false").lower() in {"1", "true", "yes"}


def _cors_origins() -> list[str]:
    configured = os.getenv("FLOWCRAFT_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


app = FastAPI(
    title="Flowcraft Agent Runtime",
    version="0.3.0",
    description="Typed LangGraph runtime for Flowcraft specialist agents.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(langsmithTracing=_langsmith_enabled())


@app.get("/v1/agents", response_model=list[AgentCatalogItem])
def list_agents() -> list[AgentCatalogItem]:
    return [
        AgentCatalogItem(
            id="research-agent",
            name="Research Agent",
            description="Collects approved evidence and returns a sourced answer.",
            status="ready",
            runtime="langgraph",
            tools=RESEARCH_TOOLS,
        ),
        AgentCatalogItem(
            id="document-agent",
            name="Document Agent",
            description="Reads approved text documents and returns a cited answer.",
            status="ready",
            runtime="langgraph",
            tools=DOCUMENT_TOOLS,
        ),
        AgentCatalogItem(
            id="data-agent",
            name="Data Analyst",
            description="Profiles approved CSV or JSON data and returns metrics and anomalies.",
            status="ready",
            runtime="langgraph",
            tools=DATA_TOOLS,
        ),
    ]


@app.post("/v1/agents/research/runs", response_model=ResearchRunResult)
async def run_research(request: ResearchRunRequest) -> ResearchRunResult:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(run_research_agent, request), timeout=request.timeoutSeconds
        )
    except TimeoutError:
        return ResearchRunResult(
            runId=f"run-{uuid4().hex}",
            status="failed",
            output="Research stopped because the configured timeout was reached.",
            trace=[
                TraceEvent(
                    step=0,
                    kind="error",
                    title="Run timed out",
                    summary=f"The agent exceeded the {request.timeoutSeconds}-second timeout.",
                )
            ],
            stepsUsed=0,
            confidence="not-assessed",
        )


@app.post("/v1/agents/document/runs", response_model=DocumentRunResult)
async def run_document(request: DocumentRunRequest) -> DocumentRunResult:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(run_document_agent, request), timeout=request.timeoutSeconds
        )
    except TimeoutError:
        return DocumentRunResult(
            runId=f"run-{uuid4().hex}",
            status="failed",
            output="Document analysis stopped because the configured timeout was reached.",
            trace=[
                TraceEvent(
                    step=0,
                    kind="error",
                    title="Run timed out",
                    summary=f"The agent exceeded the {request.timeoutSeconds}-second timeout.",
                )
            ],
            stepsUsed=0,
            documentCount=len(request.documents),
            confidence="not-assessed",
        )


@app.post("/v1/agents/data/runs", response_model=DataRunResult)
async def run_data(request: DataRunRequest) -> DataRunResult:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(run_data_agent, request), timeout=request.timeoutSeconds
        )
    except TimeoutError:
        return DataRunResult(
            runId=f"run-{uuid4().hex}",
            status="failed",
            output="Data analysis stopped because the configured timeout was reached.",
            trace=[
                TraceEvent(
                    step=0,
                    kind="error",
                    title="Run timed out",
                    summary=f"The agent exceeded the {request.timeoutSeconds}-second timeout.",
                )
            ],
            stepsUsed=0,
            datasetCount=len(request.datasets),
            rowCount=0,
            columnCount=0,
            confidence="not-assessed",
        )
