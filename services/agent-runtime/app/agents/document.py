from typing import Any, TypedDict
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from app.memory import RunWorkingMemory
from app.models import (
    DocumentCitation,
    DocumentInput,
    DocumentRunRequest,
    DocumentRunResult,
    DocumentSection,
    TraceEvent,
)
from app.tools.document import (
    REQUIRED_DOCUMENT_TOOL_IDS,
    sandbox_citation_collector,
    sandbox_document_reader,
    sandbox_section_finder,
    sandbox_text_extractor,
)


class DocumentState(TypedDict):
    request: dict[str, Any]
    query: str
    current_step: int
    status: str
    trace: list[dict[str, Any]]
    documents: list[dict[str, Any]]
    sections: list[dict[str, Any]]
    citations: list[dict[str, Any]]
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


def _with_events(state: DocumentState, *events: dict[str, Any]) -> list[dict[str, Any]]:
    return [*state.get("trace", []), *events]


def validate(state: DocumentState) -> dict[str, Any]:
    allowed = set(state["request"]["allowedTools"])
    missing = sorted(REQUIRED_DOCUMENT_TOOL_IDS - allowed)
    if missing:
        summary = f"Required tools are not allowed: {', '.join(missing)}."
        return {
            "status": "failed",
            "output": "Document analysis stopped because a required tool was not permitted.",
            "trace": _with_events(
                state,
                _event(step=0, kind="error", title="Required tool unavailable", summary=summary),
            ),
        }
    if not state["documents"]:
        return {
            "status": "failed",
            "output": "Document analysis stopped because no document was supplied.",
            "trace": _with_events(
                state,
                _event(
                    step=0,
                    kind="error",
                    title="Document required",
                    summary="Attach at least one supported text document before running.",
                ),
            ),
        }
    return {"status": "planning"}


def plan_reader(state: DocumentState) -> dict[str, Any]:
    return {
        "current_step": 1,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=1,
                kind="plan",
                title="Plan step 1",
                summary="Open only the documents supplied to this run and verify their types.",
            ),
        ),
    }


def read_documents(state: DocumentState) -> dict[str, Any]:
    documents = [DocumentInput.model_validate(item) for item in state["documents"]]
    accepted, errors, latency = sandbox_document_reader(documents)
    action = _event(
        step=1,
        kind="action",
        title="Use Document reader",
        summary=f"Open {len(documents)} approved document(s) for this run.",
        tool_id="document-reader",
    )
    if not accepted:
        summary = " ".join(errors) or "No readable documents were found."
        return {
            "status": "failed",
            "documents": [],
            "output": "Document analysis stopped because no supplied document could be read.",
            "trace": _with_events(
                state,
                action,
                _event(
                    step=1,
                    kind="error",
                    title="Document reader failed",
                    summary=summary,
                    tool_id="document-reader",
                    latency=latency,
                ),
            ),
        }
    return {
        "status": "observing",
        "documents": [document.model_dump(mode="json") for document in accepted],
        "trace": _with_events(
            state,
            action,
            _event(
                step=1,
                kind="observation",
                title="Document reader result",
                summary=f"Opened {len(accepted)} document(s). "
                + (" ".join(errors) if errors else ""),
                tool_id="document-reader",
                latency=latency,
            ),
        ),
    }


def plan_extraction(state: DocumentState) -> dict[str, Any]:
    return {
        "current_step": 2,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=2,
                kind="plan",
                title="Plan step 2",
                summary="Normalize the text while keeping each document's identity intact.",
            ),
        ),
    }


def extract_text(state: DocumentState) -> dict[str, Any]:
    documents = [DocumentInput.model_validate(item) for item in state["documents"]]
    extracted, latency = sandbox_text_extractor(documents)
    characters = sum(len(document.content) for document in extracted)
    return {
        "status": "observing",
        "documents": [document.model_dump(mode="json") for document in extracted],
        "trace": _with_events(
            state,
            _event(
                step=2,
                kind="action",
                title="Use Text extractor",
                summary="Normalize line endings and readable text for analysis.",
                tool_id="text-extractor",
            ),
            _event(
                step=2,
                kind="observation",
                title="Text extractor result",
                summary=f"Extracted {characters} characters from {len(extracted)} document(s).",
                tool_id="text-extractor",
                latency=latency,
            ),
        ),
    }


def plan_sections(state: DocumentState) -> dict[str, Any]:
    return {
        "current_step": 3,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=3,
                kind="plan",
                title="Plan step 3",
                summary="Split the extracted text into named sections with stable provenance.",
            ),
        ),
    }


def find_sections(state: DocumentState) -> dict[str, Any]:
    documents = [DocumentInput.model_validate(item) for item in state["documents"]]
    sections, latency = sandbox_section_finder(documents)
    return {
        "status": "observing",
        "sections": [section.model_dump(mode="json") for section in sections],
        "trace": _with_events(
            state,
            _event(
                step=3,
                kind="action",
                title="Use Section finder",
                summary="Identify headings and evidence passages in each document.",
                tool_id="section-finder",
            ),
            _event(
                step=3,
                kind="observation",
                title="Section finder result",
                summary=f"Identified {len(sections)} traceable section(s).",
                tool_id="section-finder",
                latency=latency,
            ),
        ),
    }


def plan_citations(state: DocumentState) -> dict[str, Any]:
    return {
        "current_step": 4,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=4,
                kind="plan",
                title="Plan step 4",
                summary="Select the sections most relevant to the question and attach citations.",
            ),
        ),
    }


