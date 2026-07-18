from fastapi.testclient import TestClient

from app.main import app
from app.tools.data import REQUIRED_DATA_TOOL_IDS
from app.tools.document import REQUIRED_DOCUMENT_TOOL_IDS
from app.tools.research import REQUIRED_RESEARCH_TOOL_IDS

client = TestClient(app)


def test_health_and_agent_catalog() -> None:
    health = client.get("/health")
    agents = client.get("/v1/agents")

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert agents.status_code == 200
    assert [agent["id"] for agent in agents.json()] == [
        "research-agent",
        "document-agent",
        "data-agent",
    ]


def test_research_run_endpoint() -> None:
    response = client.post(
        "/v1/agents/research/runs",
        json={
            "goal": "Restore workspace access",
            "instructions": "Use approved sources.",
            "allowedTools": sorted(REQUIRED_RESEARCH_TOOL_IDS),
            "maxSteps": 3,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["runtime"] == "langgraph"
    assert body["status"] == "completed"
    assert body["stepsUsed"] == 3


def test_document_run_endpoint() -> None:
    response = client.post(
        "/v1/agents/document/runs",
        json={
            "goal": "Summarize the recovery policy",
            "instructions": "Use only the supplied text and cite it.",
            "input": "What is the recovery verification deadline?",
            "documents": [
                {
                    "id": "policy-1",
                    "name": "policy.txt",
                    "mimeType": "text/plain",
                    "content": (
                        "Recovery policy\n\nVerification\n"
                        "Complete the recovery verification email within 30 minutes."
                    ),
                }
            ],
            "allowedTools": sorted(REQUIRED_DOCUMENT_TOOL_IDS),
            "maxSteps": 4,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["runtime"] == "langgraph"
    assert body["status"] == "completed"
    assert body["documentCount"] == 1
    assert body["citations"][0]["documentName"] == "policy.txt"


def test_data_run_endpoint() -> None:
    response = client.post(
        "/v1/agents/data/runs",
        json={
            "goal": "Analyze sales",
            "instructions": "Calculate metrics and flag outliers.",
            "input": "What changed?",
            "datasets": [
                {
                    "id": "sales-1",
                    "name": "sales.csv",
                    "mimeType": "text/csv",
                    "content": "month,revenue\nJan,100\nFeb,110\nMar,105\nApr,500",
                }
            ],
            "allowedTools": sorted(REQUIRED_DATA_TOOL_IDS),
            "maxSteps": 4,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["runtime"] == "langgraph"
    assert body["status"] == "completed"
    assert body["rowCount"] == 4
    assert body["metrics"]
