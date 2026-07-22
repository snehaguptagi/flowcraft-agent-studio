# Flowcraft AI Workflow Builder — Product Requirements Document

**Version:** 3.1

**Status:** Approved for workflow-first implementation

**Last updated:** 22 July 2026

**Product:** Flowcraft AI Workflow Builder

## 1. Product in one sentence

Flowcraft lets people visually assemble, run, inspect, save, and reuse AI workflows without writing orchestration code.

## 2. Simple explanation

Flowcraft is like a flowchart that actually runs. A user places blocks on a canvas and connects them:

`Input → Prompt → AI model → Output`

The user can add retrieval, classification, translation, structured output, branching, merging, and data steps when needed. Each connection makes the execution order visible.

Agent nodes are optional advanced blocks. They are used only when a task must decide which approved tool to use next based on evidence found during the run. The product itself is an AI workflow builder, not an agent studio.

## 3. Problem

Teams often assemble AI automations with scattered prompts, scripts, model calls, and integrations. The result is difficult for non-engineers to understand, edit, test, and reuse. Existing low-code tools can also hide data flow or make debugging model behavior difficult.

Flowcraft should make the complete workflow visible: what enters, which step runs, how values move, what each AI step is configured to do, what failed, and what the final output contains.

## 4. Goals

- Make common AI workflows understandable without code.
- Let users build by adding, connecting, and configuring reusable nodes.
- Make execution order, status, output, and errors visible.
- Support local creation and demonstration with minimal setup.
- Keep workflows portable through JSON export and import.
- Allow optional bounded Agent nodes without making autonomy the default.

## 5. Non-goals for the MVP

- A fully autonomous multi-agent platform.
- A Supervisor agent that delegates open-ended work.
- Unrestricted web browsing, computer control, or arbitrary code execution.
- Production credential storage or external side effects.
- Multi-user editing and enterprise access control.
- Long-term personal memory or LangMem integration.
- Using LangGraph for standard fixed workflows.
- Hosting the Python runtime inside the static frontend deployment.

## 6. Target users

### Product or operations builder

Builds and demonstrates repeatable AI workflows without writing orchestration code.

### Domain expert

Defines prompts, rules, examples, and expected outputs, then reviews whether the workflow reflects the real process.

### Engineer or solutions architect

Connects models and integrations, checks schemas and traces, and prepares validated workflows for production infrastructure.

## 7. Product principles

### Workflow first

If the steps are known, they must be represented as explicit connected nodes.

### Simple path first

A new user should understand the default Input → Prompt → Model → Output workflow without learning agent terminology.

### Visible execution

The canvas, execution log, outputs, and errors must show what ran and what happened.

### Advanced only when justified

Agent nodes are used only when runtime evidence must determine the next approved action. They must have tool and step limits.

### Local by default

The frontend must run at localhost without cloud credentials. Optional services should add capability without blocking the basic builder.

## 8. Core concepts

### Workflow

A saved graph containing nodes, connections, configuration, and metadata.

### Node

A reusable step with typed configuration, inputs, outputs, and a visible runtime state.

### Connection

A directed edge that moves a value from an upstream node to a downstream node and defines execution dependencies.

### Run

One execution of the current workflow, including status, logs, outputs, duration, and errors.

### Agent node

An optional bounded node that may choose among explicitly approved tools over multiple steps. Its internal activity appears in a separate trace.

## 9. MVP node library

### Input

- Text input
- Text document input for TXT, Markdown, CSV, and JSON
- Data table input for CSV and JSON
- URL input placeholder

### AI

- Prompt
- Language model
- Embedding
- Retrieval-augmented generation
- Summarizer
- Translator
- Classification
- Structured output

### Logic

- If/Else
- Merge
- Variable store
- Delay

### Optional Agent

- Research Agent
- Document Agent
- Data Analyst

### Output

- Chat output
- Markdown output
- JSON output
- Download output

## 10. Primary user journey

1. Open the app locally or from an optional hosted demo.
2. Start from the standard AI workflow template or a blank canvas.
3. Open the contextual node picker or click the plus after an existing node.
4. Add nodes; contextual additions connect to the preceding step automatically.
5. Select a node and inspect its input data, configure its parameters, and test its output in one focused editor.
6. Pin known step output when repeatable test data will speed up iteration.
7. Run validation and test the complete workflow.
8. Inspect execution history, logs, intermediate outputs, final outputs, and errors.
9. Refine, autosave, export, or import the workflow.

## 11. Functional requirements

### 11.1 Canvas — P0

- Add nodes by click or drag-and-drop.
- Add and auto-connect the next node from a contextual plus beside an existing step.
- Move and delete nodes.
- Connect compatible nodes by port drag-and-drop, two-port clicks, or source-port then target-node clicks.
- Highlight valid target nodes while a connection is in progress.
- Prevent duplicate, self-referential, backwards, and circular connections at creation time.
- Pan, zoom, fit, and use a minimap.
- Undo and redo graph edits.
- Show idle, queued, running, completed, and failed states.

### 11.2 Node configuration — P0

- Edit the selected node's name and type-specific settings.
- Present incoming data, editable parameters, and returned output together for the selected node.
- Configure prompt text and variables.
- Configure model provider, model, temperature, and token limit.
- Configure input values and output formats.
- Autosave configuration changes locally.
- Run a supported standard node independently with available upstream or pinned input.
- Pin or unpin a successful step output for repeatable manual testing.

