from app.agents.document import run_document_agent
from app.models import DocumentRunRequest
from app.tools.document import REQUIRED_DOCUMENT_TOOL_IDS

SAMPLE_DOCUMENT = """Workspace Access Policy

Recovery steps
Users can restore access from Workspace settings under Security by selecting Restore access.

Owner escalation
If settings are unavailable, a workspace owner can initiate account recovery for the user.

Verification window
The recovery verification email must be completed within 30 minutes.
"""


def make_request(**overrides) -> DocumentRunRequest:
    values = {
        "goal": "Explain how to restore access to a locked workspace",
        "instructions": "Use only the supplied document and cite every claim.",
        "input": "How do I recover a locked workspace and how long is verification valid?",
        "documents": [
            {
                "id": "policy-1",
                "name": "workspace-policy.txt",
                "mimeType": "text/plain",
                "content": SAMPLE_DOCUMENT,
            }
        ],
        "allowedTools": sorted(REQUIRED_DOCUMENT_TOOL_IDS),
        "maxSteps": 4,
    }
    values.update(overrides)
    return DocumentRunRequest(**values)


def test_document_agent_completes_with_citations() -> None:
    result = run_document_agent(make_request())

    assert result.runtime == "langgraph"
    assert result.status == "completed"
    assert result.stepsUsed == 4
    assert result.documentCount == 1
    assert len(result.citations) == 3
    assert {event.kind for event in result.trace} >= {
        "plan",
        "action",
        "observation",
        "decision",
        "output",
    }
    assert "workspace-policy.txt" in result.output


def test_document_agent_enforces_step_limit() -> None:
    result = run_document_agent(make_request(maxSteps=2))

    assert result.status == "limit-reached"
    assert result.stepsUsed == 2
    assert result.trace[-1].title == "Step limit reached"


def test_document_agent_denies_missing_tool() -> None:
    result = run_document_agent(make_request(allowedTools=["document-reader"]))

    assert result.status == "failed"
    assert result.stepsUsed == 0
    assert result.trace[-1].kind == "error"


def test_document_agent_rejects_unsupported_mime_type() -> None:
    documents = [
        {
            "id": "binary-1",
            "name": "archive.bin",
            "mimeType": "application/octet-stream",
            "content": "not a supported text document",
        }
    ]
    result = run_document_agent(make_request(documents=documents))

    assert result.status == "failed"
    assert result.stepsUsed == 1
    assert "could be read" in result.output
