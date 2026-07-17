from time import perf_counter

from app.models import ResearchSource, ToolDefinition

RESEARCH_TOOLS = [
    ToolDefinition(
        id="web-search",
        name="Web search",
        description="Find relevant sources for the research goal",
        risk="low",
    ),
    ToolDefinition(
        id="page-reader",
        name="Page reader",
        description="Read and extract facts from selected sources",
        risk="low",
    ),
    ToolDefinition(
        id="note-collector",
        name="Note collector",
        description="Organize evidence and source references",
        risk="low",
    ),
]

REQUIRED_RESEARCH_TOOL_IDS = {tool.id for tool in RESEARCH_TOOLS}


def sandbox_web_search(subject: str) -> tuple[list[ResearchSource], int]:
    started = perf_counter()
    sources = [
        ResearchSource(
            title="Workspace access guide",
            url="sandbox://workspace-access-guide",
            excerpt="Open Workspace settings, choose Security, then select Restore access.",
        ),
        ResearchSource(
            title="Owner-assisted recovery policy",
            url="sandbox://owner-assisted-recovery",
            excerpt="A workspace owner can initiate recovery when settings are unavailable.",
        ),
        ResearchSource(
            title="Security verification guidance",
            url="sandbox://security-verification",
            excerpt="Complete the recovery verification email within 30 minutes.",
        ),
    ]
    return sources, max(1, round((perf_counter() - started) * 1_000))


def sandbox_page_reader(sources: list[ResearchSource]) -> tuple[list[str], int]:
    started = perf_counter()
    findings = [source.excerpt for source in sources]
    return findings, max(1, round((perf_counter() - started) * 1_000))


def sandbox_note_collector(findings: list[str]) -> tuple[str, int]:
    started = perf_counter()
    note = " ".join(finding.strip() for finding in findings if finding.strip())
    return note, max(1, round((perf_counter() - started) * 1_000))
