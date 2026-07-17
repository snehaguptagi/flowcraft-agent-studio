# ADR-001: Agent runtime, observability, and memory platform

- **Status:** Accepted
- **Date:** 17 July 2026
- **Decision owners:** Flowcraft product and engineering

## Context

Flowcraft needs one reusable technical foundation for specialist agents. The foundation must support visible state transitions, tool permissions, limits, approvals, resumable execution, evaluation, and several kinds of memory without coupling the visual editor to one model provider.

Agent 1 is the Research Agent. It must prove the runtime contract safely before the product adds live model calls, web access, privileged connectors, or persistent user memory.

## Decision

### LangGraph is the execution runtime

Every server-backed specialist agent is implemented as a typed LangGraph graph. Graph nodes represent meaningful work such as validation, planning, tool execution, observation, synthesis, approval, and failure handling. Conditional edges make limits and completion behavior explicit.

The React editor remains the product surface and workflow authoring system. It sends a versioned run request to a Python FastAPI service and renders Flowcraft trace events returned by that service.

### LangSmith is engineering observability, not the product audit log

LangSmith tracing is opt-in through server-only environment variables. We use it for debugging, datasets, offline evaluation, and regression testing. Flowcraft also stores its own stable trace schema because customers need a product-facing explanation, approval history, and audit record that must not depend on one observability vendor.

### LangMem is relevant later, but not required for Agent 1

The runtime exposes a memory boundary now. LangGraph checkpointers manage run and thread state. LangMem may later extract and consolidate structured long-term memories after retention policy, tenancy, deletion, provenance, and evaluation requirements are defined.

LangMem will not be used as the document retrieval system. Documents require indexed chunks, provenance, access control, and citations through a separate retrieval layer.

## Agent 1 implementation

The first Research Agent uses:

- FastAPI with `/health`, `/v1/agents`, and `/v1/agents/research/runs` endpoints.
- A LangGraph state graph with validation, plan, search, read, note, limit, and synthesis stages.
- An in-memory LangGraph checkpointer for local development.
- Typed Pydantic request, trace, source, and result models.
- Deterministic sandbox implementations of `web-search`, `page-reader`, and `note-collector`.
- An optional frontend API URL with an automatic browser-sandbox fallback.

This is intentionally a real orchestration service with safe fake tools. Live search and a model adapter are separate increments because they introduce credentials, external data, prompt-injection handling, usage costs, and new acceptance tests.

## Agent 2 implementation

The Document Agent reuses the same FastAPI, LangGraph, trace, checkpointer, limits, and frontend-fallback contracts. Its typed graph opens approved documents, normalizes text, separates named sections, ranks relevant evidence, and assembles citations.

The first increment accepts run-scoped TXT, Markdown, CSV, and JSON text up to 100,000 characters per document. It does not persist uploaded content. PDF and DOCX require a controlled server-side binary parser and are intentionally deferred. Document content and citations remain part of the retrieval/provenance boundary and are not written to LangMem.

## Consequences

### Benefits

- All agents share one explicit state and trace contract.
- Human approval and resumability have a natural graph representation.
- The browser never needs provider credentials.
- Observability can be enabled without changing product data contracts.
- Memory can evolve without mixing short-term state, user facts, and document retrieval.

### Costs

- The product has both TypeScript frontend types and Python API types; contract tests or generated clients should be added before public integrations.
- Running locally requires both Node.js and Python processes when the real runtime is enabled.
- Production persistence, queues, authentication, and event streaming remain future infrastructure work.

## Alternatives considered

- **Client-only agent loop:** useful for the first interaction prototype, but unsuitable for secrets, durable state, privileged tools, or reliable cancellation.
- **Direct model calls without a graph runtime:** simpler initially, but makes branching, approvals, retries, and resumability harder to inspect and standardize.
- **LangSmith as the only trace store:** strong for engineering telemetry, but does not replace Flowcraft's stable customer-facing audit contract.
- **LangMem immediately for all memory and documents:** premature and conflates different data lifecycles. The product first needs proven memory use cases and governance.
