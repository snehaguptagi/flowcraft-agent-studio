from fastapi.testclient import TestClient

from app.main import app
from app.tools.research import REQUIRED_RESEARCH_TOOL_IDS

client = TestClient(app)


def test_health_and_agent_catalog() -> None:
    health = client.get("/health")
    agents = client.get("/v1/agents")

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert agents.status_code == 200
    assert agents.json()[0]["id"] == "research-agent"


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
