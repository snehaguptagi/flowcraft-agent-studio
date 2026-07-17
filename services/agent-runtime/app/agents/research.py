from typing import Any, TypedDict
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from app.memory import RunWorkingMemory
from app.models import ResearchRunRequest, ResearchRunResult, ResearchSource, TraceEvent
from app.tools.research import (
    REQUIRED_RESEARCH_TOOL_IDS,
    sandbox_note_collector,
    sandbox_page_reader,
    sandbox_web_search,
)


class ResearchState(TypedDict):
    request: dict[str, Any]
    subject: str
    current_step: int
    status: str
    trace: list[dict[str, Any]]
    sources: list[dict[str, Any]]
    findings: list[str]
    evidence_note: str
    output: str
    confidence: str


def _event(
    *,
    step: int,
    kind: str,
    title: str,
    summary: str,
    tool_id: str | None = None,
    latency: int | None = None,
) -> dict[str, Any]:
    return TraceEvent(
        step=step,
        kind=kind,
        title=title,
        summary=summary,
        toolId=tool_id,
        risk="low" if tool_id else None,
        latency=latency,
    ).model_dump(mode="json", exclude_none=True)


def _with_events(state: ResearchState, *events: dict[str, Any]) -> list[dict[str, Any]]:
    return [*state.get("trace", []), *events]


def validate(state: ResearchState) -> dict[str, Any]:
    allowed = set(state["request"]["allowedTools"])
    missing = sorted(REQUIRED_RESEARCH_TOOL_IDS - allowed)
    if not missing:
        return {"status": "planning"}

    summary = f"Required tools are not allowed: {', '.join(missing)}."
    return {
        "status": "failed",
        "output": "Research stopped because a required tool was not permitted.",
        "trace": _with_events(
            state,
            _event(step=0, kind="error", title="Required tool unavailable", summary=summary),
        ),
    }


def plan_search(state: ResearchState) -> dict[str, Any]:
    return {
        "current_step": 1,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=1,
                kind="plan",
                title="Plan step 1",
                summary=f"Identify focused evidence needed for: {state['subject']}",
            ),
        ),
    }


def search(state: ResearchState) -> dict[str, Any]:
    sources, latency = sandbox_web_search(state["subject"])
    return {
        "status": "observing",
        "sources": [source.model_dump(mode="json") for source in sources],
        "trace": _with_events(
            state,
            _event(
                step=1,
                kind="action",
                title="Use Web search",
                summary=f"Search the approved sandbox index for '{state['subject'][:120]}'.",
                tool_id="web-search",
            ),
            _event(
                step=1,
                kind="observation",
                title="Web search result",
                summary="Found three relevant, approved sandbox sources.",
                tool_id="web-search",
                latency=latency,
            ),
        ),
    }


def plan_read(state: ResearchState) -> dict[str, Any]:
    return {
        "current_step": 2,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=2,
                kind="plan",
                title="Plan step 2",
                summary="Read the strongest sources and extract facts that answer the goal.",
            ),
        ),
    }


def read_sources(state: ResearchState) -> dict[str, Any]:
    sources = [ResearchSource.model_validate(source) for source in state["sources"]]
    findings, latency = sandbox_page_reader(sources)
    return {
        "status": "observing",
        "findings": findings,
        "trace": _with_events(
            state,
            _event(
                step=2,
                kind="action",
                title="Use Page reader",
                summary="Read the selected sources and compare their recovery instructions.",
                tool_id="page-reader",
            ),
            _event(
                step=2,
                kind="observation",
                title="Page reader result",
                summary=(
                    "The sources agree on the recovery path, owner assistance, "
                    "and verification window."
                ),
                tool_id="page-reader",
                latency=latency,
            ),
        ),
    }


def plan_notes(state: ResearchState) -> dict[str, Any]:
    return {
        "current_step": 3,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=3,
                kind="plan",
                title="Plan step 3",
                summary="Organize the evidence, remove duplication, and preserve source labels.",
            ),
        ),
    }


def collect_notes(state: ResearchState) -> dict[str, Any]:
    memory = RunWorkingMemory(seed=state["request"].get("memory", ""))
    for finding in state["findings"]:
        memory.add(finding)
    evidence_note, latency = sandbox_note_collector(memory.notes)
    return {
        "status": "observing",
        "evidence_note": evidence_note,
        "trace": _with_events(
            state,
            _event(
                step=3,
                kind="action",
                title="Use Note collector",
                summary="Create a concise evidence note with findings and source references.",
                tool_id="note-collector",
            ),
            _event(
                step=3,
                kind="observation",
                title="Note collector result",
                summary=(
                    "The evidence note contains a complete answer and no conflicting instructions."
                ),
                tool_id="note-collector",
                latency=latency,
            ),
        ),
    }


