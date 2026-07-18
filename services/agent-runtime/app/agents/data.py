from typing import Any, TypedDict
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from app.memory import RunWorkingMemory
from app.models import DataAnomaly, DataInput, DataMetric, DataRunRequest, DataRunResult, TraceEvent
from app.tools.data import (
    REQUIRED_DATA_TOOL_IDS,
    sandbox_anomaly_detector,
    sandbox_calculation_tool,
    sandbox_data_profiler,
    sandbox_table_reader,
)


class DataState(TypedDict):
    request: dict[str, Any]
    query: str
    current_step: int
    status: str
    trace: list[dict[str, Any]]
    rows: list[dict[str, Any]]
    columns: list[str]
    numeric_columns: list[str]
    missing: dict[str, int]
    metrics: list[dict[str, Any]]
    anomalies: list[dict[str, Any]]
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


def _with_events(state: DataState, *events: dict[str, Any]) -> list[dict[str, Any]]:
    return [*state.get("trace", []), *events]


def validate(state: DataState) -> dict[str, Any]:
    allowed = set(state["request"]["allowedTools"])
    missing_tools = sorted(REQUIRED_DATA_TOOL_IDS - allowed)
    if missing_tools:
        return {
            "status": "failed",
            "output": "Data analysis stopped because a required tool was not permitted.",
            "trace": _with_events(
                state,
                _event(
                    step=0,
                    kind="error",
                    title="Required tool unavailable",
                    summary=f"Required tools are not allowed: {', '.join(missing_tools)}.",
                ),
            ),
        }
    if not state["request"]["datasets"]:
        return {
            "status": "failed",
            "output": "Data analysis stopped because no dataset was supplied.",
            "trace": _with_events(
                state,
                _event(
                    step=0,
                    kind="error",
                    title="Dataset required",
                    summary="Attach at least one supported CSV or JSON dataset before running.",
                ),
            ),
        }
    return {"status": "planning"}


def plan_reader(state: DataState) -> dict[str, Any]:
    return {
        "current_step": 1,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=1,
                kind="plan",
                title="Plan step 1",
                summary="Parse the approved tabular data and enforce the local row limit.",
            ),
        ),
    }


def read_table(state: DataState) -> dict[str, Any]:
    datasets = [DataInput.model_validate(item) for item in state["request"]["datasets"]]
    rows, errors, latency = sandbox_table_reader(datasets)
    action = _event(
        step=1,
        kind="action",
        title="Use Table reader",
        summary=f"Parse {len(datasets)} approved dataset(s).",
        tool_id="table-reader",
    )
    if not rows:
        return {
            "status": "failed",
            "output": "Data analysis stopped because no supplied dataset could be parsed.",
            "trace": _with_events(
                state,
                action,
                _event(
                    step=1,
                    kind="error",
                    title="Table reader failed",
                    summary=" ".join(errors) or "No valid table rows were found.",
                    tool_id="table-reader",
                    latency=latency,
                ),
            ),
        }
    return {
        "status": "observing",
        "rows": rows,
        "trace": _with_events(
            state,
            action,
            _event(
                step=1,
                kind="observation",
                title="Table reader result",
                summary=f"Parsed {len(rows)} row(s). " + (" ".join(errors) if errors else ""),
                tool_id="table-reader",
                latency=latency,
            ),
        ),
    }


def plan_profile(state: DataState) -> dict[str, Any]:
    return {
        "current_step": 2,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=2,
                kind="plan",
                title="Plan step 2",
                summary="Profile columns, missing values, and numeric fields before calculating.",
            ),
        ),
    }


def profile_data(state: DataState) -> dict[str, Any]:
    columns, numeric_columns, missing, latency = sandbox_data_profiler(state["rows"])
    return {
        "status": "observing",
        "columns": columns,
        "numeric_columns": numeric_columns,
        "missing": missing,
        "trace": _with_events(
            state,
            _event(
                step=2,
                kind="action",
                title="Use Data profiler",
                summary="Inspect table shape, field types, and completeness.",
                tool_id="data-profiler",
            ),
            _event(
                step=2,
                kind="observation",
                title="Data profiler result",
                summary=(
                    f"Found {len(columns)} column(s), including "
                    f"{len(numeric_columns)} numeric field(s)."
                ),
                tool_id="data-profiler",
                latency=latency,
            ),
        ),
    }


