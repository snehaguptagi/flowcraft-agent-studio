# Flowcraft Product Requirements Document

**Version:** 1.0  
**Status:** Approved for MVP implementation  
**Last updated:** 16 July 2026  
**Product:** Flowcraft AI Workflow Studio

## 1. Product summary

Flowcraft is a visual, no-code workspace for composing and testing generative AI workflows. A user builds a workflow by adding nodes to a canvas, connecting them into a directed graph, configuring each node, validating the graph, and running it while inspecting node-level outputs and execution logs.

The MVP is an interactive product prototype. It provides a complete local workflow-building experience and a deterministic sandbox execution engine. It does not send data to external AI providers or require API keys.

## 2. Problem statement

Prototyping a generative AI application typically requires developers to write orchestration code before a team can evaluate the underlying workflow. Non-technical product, operations, and domain experts cannot easily see how inputs, prompts, retrieval, models, logic, and outputs fit together.

Flowcraft should make this structure visible and editable so a user can answer three questions quickly:

1. What does the workflow do?
2. Is the workflow configured correctly?
3. What happened at every step when it ran?

## 3. Goals

- Let a user create an AI workflow without writing code.
- Make workflow structure understandable at a glance.
- Provide useful configuration controls for each node type.
- Detect invalid workflow structures before execution.
- Visualize execution state and expose intermediate outputs.
- Preserve local work automatically and support portable JSON files.
- Provide a polished reference experience suitable for demonstrating the product direction.

## 4. Non-goals for the MVP

- Calling live OpenAI, Gemini, or Claude APIs.
- Managing provider credentials or billing.
- Multi-user collaboration, comments, or presence.
- Cloud-synced workflow storage or version history.
- Production-grade document parsing, vector databases, or web search.
- Executing arbitrary user code.
- Role-based access control or organization administration.

These capabilities may be added after the interaction model and workflow semantics have been validated.

## 5. Target users

### Primary: AI product builder

Creates and demonstrates workflow concepts, tunes prompts and model settings, and needs a fast way to communicate system behavior.

### Secondary: Operations or domain specialist

Understands the business process but may not write code. Needs to assemble inputs, rules, and AI steps visually.

### Secondary: Engineer or solutions architect

Uses the visual graph as a specification, tests edge cases, and exports a portable workflow definition for later implementation.

## 6. Core user journey

1. The user opens Flowcraft and sees a working support-copilot template.
2. The user searches or browses the node library.
3. The user clicks a node or drags it onto the canvas.
4. The user positions the node and connects output and input ports.
5. The user selects a node and edits its configuration.
6. Flowcraft saves the draft locally after changes.
7. The user runs the workflow.
8. Flowcraft validates the graph and either shows actionable errors or executes nodes in dependency order.
9. Running and completed nodes are visually identified.
10. The user reviews execution events, latency, and intermediate outputs.
11. The user exports the workflow as JSON or imports a previously exported workflow.

## 7. Functional requirements

### 7.1 Workflow canvas — P0

- Display workflow nodes on a spatial canvas.
- Allow nodes to be repositioned using pointer drag.
- Allow node types to be dragged from the library and dropped at a canvas position.
- Connect a source node to a target node through visible ports.
- Render directional connections between nodes.
- Support canvas panning, zooming, reset-to-100%, and fit-to-view.
- Allow node selection and deletion.
- Provide a minimap for orientation.
- Support undo and redo for graph changes.

### 7.2 Node library — P0

- Organize nodes into Input, AI, Logic, and Output groups.
- Support search by name, description, and category.
- Include the following node types:
  - Input: Text input, File upload, URL input
  - AI: Prompt, LLM, Embedding, RAG, Summarizer, Translator, Classification, Structured output
  - Logic: If/Else, Merge, Variable store, Delay
  - Output: Chat, Markdown, JSON, Download
- Adding a node should select it and open its configuration.

### 7.3 Node configuration — P0

- Edit a node's display name.
- Edit applicable input values and prompt instructions.
- Configure provider, model, temperature, and token limit for model nodes.
- Configure variables and node-specific settings when applicable.
- Display the latest output and latency for the selected node.
- Save changes automatically to the local draft.

### 7.4 Validation — P0

Before execution, Flowcraft must detect and explain:

- Missing required input values.
- Missing prompts or model selections.
- Disconnected non-input nodes.
- Connections referencing missing nodes.
- Circular dependencies.

Validation errors must identify the affected node where possible and prevent execution until resolved.

