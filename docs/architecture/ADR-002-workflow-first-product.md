# ADR-002: Workflow-first product architecture

- **Status:** Accepted
- **Date:** 18 July 2026
- **Decision owners:** Flowcraft product and engineering

## Context

The initial implementation overemphasized agents even though the core requirement is a visual AI workflow builder. Most useful AI automations are known sequences: accept an input, prepare context, call a model, apply logic, and return an output. Making every step agentic would add cost, latency, unpredictability, and unnecessary configuration.

## Decision

Flowcraft is workflow-first.

- The default template uses standard Input, Prompt, Model, and Output nodes.
- The editor and workflow graph are the core product.
- Deterministic and model-backed nodes execute in a defined order.
- Agent nodes are optional advanced nodes, not the product identity.
- LangGraph is scoped to server-backed Agent nodes only.
- LangSmith is optional engineering observability and is not required to use the builder.
- LangMem is outside the MVP until a governed long-term-memory use case exists.
- Writer and Supervisor agents are removed from the immediate delivery plan.

## Agent selection rule

Choose a standard workflow node when the operation and order are known. Choose an Agent node only when runtime evidence must determine which approved tool or step comes next.

## Consequences

The product is easier to understand and demonstrate. Standard workflows remain predictable and testable, while the existing Research, Document, and Data Analyst nodes remain useful for genuinely dynamic tasks. The Python runtime becomes an optional local service instead of a requirement for the main canvas experience.
