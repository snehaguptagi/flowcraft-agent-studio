from app.agents.data import run_data_agent
from app.models import DataRunRequest
from app.tools.data import REQUIRED_DATA_TOOL_IDS

SAMPLE_CSV = """month,units,revenue
Jan,10,120
Feb,11,135
Mar,9,128
Apr,12,132
May,10,130
Jun,44,910
"""


def make_request(**overrides) -> DataRunRequest:
    values = {
        "goal": "Summarize performance and identify unusual values",
        "instructions": "Calculate transparent metrics and explain every anomaly rule.",
        "input": "What are the key metrics and anomalies?",
        "datasets": [
            {
                "id": "sales-1",
                "name": "sales.csv",
                "mimeType": "text/csv",
                "content": SAMPLE_CSV,
            }
        ],
        "allowedTools": sorted(REQUIRED_DATA_TOOL_IDS),
        "maxSteps": 4,
    }
    values.update(overrides)
    return DataRunRequest(**values)


def test_data_agent_completes_with_metrics_and_anomalies() -> None:
    result = run_data_agent(make_request())

    assert result.runtime == "langgraph"
    assert result.status == "completed"
    assert result.stepsUsed == 4
    assert result.rowCount == 6
    assert result.columnCount == 3
    assert len(result.metrics) == 8
    assert any(item.column == "revenue" and item.operation == "average" for item in result.metrics)
    assert any(item.column == "revenue" and item.value == 910 for item in result.anomalies)
    assert {event.kind for event in result.trace} >= {
        "plan",
        "action",
        "observation",
        "decision",
        "output",
    }


def test_data_agent_enforces_step_limit() -> None:
    result = run_data_agent(make_request(maxSteps=2))

    assert result.status == "limit-reached"
    assert result.stepsUsed == 2
    assert result.trace[-1].title == "Step limit reached"


def test_data_agent_denies_missing_tool() -> None:
    result = run_data_agent(make_request(allowedTools=["table-reader"]))

    assert result.status == "failed"
    assert result.stepsUsed == 0
    assert result.trace[-1].kind == "error"


def test_data_agent_rejects_invalid_table() -> None:
    datasets = [
        {
            "id": "bad-1",
            "name": "bad.csv",
            "mimeType": "text/csv",
            "content": ",value\nrow,1",
        }
    ]
    result = run_data_agent(make_request(datasets=datasets))

    assert result.status == "failed"
    assert result.stepsUsed == 1
    assert "could be parsed" in result.output