### 7.5 Workflow execution — P0

- Execute nodes in topological dependency order.
- Set nodes to queued, running, completed, or failed states.
- Highlight the currently running node.
- Stop before execution when validation fails.
- Capture the output and latency of every executed node.
- Show a final workflow duration and completion event.
- Use deterministic sandbox outputs for the MVP.

### 7.6 Logs and outputs — P0

- Provide separate views for execution logs, node outputs, and errors.
- Include event time, severity, node name, message, and latency where available.
- Allow the console to be collapsed and cleared.
- Show a clean empty state when there are no outputs or errors.

### 7.7 Persistence and portability — P0

- Autosave the active workflow to browser local storage.
- Restore the local workflow on the next visit.
- Export the workflow name, nodes, configurations, positions, and connections as JSON.
- Import a compatible JSON workflow and reject malformed files.
- Provide a blank workflow action and a reusable starter template.

### 7.8 Presentation and accessibility — P1

- Support light and dark themes.
- Provide keyboard focus indicators and descriptive control labels.
- Respect reduced-motion preferences.
- Keep the main builder usable on common laptop and tablet-width viewports.
- Use consistent states and colors without relying on color alone for meaning.

## 8. Product layout

- **Top toolbar:** product identity, workflow name, save state, history, templates, export, run, account placeholder.
- **Left panel:** searchable node library.
- **Center:** workflow canvas, health summary, zoom controls, and minimap.
- **Right panel:** configuration and latest output for the selected node.
- **Bottom panel:** execution log, outputs, and validation errors.

## 9. Workflow data model

### Workflow

- `version`: export schema version
- `name`: user-editable workflow name
- `nodes`: ordered collection of node definitions
- `edges`: directed connections between nodes

### Node

- `id`: unique identifier
- `type`: stable node type
- `category`: Input, AI, Logic, or Output
- `name`: user-editable display name
- `description`: node purpose
- `x`, `y`: canvas position
- `status`: idle, pending, running, completed, or failed
- `config`: type-specific configuration
- `output`: latest execution result
- `latency`: latest execution time in milliseconds

### Edge

- `id`: unique identifier
- `from`: source node ID
- `to`: target node ID

## 10. Technical approach

- **Application:** React 19 with TypeScript, delivered through vinext/Vite.
- **Styling:** responsive custom CSS with no runtime UI framework dependency.
- **State:** React client state with browser local storage for device-local persistence.
- **Execution:** client-side deterministic sandbox engine using topological graph traversal.
- **Deployment:** Cloudflare-compatible ESM output through the Sites configuration.
- **Testing:** production build, linting, and server-rendered HTML smoke test.

The architecture intentionally keeps the MVP self-contained. A production release would move execution, secrets, provider calls, durable workflows, and audit logs to authenticated server-side services.

## 11. Acceptance criteria

The MVP is accepted when:

- The default five-node workflow is visible and understandable on first load.
- A user can add, move, select, configure, connect, and remove nodes.
- Invalid graphs produce actionable errors and do not run.
- A valid graph visibly executes in dependency order.
- Every completed node exposes an output and latency.
- The execution console records start, node, completion, and error events.
- Refreshing the page restores the local draft.
- Exported JSON can be imported to reconstruct the workflow.
- The application passes its production build, lint, and rendering test.
- A new contributor can install and run the project using the README.

## 12. Success measures

For a future usability study:

- At least 80% of participants can modify and run the starter workflow without assistance.
- Median time to add, configure, and connect a node is under two minutes.
- At least 90% of validation failures are understood without external documentation.
- Users can accurately describe the execution path after one run.

## 13. Risks and mitigations

- **Users may mistake sandbox output for a live model response.** Label execution as sandbox mode and document the limitation.
- **Large graphs may become difficult to navigate.** Provide zoom, pan, fit, and a minimap; evaluate auto-layout later.
- **Local storage is device-specific.** Provide JSON import/export and plan durable authenticated storage for a later release.
- **Node configuration varies by provider.** Use a stable common configuration model first and add provider-specific schemas after live integrations are selected.

## 14. Release plan

### MVP — current

Visual builder, starter template, node configuration, validation, sandbox execution, logs, local persistence, JSON portability, themes, and responsive layout.

### Next

Server-side workflow execution, encrypted provider credentials, real LLM streaming, durable workflow records, and production error handling.

### Later

Collaboration, workflow versioning, reusable components, approval nodes, memory, web search, multimodal nodes, evaluation datasets, and observability dashboards.