def collect_citations(state: DocumentState) -> dict[str, Any]:
    sections = [DocumentSection.model_validate(item) for item in state["sections"]]
    citations, latency = sandbox_citation_collector(sections, state["query"])
    memory = RunWorkingMemory(seed=state["request"].get("memory", ""))
    for citation in citations:
        memory.add(f"{citation.label} {citation.documentName}: {citation.quote}")
    return {
        "status": "observing",
        "citations": [citation.model_dump(mode="json") for citation in citations],
        "trace": _with_events(
            state,
            _event(
                step=4,
                kind="action",
                title="Use Citation collector",
                summary="Rank evidence passages against the incoming question.",
                tool_id="citation-collector",
            ),
            _event(
                step=4,
                kind="observation",
                title="Citation collector result",
                summary=f"Selected {len(citations)} cited evidence passage(s).",
                tool_id="citation-collector",
                latency=latency,
            ),
        ),
    }


def limit_reached(state: DocumentState) -> dict[str, Any]:
    step = state["current_step"]
    return {
        "status": "limit-reached",
        "output": (
            f"Partial document analysis. The configured {state['request']['maxSteps']}-step "
            "limit was reached before a cited answer could be assembled."
        ),
        "confidence": "not-assessed",
        "trace": _with_events(
            state,
            _event(
                step=step,
                kind="decision",
                title="Step limit reached",
                summary=f"The agent stopped after {step} document-processing steps.",
            ),
        ),
    }


def synthesize(state: DocumentState) -> dict[str, Any]:
    citations = [DocumentCitation.model_validate(item) for item in state["citations"]]
    evidence = (
        "\n".join(f"- {citation.quote} {citation.label}" for citation in citations)
        or "- No relevant evidence was found."
    )
    references = "\n".join(
        f"{citation.label} {citation.documentName} — {citation.section}" for citation in citations
    )
    confidence = "high" if len(citations) >= 2 else "medium" if citations else "low"
    answer = (
        citations[0].quote if citations else "No supported answer was found in the supplied text."
    )
    output = (
        "Document answer\n"
        f"{answer}\n\n"
        "Key evidence\n"
        f"{evidence}\n\n"
        "Citations\n"
        f"{references or '- None'}\n\n"
        f"Confidence: {confidence.title()}"
    )
    return {
        "status": "completed",
        "output": output,
        "confidence": confidence,
        "trace": _with_events(
            state,
            _event(
                step=4,
                kind="decision",
                title="Document analysis complete",
                summary=(
                    "The cited evidence satisfies the completion condition: "
                    f"{state['request']['completionCondition']}"
                ),
            ),
            _event(step=4, kind="output", title="Final document result", summary=output),
        ),
    }


def _after_validate(state: DocumentState) -> str:
    return "stop" if state["status"] == "failed" else "continue"


def _after_reader(state: DocumentState) -> str:
    if state["status"] == "failed":
        return "stop"
    return _after_step(state)


def _after_step(state: DocumentState) -> str:
    return "limit" if state["current_step"] >= state["request"]["maxSteps"] else "continue"


def build_document_graph():
    builder = StateGraph(DocumentState)
    builder.add_node("validate", validate)
    builder.add_node("plan_reader", plan_reader)
    builder.add_node("read_documents", read_documents)
    builder.add_node("plan_extraction", plan_extraction)
    builder.add_node("extract_text", extract_text)
    builder.add_node("plan_sections", plan_sections)
    builder.add_node("find_sections", find_sections)
    builder.add_node("plan_citations", plan_citations)
    builder.add_node("collect_citations", collect_citations)
    builder.add_node("limit", limit_reached)
    builder.add_node("synthesize", synthesize)

    builder.add_edge(START, "validate")
    builder.add_conditional_edges(
        "validate", _after_validate, {"continue": "plan_reader", "stop": END}
    )
    builder.add_edge("plan_reader", "read_documents")
    builder.add_conditional_edges(
        "read_documents",
        _after_reader,
        {"continue": "plan_extraction", "limit": "limit", "stop": END},
    )
    builder.add_edge("plan_extraction", "extract_text")
    builder.add_conditional_edges(
        "extract_text", _after_step, {"continue": "plan_sections", "limit": "limit"}
    )
    builder.add_edge("plan_sections", "find_sections")
    builder.add_conditional_edges(
        "find_sections", _after_step, {"continue": "plan_citations", "limit": "limit"}
    )
    builder.add_edge("plan_citations", "collect_citations")
    builder.add_edge("collect_citations", "synthesize")
    builder.add_edge("limit", END)
    builder.add_edge("synthesize", END)
    return builder.compile(checkpointer=InMemorySaver())


DOCUMENT_GRAPH = build_document_graph()


def run_document_agent(request: DocumentRunRequest) -> DocumentRunResult:
    run_id = f"run-{uuid4().hex}"
    query = request.input.strip() or request.goal.strip()
    initial: DocumentState = {
        "request": request.model_dump(mode="json"),
        "query": query,
        "current_step": 0,
        "status": "planning",
        "trace": [],
        "documents": [document.model_dump(mode="json") for document in request.documents],
        "sections": [],
        "citations": [],
        "output": "",
        "confidence": "not-assessed",
    }
    state = DOCUMENT_GRAPH.invoke(
        initial,
        config={"configurable": {"thread_id": run_id}, "run_name": "flowcraft-document-agent"},
    )
    return DocumentRunResult(
        runId=run_id,
        status=state["status"],
        output=state["output"],
        trace=[TraceEvent.model_validate(event) for event in state["trace"]],
        stepsUsed=state["current_step"],
        citations=[DocumentCitation.model_validate(item) for item in state["citations"]],
        documentCount=len(state["documents"]),
        confidence=state["confidence"],
    )
