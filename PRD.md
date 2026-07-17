# Flowcraft Agent Studio — Product Requirements Document

**Version:** 2.1

**Status:** Approved for incremental implementation

**Last updated:** 17 July 2026

**Product:** Flowcraft Agent Studio

**Release strategy:** Build and validate agents one at a time

## 1. Product in one sentence

Flowcraft is a visual studio where people assemble, run, inspect, and control AI agents and deterministic workflows without writing orchestration code.

## 2. Simple product explanation

The canvas works like a Lego board for AI work. Users connect inputs, agents, tools, memory, decisions, approvals, and outputs. A normal workflow follows a fixed route. An agent receives a goal and can decide which approved tool to use, evaluate the result, and continue until it finishes or reaches a safety limit.

Flowcraft supports three execution modes:

1. **Workflow mode:** fixed, predictable steps.
2. **Agent mode:** goal-driven decisions and tool use.
3. **Hybrid mode:** a controlled workflow containing one or more agentic steps.

Hybrid mode is the primary product direction because it combines autonomy with business control.

## 3. Problem statement

Building useful AI agents currently requires teams to combine model APIs, tool definitions, prompts, memory, loops, approvals, security rules, and observability in code. This creates three problems:

- Domain experts cannot easily design or review agent behavior.
- Teams cannot see why an agent made a decision or used a tool.
- Unbounded autonomy can create operational, security, and cost risks.

Flowcraft should make agent behavior visible, configurable, testable, and governable before it is used in production.

## 4. Product vision

Flowcraft should become the control plane for practical AI agents: a place to define goals, grant tools, set limits, combine agents with deterministic logic, require human decisions, inspect every step, and reuse successful agent designs.

The product should feel simple enough for a product manager and explicit enough for an engineer or security reviewer.

## 5. Product principles

### Controlled autonomy

Agents may choose actions only from tools explicitly granted to them. Every run has step, time, token, and cost limits.

### Observable by default

Every plan, action, tool call, observation, decision, approval, error, and final answer appears in a structured trace.

### Human control

Sensitive or irreversible actions can pause for human approval. A user can stop a run at any time.

### Composable parts

Agents, tools, memory, guardrails, inputs, and outputs are reusable nodes that can be combined into larger systems.

### Predictable boundaries

Deterministic workflow nodes remain available around agentic steps so teams can control inputs, branching, approvals, and final actions.

### Build agents incrementally

Each agent is specified, implemented, tested, and accepted before the next agent is added. New agents reuse the same runtime contract rather than introducing one-off behavior.

## 6. Target users

### AI product builder

Designs agent behavior, selects tools, adjusts prompts and limits, and demonstrates working systems.

### Operations or domain expert

Defines the real-world goal and process, reviews agent decisions, and approves sensitive actions without writing code.

### Engineer or solutions architect

Connects real tools and models, reviews traces, enforces contracts, and moves validated agent designs into production.

### Risk or security reviewer

Inspects tool permissions, data boundaries, approval rules, execution limits, and auditable traces.

## 7. Core concepts

### Agent

A goal-directed node that can plan, choose from allowed tools, observe results, and decide whether to continue or finish.

### Tool

A narrowly defined capability granted to an agent, such as searching the web, reading a document, querying a database, or drafting an email. Tools have typed inputs, outputs, and permission levels.

### Memory

Information available across steps or runs. MVP memory types are working memory for the current run and optional persisted memory for future server-backed releases.

### Guardrail

A rule that validates an input, tool request, observation, or final output. A guardrail may allow, transform, block, or require approval.

### Human approval

A pause that presents the proposed action, reasoning summary, inputs, and risk level to a person before execution continues.

### Supervisor

An agent that delegates tasks to specialist agents, reviews their outputs, and determines when the overall goal is complete.

### Trace

The ordered record of plans, actions, tool calls, observations, decisions, usage, approvals, errors, and outputs from a run.

## 8. Agent runtime contract

Every agent must use the same contract.

### Inputs

- Goal
- User request or upstream value
- Optional context
- Available tools
- Available memory
- Policy and guardrails
- Execution budget