def plan_calculations(state: DataState) -> dict[str, Any]:
    return {
        "current_step": 3,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=3,
                kind="plan",
                title="Plan step 3",
                summary="Calculate transparent summary metrics for each numeric field.",
            ),
        ),
    }


def calculate_metrics(state: DataState) -> dict[str, Any]:
    metrics, latency = sandbox_calculation_tool(state["rows"], state["numeric_columns"])
    memory = RunWorkingMemory(seed=state["request"].get("memory", ""))
    for metric in metrics:
        memory.add(f"{metric.column} {metric.operation}: {metric.value}")
    return {
        "status": "observing",
        "metrics": [metric.model_dump(mode="json") for metric in metrics],
        "trace": _with_events(
            state,
            _event(
                step=3,
                kind="action",
                title="Use Calculation tool",
                summary="Compute sum, average, minimum, and maximum values.",
                tool_id="calculation-tool",
            ),
            _event(
                step=3,
                kind="observation",
                title="Calculation tool result",
                summary=f"Calculated {len(metrics)} deterministic metric(s).",
                tool_id="calculation-tool",
                latency=latency,
            ),
        ),
    }


def plan_anomalies(state: DataState) -> dict[str, Any]:
    return {
        "current_step": 4,
        "status": "planning",
        "trace": _with_events(
            state,
            _event(
                step=4,
                kind="plan",
                title="Plan step 4",
                summary="Apply a transparent IQR rule to flag unusual numeric values.",
            ),
        ),
    }


def detect_anomalies(state: DataState) -> dict[str, Any]:
    anomalies, latency = sandbox_anomaly_detector(state["rows"], state["numeric_columns"])
    return {
        "status": "observing",
        "anomalies": [anomaly.model_dump(mode="json") for anomaly in anomalies],
        "trace": _with_events(
            state,
            _event(
                step=4,
                kind="action",
                title="Use Anomaly detector",
                summary="Check numeric values against per-column IQR bounds.",
                tool_id="anomaly-detector",
            ),
            _event(
                step=4,
                kind="observation",
                title="Anomaly detector result",
                summary=f"Flagged {len(anomalies)} numeric outlier(s).",
                tool_id="anomaly-detector",
                latency=latency,
            ),
        ),
    }


def limit_reached(state: DataState) -> dict[str, Any]:
    step = state["current_step"]
    return {
        "status": "limit-reached",
        "output": (
            f"Partial data analysis. The configured {state['request']['maxSteps']}-step limit "
            "was reached before the report could be assembled."
        ),
        "confidence": "not-assessed",
        "trace": _with_events(
            state,
            _event(
                step=step,
                kind="decision",
                title="Step limit reached",
                summary=f"The agent stopped after {step} data-processing steps.",
            ),
        ),
    }


def synthesize(state: DataState) -> dict[str, Any]:
    metrics = [DataMetric.model_validate(item) for item in state["metrics"]]
    anomalies = [DataAnomaly.model_validate(item) for item in state["anomalies"]]
    metric_lines = (
        "\n".join(f"- {metric.column} {metric.operation}: {metric.value:g}" for metric in metrics)
        or "- No numeric metrics were available."
    )
    anomaly_lines = (
        "\n".join(
            f"- Row {item.rowNumber}, {item.column}={item.value:g}: {item.reason}"
            for item in anomalies
        )
        or "- No IQR outliers detected."
    )
    missing_total = sum(state["missing"].values())
    output = (
        "Data analysis\n"
        f"Analyzed {len(state['rows'])} rows across {len(state['columns'])} columns. "
        f"Found {missing_total} missing values and {len(anomalies)} numeric outliers.\n\n"
        "Metrics\n"
        f"{metric_lines}\n\n"
        "Anomalies\n"
        f"{anomaly_lines}\n\n"
        "Method\n"
        "Numeric fields use deterministic sum, average, minimum, and maximum calculations. "
        "Outliers use the 1.5 x IQR rule.\n\n"
        "Confidence: High"
    )
    return {
        "status": "completed",
        "output": output,
        "confidence": "high",
        "trace": _with_events(
            state,
            _event(
                step=4,
                kind="decision",
                title="Data analysis complete",
                summary=(
                    "The metrics and anomaly review satisfy the completion condition: "
                    f"{state['request']['completionCondition']}"
                ),
            ),
            _event(step=4, kind="output", title="Final data result", summary=output),
        ),
    }


