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
    version: str = "0.1.0"
    langsmithTracing: bool