### 11.3 Workflow execution — P0

- Validate before execution.
- Execute nodes after their upstream dependencies complete.
- Pass upstream values into downstream steps.
- Prevent unsupported circular execution.
- Show run progress and duration.
- Surface errors without hiding failed steps.

### 11.4 Inspection — P0

- Show chronological execution logs.
- Show an execution-history panel containing workflow and manual step runs.
- Show intermediate and final outputs.
- Show validation and runtime errors.
- Show Agent trace events only when an Agent node runs.
- Do not expose hidden model chain-of-thought.

### 11.5 Persistence and portability — P0

- Autosave the complete workflow in browser storage.
- Start with a new storage schema for the workflow-first default.
- Export versioned JSON with no secrets.
- Import compatible workflow JSON and reject malformed files.

### 11.6 Optional Agent nodes — P1

- Keep Research, Document, and Data Analyst nodes available under an Agent category.
- Require explicit goals, instructions, allowed tools, step limits, and timeouts.
- Use browser-safe demonstrations when the optional server is unavailable.
- Use the local FastAPI/LangGraph service when configured.
- Preserve a structured, user-visible trace.
- Do not add Writer or Supervisor agents to the immediate roadmap.

## 12. Agent selection rule

Use a standard workflow node when the operation and sequence are known. This includes prompting, summarization, classification, translation, extraction, formatting, calculations, and fixed retrieval pipelines.

Use an Agent node only when all of these are true:

- The next action cannot be fixed at design time.
- The node must choose among multiple approved tools.
- Multiple steps may be needed to reach a completion condition.
- The task can be bounded by tool, time, and step limits.
- The added autonomy provides clear value over an explicit workflow.

## 13. Product layout

- **Top toolbar:** workflow identity, save state, template, import/export, and workflow test.
- **Narrow navigation rail:** editor, contextual node picker, executions, new workflow, and theme.
- **Canvas:** the default and dominant workspace, with nodes, connections, contextual plus controls, minimap, zoom, and runtime states.
- **Focused node editor:** selected step input data, parameters, and output data in adjacent panes, with step testing and pinned data.
- **Run detail drawer:** execution log, optional Agent trace, outputs, and errors.

## 14. Technical architecture

### Frontend

- React 19 and TypeScript
- vinext and Vite
- Custom visual graph canvas
- Browser local storage for device-local drafts
- Cloudflare-compatible build output

The frontend is the core product and must run independently at `http://localhost:3000`.

### Standard workflow runtime

The current prototype runs standard nodes through the TypeScript workflow executor. Production model calls and credentials will move behind secure server endpoints, but fixed workflows do not require an agent framework.

### Optional Agent-node runtime

- FastAPI provides versioned endpoints for advanced Agent nodes.
- LangGraph orchestrates only those nodes that genuinely need multi-step tool selection.
- LangSmith is optional engineering telemetry, not a product dependency or customer audit store.
- LangMem is deferred until retention, deletion, provenance, tenancy, and evaluation requirements exist.

## 15. Data and safety boundaries

- No secrets in browser storage or workflow exports.
- No arbitrary Python, JavaScript, SQL, formulas, or macros from users.
- No privileged external side effects in the MVP.
- Document and dataset inputs are run-scoped in the optional runtime.
- Agent tools must be explicit, typed, and bounded.
- User-visible traces contain concise event summaries, not private reasoning.

## 16. Acceptance criteria

The MVP is accepted when:

- A first-time user can recognize the product as an AI workflow builder.
- The default canvas shows Input → Prompt → Model → Output without an Agent node.
- A visible Demo workflow control restores a complete runnable workflow.
- The editor opens canvas-first; the configuration inspector appears only for a selected step and the run console expands when needed.
- A selected step opens input, parameters, and output together; a supported normal step can be tested independently and its output can be pinned.
- The contextual plus after a node adds and connects the next selected step.
- Workflow and step tests appear in execution history with status and duration.
- Suggested nodes cover the normal workflow path, while optional Agent nodes are disclosed as an advanced capability.
- The local demo runtime is visibly identified and cannot be mistaken for a live provider call.
- A user can connect two compatible nodes by dragging from the source's right port to the target's left port.
- A live connection preview follows the pointer while a new edge is dragged.
- A user can select and delete an existing connection.
- Test workflow validates the graph and executes connected steps in dependency order.
- A user can add, configure, connect, run, save, export, and import workflows.
- Logs, outputs, and errors are inspectable.
- The frontend runs locally without the Python service.
- Optional Agent nodes still run through a safe fallback or configured local service.
- Build, lint, frontend smoke tests, backend lint, and backend tests pass.
- Documentation clearly distinguishes localhost, GitHub, and the optional hosted demo.

## 17. Delivery priorities

### Now

- Workflow-first product framing and default template
- Reliable node configuration and graph execution
- Local setup and clear documentation
- Public source repository
- Existing optional Research, Document, and Data Analyst nodes

### Next

- Real server-backed model execution for standard AI nodes
- Typed ports and connection compatibility
- Workflow templates and test cases
- Secure connector abstractions
- Persisted run history, execution replay, and server-backed debugging

### Later, only with evidence

- Human approvals for side-effecting tools
- Durable server persistence and collaboration
- Additional Agent nodes
- Long-term memory
- Production hosting for the backend runtime
