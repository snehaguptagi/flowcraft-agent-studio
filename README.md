# Flowcraft Agent Studio

Flowcraft is a visual studio for building, running, inspecting, and controlling AI agents and deterministic workflows without writing orchestration code.

It supports three product patterns:

- **Workflow mode:** fixed, predictable steps
- **Agent mode:** goal-driven planning and tool use
- **Hybrid mode:** controlled workflows containing agentic steps

The agentic product contract and delivery sequence are defined in [PRD.md](./PRD.md).

## Current milestone

**Agent 1: Research Agent**

The current implementation includes:

- Shared agent configuration and runtime states
- Research Agent with a goal, role, instructions, and completion condition
- Explicit tool allowlist for search, page reading, and evidence notes
- Working-memory, maximum-step, timeout, and approval settings
- Plan → action → observation → decision execution loop
- Structured Agent Trace panel
- Hybrid execution with deterministic upstream and downstream nodes
- Validation of agent goals, tools, models, and limits
- Local autosave and versioned JSON import/export

Document, Data Analyst, Writer, and Supervisor agents are shown in the library as planned and will be implemented one at a time.

## Important MVP boundary

The Research Agent currently runs through deterministic sandbox tools. It demonstrates the agent interaction, safety, configuration, and trace model without sending data to external AI services.

Production model calls, web access, credentials, durable memory, approvals, and privileged tools must run through a secure server-side agent runtime.

## Run locally

### Requirements

- Node.js 22.13 or newer
- npm

### Setup

```bash
git clone https://github.com/snehaguptagi/flowcraft-agent-studio.git
cd flowcraft-agent-studio
npm ci
npm run dev
```

Open the local URL printed by the development server, normally [http://localhost:3000](http://localhost:3000).

No environment variables are required for the sandbox MVP.

## Verification

```bash
npm run build
npm run lint
npm test
```

## Project structure

```text
app/
  page.tsx                  Visual builder, validation and workflow orchestration
  lib/agent-runtime.ts      Shared agent contract and Research Agent sandbox runtime
  globals.css               Product design system and responsive layout
  layout.tsx                Document shell and social metadata
public/
  og.png                    Social sharing artwork
tests/
  rendered-html.test.mjs    Server-rendered smoke test
.openai/
  hosting.json              Sites deployment configuration
PRD.md                      Agentic product source of truth
```

## Technology

- React 19 and TypeScript
- vinext and Vite
- Custom visual graph canvas
- Browser local storage for device-local drafts
- Cloudflare-compatible deployment output
- GitHub repository: [snehaguptagi/flowcraft-agent-studio](https://github.com/snehaguptagi/flowcraft-agent-studio)

## Deployed application

[Open Flowcraft](https://flowcraft-ai-workflow-studio.pwc-genai-la-3031.chatgpt.site)
