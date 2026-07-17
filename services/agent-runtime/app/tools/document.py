import re
from time import perf_counter

from app.models import DocumentCitation, DocumentInput, DocumentSection, ToolDefinition

DOCUMENT_TOOLS = [
    ToolDefinition(
        id="document-reader",
        name="Document reader",
        description="Open approved text documents for the current run",
        risk="low",
    ),
    ToolDefinition(
        id="text-extractor",
        name="Text extractor",
        description="Normalize readable text while preserving document identity",
        risk="low",
    ),
    ToolDefinition(
        id="section-finder",
        name="Section finder",
        description="Split documents into named, traceable sections",
        risk="low",
    ),
    ToolDefinition(
        id="citation-collector",
        name="Citation collector",
        description="Select relevant evidence and attach document citations",
        risk="low",
    ),
]

REQUIRED_DOCUMENT_TOOL_IDS = {tool.id for tool in DOCUMENT_TOOLS}
SUPPORTED_TEXT_MIME_TYPES = {
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
}

STOP_WORDS = {
    "about",
    "after",
    "also",
    "and",
    "are",
    "can",
    "document",
    "for",
    "from",
    "have",
    "how",
    "into",
    "should",
    "that",
    "the",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
}


def sandbox_document_reader(
    documents: list[DocumentInput],
) -> tuple[list[DocumentInput], list[str], int]:
    started = perf_counter()
    accepted: list[DocumentInput] = []
    errors: list[str] = []
    for document in documents:
        if document.mimeType not in SUPPORTED_TEXT_MIME_TYPES:
            errors.append(f"{document.name} uses unsupported type {document.mimeType}.")
        elif not document.content.strip():
            errors.append(f"{document.name} is empty.")
        else:
            accepted.append(document)
    return accepted, errors, max(1, round((perf_counter() - started) * 1_000))


def sandbox_text_extractor(
    documents: list[DocumentInput],
) -> tuple[list[DocumentInput], int]:
    started = perf_counter()
    extracted = [
        document.model_copy(update={"content": re.sub(r"\r\n?", "\n", document.content).strip()})
        for document in documents
    ]
    return extracted, max(1, round((perf_counter() - started) * 1_000))


def sandbox_section_finder(
    documents: list[DocumentInput],
) -> tuple[list[DocumentSection], int]:
    started = perf_counter()
    sections: list[DocumentSection] = []
    for document in documents:
        blocks = [
            block.strip() for block in re.split(r"\n\s*\n", document.content) if block.strip()
        ]
        for index, block in enumerate(blocks):
            lines = [line.strip() for line in block.splitlines() if line.strip()]
            if len(lines) > 1 and len(lines[0]) <= 100:
                heading = lines[0].lstrip("# ").strip()
                text = " ".join(lines[1:])
            else:
                heading = f"Passage {index + 1}"
                text = " ".join(lines)
            if text:
                sections.append(
                    DocumentSection(
                        documentId=document.id,
                        documentName=document.name,
                        section=heading or f"Passage {index + 1}",
                        text=text,
                        index=index,
                    )
                )
    return sections, max(1, round((perf_counter() - started) * 1_000))


def _query_tokens(query: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", query.lower())
        if len(token) > 2 and token not in STOP_WORDS
    }


def sandbox_citation_collector(
    sections: list[DocumentSection], query: str, limit: int = 3
) -> tuple[list[DocumentCitation], int]:
    started = perf_counter()
    tokens = _query_tokens(query)

    def score(section: DocumentSection) -> tuple[int, int]:
        searchable = f"{section.section} {section.text}".lower()
        return (sum(1 for token in tokens if token in searchable), -section.index)

    ranked = sorted(sections, key=score, reverse=True)
    citations = [
        DocumentCitation(
            documentId=section.documentId,
            documentName=section.documentName,
            section=section.section,
            quote=section.text[:280],
            label=f"[{index}]",
        )
        for index, section in enumerate(ranked[:limit], start=1)
    ]
    return citations, max(1, round((perf_counter() - started) * 1_000))