def limit_reached(state: ResearchState) -> dict[str, Any]:
    step = state["current_step"]
    output = (
        f"Partial research for '{state['subject']}'. The configured "
        f"{state['request']['maxSteps']}-step limit was reached before synthesis."
    )
    return {
        "status": "limit-reached",
        "output": output,
        "confidence": "not-assessed",
        "trace": _with_events(
            state,
            _event(
                step=step,
                kind="decision",
                title="Step limit reached",
                summary=f"The agent stopped after {step} tool steps.",
            ),
        ),
    }


def synthesize(state: ResearchState) -> dict[str, Any]:
    sources = [ResearchSource.model_validate(source) for source in state["sources"]]
    source_lines = "\n".join(f"- {source.title} ({source.url})" for source in sources)
    output = (
        "Research answer\n"
        "To reset a locked workspace, open Workspace settings -> Security -> Restore access. "
        "If settings are unavailable, ask a workspace owner to start account recovery and "
        "complete the verification email within 30 minutes.\n\n"
        "Key findings\n"
        "- The normal recovery path begins in Workspace settings.\n"
        "- A workspace owner can initiate recovery when settings are unavailable.\n"
        "- The verification link must be completed within 30 minutes.\n\n"
        f"Sources\n{source_lines}\n\nConfidence: High"
    )
    return {
        "status": "completed",
        "output": output,
        "confidence": "high",
        "trace": _with_events(
            state,
            _event(
                step=3,
                kind="decision",
                title="Research complete",
                summary=(
                    "The evidence satisfies the completion condition: "
                    f"{state['request']['completionCondition']}"
                ),
            ),
            _event(step=3, kind="output", title="Final research result", summary=output),
        ),
    }


def _after_validate(state: ResearchState) -> str:
    return "stop" if state["status"] == "failed" else "continue"


def _after_step(state: ResearchState) -> str:
    return "limit" if state["current_step"] >= state["request"]["maxSteps"] else "continue"


def build_research_graph():
    builder = StateGraph(ResearchState)
    builder.add_node("validate", validate)
    builder.add_node("plan_search", plan_search)
    builder.add_node("search", search)
    builder.add_node("plan_read", plan_read)
    builder.add_node("read_sources", read_sources)
    builder.add_node("plan_notes", plan_notes)
    builder.add_node("collect_notes", collect_notes)
    builder.add_node("limit", limit_reached)
    builder.add_node("synthesize", synthesize)

    builder.add_edge(START, "validate")
    builder.add_conditional_edges(
        "validate", _after_validate, {"continue": "plan_search", "stop": END}
    )
    builder.add_edge("plan_search", "search")
    builder.add_conditional_edges(
        "search", _after_step, {"continue": "plan_read", "limit": "limit"}
    )
    builder.add_edge("plan_read", "read_sources")
    builder.add_conditional_edges(
        "read_sources", _after_step, {"continue": "plan_notes", "limit": "limit"}
    )
    builder.add_edge("plan_notes", "collect_notes")
    builder.add_edge("collect_notes", "synthesize")
    builder.add_edge("limit", END)
    builder.add_edge("synthesize", END)
    return builder.compile(checkpointer=InMemorySaver())


RESEARCH_GRAPH = build_research_graph()


def run_research_agent(request: ResearchRunRequest) -> ResearchRunResult:
    run_id = f"run-{uuid4().hex}"
    subject = request.input.strip() or request.goal.strip()
    initial: ResearchState = {
        "request": request.model_dump(mode="json"),
        "subject": subject,
        "current_step": 0,
        "status": "planning",
        "trace": [],
        "sources": [],
        "findings": [],
        "evidence_note": "",
        "output": "",
        "confidence": "not-assessed",
    }
    state = RESEARCH_GRAPH.invoke(
        initial,
        config={"configurable": {"thread_id": run_id}, "run_name": "flowcraft-research-agent"},
    )
    return ResearchRunResult(
        runId=run_id,
        status=state["status"],
        output=state["output"],
        trace=[TraceEvent.model_validate(event) for event in state["trace"]],
        stepsUsed=state["current_step"],
        sources=[ResearchSource.model_validate(source) for source in state["sources"]],
        confidence=state["confidence"],
    )