def _after_validate(state: DataState) -> str:
    return "stop" if state["status"] == "failed" else "continue"


def _after_reader(state: DataState) -> str:
    if state["status"] == "failed":
        return "stop"
    return _after_step(state)


def _after_step(state: DataState) -> str:
    return "limit" if state["current_step"] >= state["request"]["maxSteps"] else "continue"


def build_data_graph():
    builder = StateGraph(DataState)
    builder.add_node("validate", validate)
    builder.add_node("plan_reader", plan_reader)
    builder.add_node("read_table", read_table)
    builder.add_node("plan_profile", plan_profile)
    builder.add_node("profile_data", profile_data)
    builder.add_node("plan_calculations", plan_calculations)
    builder.add_node("calculate_metrics", calculate_metrics)
    builder.add_node("plan_anomalies", plan_anomalies)
    builder.add_node("detect_anomalies", detect_anomalies)
    builder.add_node("limit", limit_reached)
    builder.add_node("synthesize", synthesize)

    builder.add_edge(START, "validate")
    builder.add_conditional_edges(
        "validate", _after_validate, {"continue": "plan_reader", "stop": END}
    )
    builder.add_edge("plan_reader", "read_table")
    builder.add_conditional_edges(
        "read_table",
        _after_reader,
        {"continue": "plan_profile", "limit": "limit", "stop": END},
    )
    builder.add_edge("plan_profile", "profile_data")
    builder.add_conditional_edges(
        "profile_data", _after_step, {"continue": "plan_calculations", "limit": "limit"}
    )
    builder.add_edge("plan_calculations", "calculate_metrics")
    builder.add_conditional_edges(
        "calculate_metrics", _after_step, {"continue": "plan_anomalies", "limit": "limit"}
    )
    builder.add_edge("plan_anomalies", "detect_anomalies")
    builder.add_edge("detect_anomalies", "synthesize")
    builder.add_edge("limit", END)
    builder.add_edge("synthesize", END)
    return builder.compile(checkpointer=InMemorySaver())


DATA_GRAPH = build_data_graph()


def run_data_agent(request: DataRunRequest) -> DataRunResult:
    run_id = f"run-{uuid4().hex}"
    query = request.input.strip() or request.goal.strip()
    initial: DataState = {
        "request": request.model_dump(mode="json"),
        "query": query,
        "current_step": 0,
        "status": "planning",
        "trace": [],
        "rows": [],
        "columns": [],
        "numeric_columns": [],
        "missing": {},
        "metrics": [],
        "anomalies": [],
        "output": "",
        "confidence": "not-assessed",
    }
    state = DATA_GRAPH.invoke(
        initial,
        config={"configurable": {"thread_id": run_id}, "run_name": "flowcraft-data-agent"},
    )
    return DataRunResult(
        runId=run_id,
        status=state["status"],
        output=state["output"],
        trace=[TraceEvent.model_validate(event) for event in state["trace"]],
        stepsUsed=state["current_step"],
        datasetCount=len(request.datasets),
        rowCount=len(state["rows"]),
        columnCount=len(state["columns"]),
        metrics=[DataMetric.model_validate(item) for item in state["metrics"]],
        anomalies=[DataAnomaly.model_validate(item) for item in state["anomalies"]],
        confidence=state["confidence"],
    )