### Configuration

- Agent name and role
- System instructions
- Model and provider
- Allowed tools
- Memory scope
- Maximum steps
- Timeout
- Token or cost budget
- Approval policy
- Completion condition
- Output format

### Runtime states

- Idle
- Queued
- Planning
- Acting
- Waiting for tool
- Observing
- Waiting for approval
- Completed
- Failed
- Stopped
- Limit reached

### Step lifecycle

1. **Plan:** determine the next useful action.
2. **Act:** call one allowed tool or produce a response.
3. **Observe:** record and evaluate the result.
4. **Decide:** continue, retry, request approval, delegate, or finish.
5. **Stop:** finish when the completion condition is met or a limit is reached.

### Outputs

- Final answer or structured result
- Completion status
- Structured trace
- Tool calls and observations
- Usage and latency
- Approval history
- Error details when applicable

## 9. Agent-by-agent delivery roadmap

### Foundation — Agent runtime

Build the reusable Agent node, runtime state machine, step trace, tool permissions, limits, and approval configuration. All specialist agents depend on this foundation.

### Agent 1 — Research Agent

**Purpose:** Investigate a question, collect evidence from approved sources, organize findings, and return a concise answer with source references.

**Initial tools:** web search, page reader, note collector. The first UI increment uses safe sandbox tools; live connectors are added server-side later.

**Completion condition:** enough relevant evidence is collected to answer the goal, or the step limit is reached.

**Output:** answer, key findings, source list, confidence, and full trace.

### Agent 2 — Document Agent

**Purpose:** Read uploaded or connected documents, extract facts, compare content, and produce summaries or structured answers.

**Tools:** document reader, text extractor, section finder, citation collector.

### Agent 3 — Data Analyst Agent

**Purpose:** Inspect tabular data, calculate metrics, identify anomalies, and produce an explanation or structured report.

**Tools:** spreadsheet reader, query/calculation tool, chart or table output.

### Agent 4 — Writer Agent

**Purpose:** Draft or revise content using an approved brief, evidence, tone, and output format.

**Tools:** outline builder, evidence reader, style guide, revision tool.

### Agent 5 — Supervisor Agent

**Purpose:** Break a broad goal into tasks, delegate to specialist agents, review results, and assemble the final outcome.

**Tools:** specialist agents exposed as callable capabilities, approval request, task state.

The Supervisor Agent is intentionally last because delegation should use mature specialist contracts.

## 10. MVP scope

The first agentic MVP includes:

- Existing deterministic workflow canvas and nodes.
- A new Agent category in the node library.
- Shared Agent node configuration.
- Research Agent as the first specialist agent.
- Tool permission selection.
- Working-memory configuration.
- Step, timeout, and approval limits.
- Visible agent plan/act/observe trace.
- Agent execution states on the canvas.
- Hybrid workflows where deterministic nodes feed an Agent node and receive its result.
- Local workflow persistence and JSON portability.
- Deterministic sandbox execution until the secure server runtime is introduced.

## 11. Non-goals for the first agentic MVP

- Unrestricted autonomous browsing or computer control.
- Live external side effects such as sending email, publishing, purchasing, deleting, or modifying third-party data.
- User-provided arbitrary code execution.
- Production credential storage.
- Persistent semantic memory across users or organizations.
- Multi-user collaboration.
- Fully autonomous supervisor behavior before specialist agents are validated.

## 12. Functional requirements

### 12.1 Agent library — P0

- Add an Agent category to the node library.
- Clearly distinguish generic agents from specialist agent templates.
- Show implemented agents separately from planned agents.
- Allow an implemented agent to be added by click or drag-and-drop.

### 12.2 Agent configuration — P0

- Configure role, goal, and system instructions.
- Select model and provider.
- Grant tools from an explicit allowlist.
- Configure working memory.
- Set maximum steps, timeout, and optional token or cost budget.
- Choose approval behavior: never, for sensitive tools, or before every tool.
- Define expected output format and completion condition.
- Autosave configuration changes.

