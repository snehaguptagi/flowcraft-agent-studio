# Flowcraft product design

## Product definition

Flowcraft is a visual AI workflow builder. A user creates a workflow by placing reusable nodes on a canvas, connecting them, configuring each step, running the workflow, and inspecting the result.

The default mental model is a pipeline, not an autonomous agent:

`Input → Prompt → AI model → Output`

Logic, retrieval, structured output, and data transformations can be added as explicit steps. Agent nodes are an advanced option for the smaller set of tasks that cannot be expressed sensibly as a fixed sequence.

## Main screen

- **Top bar:** workflow name, autosave state, history, templates, save/export, and run.
- **Left library:** Input, AI, Logic, optional Agent, and Output nodes.
- **Canvas:** draggable nodes and visible connections.
- **Right inspector:** configuration for the selected node.
- **Bottom console:** execution log, optional agent trace, outputs, and errors.

## Primary user flow

1. Start from a template or blank canvas.
2. Add an input node.
3. Add and configure a prompt or AI transformation.
4. Add a model node.
5. Add an output node.
6. Connect the nodes in execution order.
7. Validate and run.
8. Inspect outputs and errors, then save or export the workflow.

## When an Agent node makes sense

Use an Agent node only when the next action cannot be known in advance and the node must choose among approved tools over multiple steps. Examples include researching until enough evidence is found or examining a document set to locate relevant sections.

Do not use an Agent node for a fixed prompt, summarization, classification, translation, extraction, formatting, or a known sequence of transformations. Those are clearer, cheaper, and easier to test as standard workflow nodes.

## Design principle

Flowcraft should make the simple path obvious and the powerful path available. Autonomy is never the default and must not obscure the workflow a user designed.

## Workflow editor interaction model

The editor follows the interaction pattern established by tools such as n8n without copying their branding:

- The canvas is the primary workspace and reads from left to right.
- The first node is a trigger; the last node is an output.
- Every step has a visible input port on the left and output port on the right when applicable.
- Dragging an output port shows a live connection line; dropping on an input port creates the connection.
- Clicking an output port and then a highlighted target is an accessible alternative.
- Selecting a connection exposes a clear delete action.
- The left panel adds steps, the right panel edits the selected step, and the bottom panel shows run data.
- **Test workflow** validates the graph, executes it in dependency order, and exposes intermediate and final outputs.
- The full canvas is the default state. The settings inspector opens only after selecting a step, and the run console remains compact until execution or inspection requires it.
- The node library starts with a short suggested set. Agent nodes live behind an explicit advanced disclosure so deterministic workflows remain the primary mental model.
- Runtime truth is visible in the interface: the local deterministic demonstration is labeled, and unconfigured live providers cannot silently fall back to a fake response.

The default demo is a complete local workflow: sample customer input → prompt construction → AI response demonstration → returned chat response.
