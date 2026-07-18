from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

AgentStatus = Literal["completed", "failed", "limit-reached"]
TraceKind = Literal["plan", "action", "observation", "decision", "output", "error"]
ToolRisk = Literal["low", "medium", "high"]


class ToolDefinition(BaseModel):
    id: str
    name: str
    description: str
    risk: ToolRisk


class TraceEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"trace-{uuid4().hex}")
    step: int = Field(ge=0)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    kind: TraceKind
    title: str
    summary: str
    toolId: str | None = None
    risk: ToolRisk | None = None
    latency: int | None = Field(default=None, ge=0)


class ResearchSource(BaseModel):
    title: str
    url: str
    excerpt: str


class DocumentInput(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=500)
    mimeType: str = Field(default="text/plain", max_length=200)
    content: str = Field(min_length=1, max_length=100_000)


class DocumentSection(BaseModel):
    documentId: str
    documentName: str
    section: str
    text: str
    index: int = Field(ge=0)


class DocumentCitation(BaseModel):
    documentId: str
    documentName: str
    section: str
    quote: str
    label: str


class DataInput(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=500)
    mimeType: Literal["text/csv", "application/json"]
    content: str = Field(min_length=1, max_length=200_000)


class DataMetric(BaseModel):
    column: str
    operation: Literal["sum", "average", "minimum", "maximum"]
    value: float


class DataAnomaly(BaseModel):
    rowNumber: int = Field(ge=1)
    column: str
    value: float
    reason: str


class ResearchRunRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=2_000)
    role: str = Field(default="Research specialist", max_length=500)
    instructions: str = Field(min_length=1, max_length=8_000)
    input: str = Field(default="", max_length=20_000)
    allowedTools: list[str] = Field(default_factory=list)
    memory: str = Field(default="", max_length=10_000)
    maxSteps: int = Field(default=3, ge=1, le=12)
    timeoutSeconds: int = Field(default=90, ge=1, le=600)
    approvalPolicy: Literal["never", "sensitive", "always"] = "sensitive"
    completionCondition: str = Field(default="Return a supported answer", max_length=2_000)
    outputFormat: str = Field(default="Answer with sources", max_length=1_000)


class ResearchRunResult(BaseModel):
    runId: str
    runtime: Literal["langgraph"] = "langgraph"
    status: AgentStatus
    output: str
    trace: list[TraceEvent]
    stepsUsed: int = Field(ge=0)
    sources: list[ResearchSource] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low", "not-assessed"] = "not-assessed"


class DocumentRunRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=2_000)
    role: str = Field(default="Document specialist", max_length=500)
    instructions: str = Field(min_length=1, max_length=8_000)
    input: str = Field(default="", max_length=20_000)
    documents: list[DocumentInput] = Field(min_length=1, max_length=5)
    allowedTools: list[str] = Field(default_factory=list)
    memory: str = Field(default="", max_length=10_000)
    maxSteps: int = Field(default=4, ge=1, le=12)
    timeoutSeconds: int = Field(default=90, ge=1, le=600)
    approvalPolicy: Literal["never", "sensitive", "always"] = "sensitive"
    completionCondition: str = Field(default="Return an answer with citations", max_length=2_000)
    outputFormat: str = Field(default="Answer with document citations", max_length=1_000)


class DocumentRunResult(BaseModel):
    runId: str
    runtime: Literal["langgraph"] = "langgraph"
    status: AgentStatus
    output: str
    trace: list[TraceEvent]
    stepsUsed: int = Field(ge=0)
    citations: list[DocumentCitation] = Field(default_factory=list)
    documentCount: int = Field(ge=0)
    confidence: Literal["high", "medium", "low", "not-assessed"] = "not-assessed"


class DataRunRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=2_000)
    role: str = Field(default="Data analyst", max_length=500)
    instructions: str = Field(min_length=1, max_length=8_000)
    input: str = Field(default="", max_length=20_000)
    datasets: list[DataInput] = Field(min_length=1, max_length=3)
    allowedTools: list[str] = Field(default_factory=list)
    memory: str = Field(default="", max_length=10_000)
    maxSteps: int = Field(default=4, ge=1, le=12)
    timeoutSeconds: int = Field(default=90, ge=1, le=600)
    approvalPolicy: Literal["never", "sensitive", "always"] = "sensitive"
    completionCondition: str = Field(default="Return metrics and anomalies", max_length=2_000)
    outputFormat: str = Field(default="Summary, metrics, anomalies", max_length=1_000)


class DataRunResult(BaseModel):
    runId: str
    runtime: Literal["langgraph"] = "langgraph"
    status: AgentStatus
    output: str
    trace: list[TraceEvent]
    stepsUsed: int = Field(ge=0)
    datasetCount: int = Field(ge=0)
    rowCount: int = Field(ge=0)
    columnCount: int = Field(ge=0)
    metrics: list[DataMetric] = Field(default_factory=list)
    anomalies: list[DataAnomaly] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low", "not-assessed"] = "not-assessed"


class AgentCatalogItem(BaseModel):
    id: str
    name: str
    description: str
    status: Literal["ready", "planned"]
    runtime: Literal["langgraph"]
    tools: list[ToolDefinition]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "flowcraft-agent-runtime"
    version: str = "0.3.0"
    langsmithTracing: bool
