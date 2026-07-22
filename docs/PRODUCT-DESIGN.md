# Flowcraft product design

## Product definition

Flowcraft is a visual AI workflow builder. A user creates a workflow by placing reusable nodes on a canvas, connecting them, configuring each step, running the workflow, and inspecting the result.

The default mental model is a pipeline, not an autonomous agent:

`Input → Prompt → AI model → Output`

Logic, retrieval, structured output, and data transformations can be added as explicit steps. Agent nodes are an advanced option for the smaller set of tasks that cannot be expressed sensibly as a fixed sequence.

## Main screen

- **Top bar:** workflow name, autosave state, demo template, import/export, and workflow test.
- **Narrow rail:** editor, nodes, executions, new workflow, and theme.
- **Canvas:** the dominant default view, with draggable nodes, visible connections, contextual plus controls, minimap, and zoom.
- **Contextual node picker:** opens over the canvas only while a user is adding a step.
- **Focused node editor:** incoming data, editable parameters, and returned output sit together for the selected node.
- **Run detail drawer:** execution log, optional agent trace, outputs, and errors.
- **Workflow guide:** a compact outcome statement, step count, and direct run action for the loaded template.
- **Template gallery:** complete examples organized by real work rather than technical node types.

## Primary user flow

1. Start from a template or blank canvas.
2. Add an input node from the contextual picker.
3. Use the plus after that node to add and auto-connect a prompt or AI transformation.
4. Add a model node.
5. Add an output node.
6. Connect the nodes in execution order.
7. Test individual steps, pin known data when useful, then validate and run the workflow.
8. Review execution history, outputs, and errors, then save or export the workflow.

## When an Agent node makes sense

Use an Agent node only when the next action cannot be known in advance and the node must choose among approved tools over multiple steps. Examples include researching until enough evidence is found or examining a document set to locate relevant sections.

Do not use an Agent node for a fixed prompt, summarization, classification, translation, extraction, formatting, or a known sequence of transformations. Those are clearer, cheaper, and easier to test as standard workflow nodes.

## Design principle

Flowcraft should make the simple path obvious and the powerful path available. Autonomy is never the default and must not obscure the workflow a user designed.

## Workflow editor interaction model

The editor follows product patterns verified in n8n’s official [feature overview](https://n8n.io/features/), [data-mapping documentation](https://docs.n8n.io/data/data-mapping/data-mapping-ui/), and [execution-history documentation](https://docs.n8n.io/workflows/executions/all-executions/) without copying its branding or exact visual design:

- The canvas is the primary workspace and reads from left to right.
- The first node is a trigger; the last node is an output.
- Every step has a visible input port on the left and output port on the right when applicable.
- Dragging an output port shows a live connection line; dropping on an input port creates the connection.
- Clicking an output port and then a highlighted target is an accessible alternative.
- Selecting a connection exposes a clear delete action.
- The full canvas is the default. The node picker appears only when the user asks to add a step.
- A small plus after a node opens a contextual next-step picker and auto-connects the chosen node.
- Selecting a node opens one working surface where upstream data, parameters, and output can be compared directly.
- Normal steps can be tested independently, and successful output can be pinned as repeatable test data.
- Executions are a first-class history rather than only transient console messages.
- **Test workflow** validates the graph, executes it in dependency order, and exposes intermediate and final outputs.
- The run-detail drawer remains compact until execution or inspection requires it.
- The node library starts with a short suggested set. Agent nodes live behind an explicit advanced disclosure so deterministic workflows remain the primary mental model.
- Runtime truth is visible in the interface: the local deterministic demonstration is labeled, and unconfigured live providers cannot silently fall back to a fake response.

## Flagship workflow

The default demo is now **Inbox triage & draft reply**:

`New email → Triage email → Find policy context → Draft reply → Save draft`

The final step creates an inspectable draft with a recipient, subject, body, and explicit **Not sent** status. This is the right first email automation because it demonstrates useful end-to-end work while preserving human control over external communication.

## Template system

Flowcraft includes five runnable starting points:

- Inbox triage & draft reply
- Customer support answer
- Meeting notes & actions
- Lead qualification
- Document Q&A

Every template communicates its outcome before its mechanics. The gallery shows the category, intended result, description, and number of connected steps. Loading a template replaces the current canvas with a configured local workflow; it never implies that a cloud provider is connected.

## Email connection states

- **Demo mailbox:** connected locally, uses the included sample, and never accesses a real account.
- **Gmail / Outlook not connected:** visible warning and blocked execution.
- **Connected provider:** future server-backed OAuth state with minimum read-and-draft permissions.

Sending remains outside the workflow. The product may prepare and save a draft, but a human must review and send it in the email provider.
