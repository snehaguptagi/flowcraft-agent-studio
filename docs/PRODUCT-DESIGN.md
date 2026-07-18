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