### 12.3 Tool system — P0

- Every tool has a stable ID, description, input schema, output schema, and risk level.
- An agent may call only tools explicitly granted to it.
- Tool calls appear in the trace before and after execution.
- Sensitive tools cannot run without the configured approval.
- Tool errors are returned as observations rather than hidden.

### 12.4 Agent execution — P0

- Validate the goal, instructions, model, tool grants, and limits before execution.
- Run the agent through the shared plan/act/observe/decide loop.
- Enforce the maximum step count and timeout.
- Allow the user to stop an active run.
- Mark a run completed, failed, stopped, or limit reached.
- Pass the final agent output to connected downstream nodes.

### 12.5 Trace inspector — P0

- Show each step in chronological order.
- Distinguish plans, tool calls, observations, decisions, approvals, and final output.
- Show the active agent and step number.
- Include latency and usage when available.
- Allow inspection without exposing hidden provider reasoning. The trace stores concise decision summaries, not private chain-of-thought.

### 12.6 Human approval — P1

- Pause the run when approval is required.
- Present the proposed tool, inputs, expected effect, and risk level.
- Allow approve, reject, or edit-and-approve actions.
- Record the decision in the trace.
- Do not auto-approve when the user is absent.

### 12.7 Workflow canvas — P0

- Preserve existing add, move, connect, delete, pan, zoom, fit, minimap, undo, and redo behavior.
- Support connections between deterministic nodes and Agent nodes.
- Render the current agent state on the node.
- Display a clear visual difference between workflow, agent, tool, memory, and control nodes.

### 12.8 Validation — P0

Detect and explain:

- Missing agent goal or instructions.
- Missing model.
- No allowed tools when the completion condition requires tools.
- Invalid tool IDs or unavailable tools.
- Missing step or timeout limits.
- Disconnected required inputs.
- Broken connections and circular dependencies.
- Sensitive tools without a compatible approval policy.

### 12.9 Persistence and portability — P0

- Autosave the complete agentic workflow locally.
- Include agent policies, allowed tools, limits, memory settings, and connections in JSON export.
- Import compatible schemas and reject malformed or unsupported versions.
- Never export secrets.

## 13. Product layout

- **Top toolbar:** workflow identity, save state, history, templates, run/stop controls.
- **Left panel:** Inputs, Agents, AI, Tools, Memory, Logic, Control, and Outputs.
- **Center canvas:** agentic and deterministic graph with live states.
- **Right panel:** selected node configuration, permissions, limits, and latest output.
- **Bottom panel:** execution trace, outputs, approvals, validation errors, and usage.

## 14. Data model

### Agent definition

- `id`
- `type`
- `name`
- `role`
- `goal`
- `instructions`
- `provider`
- `model`
- `allowedTools[]`
- `memory`
- `limits`
- `approvalPolicy`
- `completionCondition`
- `outputFormat`

### Agent run

- `id`
- `agentId`
- `workflowId`
- `status`
- `startedAt`
- `completedAt`
- `currentStep`
- `trace[]`
- `usage`
- `finalOutput`
- `error`

### Trace event

- `id`
- `step`
- `timestamp`
- `kind`: plan, action, observation, decision, approval, output, error
- `summary`
- `toolId`
- `input`
- `output`
- `risk`
- `latency`

### Tool definition

- `id`
- `name`
- `description`
- `riskLevel`
- `inputSchema`
- `outputSchema`
- `requiresApproval`

## 15. Technical architecture

### Current prototype layer

- React 19 and TypeScript.
- vinext/Vite application structure.
- Custom visual graph canvas.
- Client-side state and local storage.
- Deterministic sandbox agent runtime for safe interaction design.

### Production runtime layer

The production implementation uses a Python service behind the visual editor:

- **FastAPI** exposes versioned agent, run, health, and later approval endpoints.
- **LangGraph** is the authoritative agent orchestration runtime. Each specialist agent is a typed graph with explicit nodes, transitions, limits, and resumable run state.
- **LangSmith** is opt-in from the first server-backed run for engineering traces, evaluation datasets, and regression testing. Flowcraft still owns the user-visible trace and immutable product audit record.
- **LangGraph checkpointers** hold short-term thread and run state. The local service starts with an in-memory checkpointer; production moves to Postgres.
- **A Flowcraft memory interface** separates working, thread, and long-term memory. **LangMem is deferred until a specialist agent has a validated cross-run memory need**, then used selectively for structured memory extraction and consolidation.
- Document retrieval and citations use a dedicated retrieval/indexing layer rather than LangMem. LangMem is not the document knowledge base.
- Server-sent events will stream run events to the canvas after the synchronous Agent 1 API contract is stable.

The runtime layer will add:

- Authenticated server-side agent runs.
- Durable workflow, run, trace, and approval records.
- Encrypted credential and connector management.
- Provider adapters for supported LLMs.
- Typed server-side tools.
- Run cancellation, timeout, retry, queueing, and streaming events.
- Policy enforcement before every tool call.
- Usage, cost, latency, and error observability.

The browser must never receive provider secrets or execute privileged tools directly.

### Agent 1 implementation boundary

The first server-backed Research Agent is deliberately deterministic: it runs approved sandbox research tools through a real LangGraph state graph without requiring a model key or unrestricted web access. This validates the graph contract, typed API, permissions, limits, trace mapping, and frontend fallback before live search or model providers are introduced.

The browser sandbox remains a safe fallback whenever the local agent service is not configured or reachable. A configured server run must identify itself as `langgraph`; a fallback run must identify itself as `browser-sandbox`.

### Memory layers

1. **Run working memory:** transient facts used inside one graph execution.
2. **Thread memory:** resumable state for a workflow conversation, stored by a LangGraph checkpointer.
3. **Long-term semantic memory:** user- or organization-scoped structured facts, added only with explicit retention, deletion, and evaluation rules.
4. **Document knowledge:** indexed source content with provenance and citations; kept separate from personal or procedural memory.

The detailed decision and alternatives are recorded in `docs/architecture/ADR-001-agent-platform.md`.

## 16. Security and safety requirements

- Deny tool access by default.
- Store no credentials in workflow JSON or local storage.
- Execute privileged tools only on the server.
- Validate all tool inputs against schemas.
- Require approval for configured sensitive actions.
- Enforce step, time, token, and cost limits.
- Sanitize untrusted tool outputs before reuse.
- Separate decision summaries from private chain-of-thought.
- Record immutable audit events for production runs.
- Support immediate user cancellation.

## 17. Research Agent acceptance criteria

Agent 1 is complete when:

- A Research Agent can be added from the Agent library.
- Its goal, instructions, model, tools, memory, limits, and approval policy are editable.
- The workflow validator catches missing agent configuration.
- A valid sandbox run produces at least three visible trace steps.
- The trace includes a plan, a tool call, an observation, a decision, and a final output.
- The step limit is enforced and visible.
- The Research Agent output can feed a downstream output node.
- Workflow export/import preserves the full agent configuration.
- The application passes build, lint, and smoke tests.
- A versioned FastAPI endpoint runs the Research Agent through LangGraph.
- The frontend uses the server runtime when configured and safely falls back to the browser sandbox when unavailable.
- LangSmith tracing can be enabled with server-side environment variables without exposing credentials to the browser.

## 18. Success measures

- At least 80% of test users can add and run the Research Agent without assistance.
- Users can correctly explain what the agent did after reading the trace.
- No sandbox run exceeds its configured maximum steps.
- Every tool call is attributable to an agent, step, and permission grant.
- Validation errors are resolved without external documentation in at least 90% of tests.

## 19. Delivery sequence

1. Commit this PRD as the product contract.
2. Connect the repository to a private GitHub remote.
3. Implement the shared Agent node and runtime types.
4. Implement the Research Agent and its sandbox tools.
5. Add the agent trace experience.
6. Validate, commit, push, and deploy Agent 1.
7. Review Agent 1 against its acceptance criteria.
8. Begin the Document Agent only after Agent 1 is accepted.
