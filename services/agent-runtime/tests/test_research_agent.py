from app.agents.research import run_research_agent
from app.models import ResearchRunRequest
from app.tools.research import REQUIRED_RESEARCH_TOOL_IDS


def make_request(**overrides) -> ResearchRunRequest:
    values = {
        "goal": "Explain how to restore access to a locked workspace",
        "instructions": "Use approved evidence and return a concise sourced answer.",
        "allowedTools": sorted(REQUIRED_RESEARCH_TOOL_IDS),
        "maxSteps": 3,
    }
    values.update(overrides)
    return ResearchRunRequest(**values)


def test_research_agent_completes_with_full_trace() -> None:
    result = run_research_agent(make_request())

    assert result.runtime == "langgraph"
    assert result.status == "completed"
    assert result.stepsUsed == 3
    assert len(result.sources) == 3
    assert {event.kind for event in result.trace} >= {
        "plan",
        "action",
        "observation",
        "decision",
        "output",
    }


def test_research_agent_enforces_step_limit() -> None:
    result = run_research_agent(make_request(maxSteps=1))

    assert result.status == "limit-reached"
    assert result.stepsUsed == 1
    assert result.trace[-1].title == "Step limit reached"


def test_research_agent_denies_missing_tool() -> None:
    result = run_research_agent(make_request(allowedTools=["web-search"]))

    assert result.status == "failed"
    assert result.stepsUsed == 0
    assert result.trace[-1].kind == "error"
