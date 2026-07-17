export type AgentPhase =
  | "planning"
  | "acting"
  | "observing"
  | "completed"
  | "failed"
  | "limit-reached";

export type AgentTraceKind =
  | "plan"
  | "action"
  | "observation"
  | "decision"
  | "output"
  | "error";

export type ToolRisk = "low" | "medium" | "high";

export type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  risk: ToolRisk;
};

export type AgentTraceEvent = {
  id: string;
  step: number;
  timestamp: string;
  kind: AgentTraceKind;
  title: string;
  summary: string;
  toolId?: string;
  risk?: ToolRisk;
  latency?: number;
};

export type ResearchAgentConfig = {
  goal: string;
  role: string;
  instructions: string;
  input: string;
  allowedTools: string[];
  memory: string;
  maxSteps: number;
  timeoutSeconds: number;
  approvalPolicy: "never" | "sensitive" | "always";
  completionCondition: string;
  outputFormat: string;
};

export type DocumentInput = {
  id: string;
  name: string;
  mimeType: "text/plain" | "text/markdown" | "text/csv" | "application/json";
  content: string;
};

export type DocumentAgentConfig = ResearchAgentConfig & {
  documents: DocumentInput[];
};

export type AgentRunResult = {
  status: "completed" | "failed" | "limit-reached";
  output: string;
  trace: AgentTraceEvent[];
  stepsUsed: number;
  runtime: "langgraph" | "browser-sandbox";
  fallbackReason?: string;
};

export type AgentRuntimeHooks = {
  onPhase?: (phase: AgentPhase) => void;
  onTrace?: (event: AgentTraceEvent) => void;
};

export const RESEARCH_AGENT_TOOLS: ToolDefinition[] = [
  {
    id: "web-search",
    name: "Web search",
    description: "Find relevant sources for the research goal",
    risk: "low",
  },
  {
    id: "page-reader",
    name: "Page reader",
    description: "Read and extract facts from selected sources",
    risk: "low",
  },
  {
    id: "note-collector",
    name: "Note collector",
    description: "Organize evidence and source references",
    risk: "low",
  },
];

export const DOCUMENT_AGENT_TOOLS: ToolDefinition[] = [
  {
    id: "document-reader",
    name: "Document reader",
    description: "Open approved text documents for the current run",
    risk: "low",
  },
  {
    id: "text-extractor",
    name: "Text extractor",
    description: "Normalize readable text while preserving document identity",
    risk: "low",
  },
  {
    id: "section-finder",
    name: "Section finder",
    description: "Split documents into named, traceable sections",
    risk: "low",
  },
  {
    id: "citation-collector",
    name: "Citation collector",
    description: "Select relevant evidence and attach document citations",
    risk: "low",
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function traceEvent(
  step: number,
  kind: AgentTraceKind,
  title: string,
  summary: string,
  extra: Pick<AgentTraceEvent, "toolId" | "risk" | "latency"> = {},
): AgentTraceEvent {
  return {
    id: `trace-${Date.now()}-${step}-${kind}-${Math.random().toString(36).slice(2, 7)}`,
    step,
    timestamp: new Date().toISOString(),
    kind,
    title,
    summary,
    ...extra,
  };
}

export async function runResearchAgentSandbox(
  config: ResearchAgentConfig,
  hooks: AgentRuntimeHooks = {},
): Promise<AgentRunResult> {
  const trace: AgentTraceEvent[] = [];
  const emit = (event: AgentTraceEvent) => {
    trace.push(event);
    hooks.onTrace?.(event);
  };

  const requiredTools = RESEARCH_AGENT_TOOLS.map((tool) => tool.id);
  const missingTool = requiredTools.find((toolId) => !config.allowedTools.includes(toolId));
  if (missingTool) {
    hooks.onPhase?.("failed");
    emit(
      traceEvent(
        0,
        "error",
        "Required tool unavailable",
        `The Research Agent cannot complete its plan because ${missingTool} is not allowed.`,
      ),
    );
    return {
      status: "failed",
      output: "Research stopped because a required tool was not permitted.",
      trace,
      stepsUsed: 0,
      runtime: "browser-sandbox",
    };
  }

  const subject = config.input.trim() || config.goal.trim();
  const steps = [
    {
      toolId: "web-search",
      plan: `Identify focused search terms and evidence needed for: ${subject}`,
      action: `Search the approved sandbox index for “${subject.slice(0, 120)}”.`,
      observation:
        "Found three relevant sandbox sources: Workspace access guide, Owner-assisted recovery policy, and Security verification guidance.",
      latency: 420,
    },
    {
      toolId: "page-reader",
      plan: "Read the strongest sources and extract only facts that directly answer the goal.",
      action: "Read the three selected sandbox sources and compare their recovery instructions.",
      observation:
        "Evidence agrees on three steps: open Workspace settings and restore access, use owner-assisted recovery when settings are unavailable, and complete verification within 30 minutes.",
      latency: 510,
    },
    {
      toolId: "note-collector",
      plan: "Organize the evidence, remove duplication, and preserve the source labels.",
      action: "Create a concise evidence note with findings, sources, and confidence.",
      observation:
        "The evidence note contains a complete answer, three source references, no conflicting instructions, and high confidence.",
      latency: 290,
    },
  ];

  const allowedStepCount = Math.max(1, Math.min(config.maxSteps, steps.length));
  for (let index = 0; index < allowedStepCount; index += 1) {
    const step = steps[index];
    const stepNumber = index + 1;
    const tool = RESEARCH_AGENT_TOOLS.find((candidate) => candidate.id === step.toolId)!;

    hooks.onPhase?.("planning");
    emit(traceEvent(stepNumber, "plan", `Plan step ${stepNumber}`, step.plan));
    await wait(220);

    hooks.onPhase?.("acting");
    emit(
      traceEvent(stepNumber, "action", `Use ${tool.name}`, step.action, {
        toolId: tool.id,
        risk: tool.risk,
      }),
    );
    await wait(step.latency);

    hooks.onPhase?.("observing");
    emit(
      traceEvent(stepNumber, "observation", `${tool.name} result`, step.observation, {
        toolId: tool.id,
        risk: tool.risk,
        latency: step.latency,
      }),
    );
    await wait(180);
  }

  if (allowedStepCount < steps.length) {
    hooks.onPhase?.("limit-reached");
    emit(
      traceEvent(
        allowedStepCount,
        "decision",
        "Step limit reached",
        `The agent stopped after ${allowedStepCount} steps before its completion condition was satisfied.`,
      ),
    );
    return {
      status: "limit-reached",
      output: `Partial research for “${subject}”. The configured ${config.maxSteps}-step limit was reached before the evidence could be synthesized.`,
      trace,
      stepsUsed: allowedStepCount,
      runtime: "browser-sandbox",
    };
  }

  hooks.onPhase?.("planning");
  emit(
    traceEvent(
      steps.length,
      "decision",
      "Research complete",
      `The evidence satisfies the completion condition: ${config.completionCondition}`,
    ),
  );

  const output = [
    "Research answer",
    "To reset a locked workspace, open Workspace settings → Security → Restore access. If settings are unavailable, ask a workspace owner to start account recovery and complete the verification email within 30 minutes.",
    "",
    "Key findings",
    "• The normal recovery path begins in Workspace settings.",
    "• A workspace owner can initiate recovery when the user cannot access settings.",
    "• The verification link must be completed within 30 minutes.",
    "",
    "Sandbox sources",
    "• Workspace access guide",
    "• Owner-assisted recovery policy",
    "• Security verification guidance",
    "",
    "Confidence: High",
  ].join("\n");

  emit(traceEvent(steps.length, "output", "Final research result", output));
  hooks.onPhase?.("completed");

  return {
    status: "completed",
    output,
    trace,
    stepsUsed: steps.length,
    runtime: "browser-sandbox",
  };
}

type SandboxCitation = {
  documentName: string;
  section: string;
  quote: string;
  label: string;
};

const DOCUMENT_STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "can", "document", "for", "from", "have",
  "how", "into", "should", "that", "the", "this", "what", "when", "where", "which", "with",
]);

function collectSandboxCitations(config: DocumentAgentConfig): SandboxCitation[] {
  const tokens = new Set(
    (config.input || config.goal)
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length > 2 && !DOCUMENT_STOP_WORDS.has(token)) ?? [],
  );
  const passages = config.documents.flatMap((document) =>
    document.content
      .replace(/\r\n?/g, "\n")
      .split(/\n\s*\n/)
      .map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const hasHeading = lines.length > 1 && lines[0].length <= 100;
        return {
          documentName: document.name,
          section: hasHeading ? lines[0].replace(/^#+\s*/, "") : `Passage ${index + 1}`,
          quote: (hasHeading ? lines.slice(1) : lines).join(" ").slice(0, 280),
          index,
        };
      })
      .filter((passage) => passage.quote),
  );
  return passages
    .map((passage) => ({
      ...passage,
      score: [...tokens].filter((token) => `${passage.section} ${passage.quote}`.toLowerCase().includes(token)).length,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 3)
    .map((passage, index) => ({ ...passage, label: `[${index + 1}]` }));
}

export async function runDocumentAgentSandbox(
  config: DocumentAgentConfig,
  hooks: AgentRuntimeHooks = {},
): Promise<AgentRunResult> {
  const trace: AgentTraceEvent[] = [];
  const emit = (event: AgentTraceEvent) => {
    trace.push(event);
    hooks.onTrace?.(event);
  };

  const missingTool = DOCUMENT_AGENT_TOOLS.find(
    (tool) => !config.allowedTools.includes(tool.id),
  );
  if (missingTool || !config.documents.length) {
    hooks.onPhase?.("failed");
    emit(
      traceEvent(
        0,
        "error",
        missingTool ? "Required tool unavailable" : "Document required",
        missingTool
          ? `The Document Agent cannot continue because ${missingTool.id} is not allowed.`
          : "Attach at least one supported text document before running.",
      ),
    );
    return {
      status: "failed",
      output: "Document analysis stopped because its required input or permission was unavailable.",
      trace,
      stepsUsed: 0,
      runtime: "browser-sandbox",
    };
  }

  const characterCount = config.documents.reduce((total, document) => total + document.content.length, 0);
  const citations = collectSandboxCitations(config);
  const steps = [
    {
      toolId: "document-reader",
      plan: "Open only the documents supplied to this run and verify their types.",
      action: `Open ${config.documents.length} approved document(s).`,
      observation: `Opened ${config.documents.length} supported text document(s).`,
      latency: 180,
    },
    {
      toolId: "text-extractor",
      plan: "Normalize readable text while keeping each document identity intact.",
      action: "Normalize line endings and readable text for analysis.",
      observation: `Extracted ${characterCount} characters.`,
      latency: 220,
    },
    {
      toolId: "section-finder",
      plan: "Split the extracted text into named sections with stable provenance.",
      action: "Identify headings and evidence passages in each document.",
      observation: `Identified ${Math.max(citations.length, 1)} relevant section(s).`,
      latency: 240,
    },
    {
      toolId: "citation-collector",
      plan: "Select the sections most relevant to the question and attach citations.",
      action: "Rank evidence passages against the incoming question.",
      observation: `Selected ${citations.length} cited evidence passage(s).`,
      latency: 210,
    },
  ];

  const allowedStepCount = Math.max(1, Math.min(config.maxSteps, steps.length));
  for (let index = 0; index < allowedStepCount; index += 1) {
    const step = steps[index];
    const stepNumber = index + 1;
    const tool = DOCUMENT_AGENT_TOOLS.find((candidate) => candidate.id === step.toolId)!;
    hooks.onPhase?.("planning");
    emit(traceEvent(stepNumber, "plan", `Plan step ${stepNumber}`, step.plan));
    await wait(90);
    hooks.onPhase?.("acting");
    emit(traceEvent(stepNumber, "action", `Use ${tool.name}`, step.action, { toolId: tool.id, risk: tool.risk }));
    await wait(step.latency);
    hooks.onPhase?.("observing");
    emit(traceEvent(stepNumber, "observation", `${tool.name} result`, step.observation, {
      toolId: tool.id,
      risk: tool.risk,
      latency: step.latency,
    }));
    await wait(80);
  }

  if (allowedStepCount < steps.length) {
    hooks.onPhase?.("limit-reached");
    emit(traceEvent(
      allowedStepCount,
      "decision",
      "Step limit reached",
      `The agent stopped after ${allowedStepCount} document-processing steps.`,
    ));
    return {
      status: "limit-reached",
      output: `Partial document analysis. The configured ${config.maxSteps}-step limit was reached before a cited answer could be assembled.`,
      trace,
      stepsUsed: allowedStepCount,
      runtime: "browser-sandbox",
    };
  }

  const evidence = citations.map((citation) => `• ${citation.quote} ${citation.label}`).join("\n");
  const references = citations
    .map((citation) => `${citation.label} ${citation.documentName} — ${citation.section}`)
    .join("\n");
  const answer = citations[0]?.quote ?? "No supported answer was found in the supplied text.";
  const output = [
    "Document answer",
    answer,
    "",
    "Key evidence",
    evidence || "• No relevant evidence was found.",
    "",
    "Citations",
    references || "• None",
    "",
    `Confidence: ${citations.length >= 2 ? "High" : citations.length ? "Medium" : "Low"}`,
  ].join("\n");
  emit(traceEvent(4, "decision", "Document analysis complete", `The cited evidence satisfies: ${config.completionCondition}`));
  emit(traceEvent(4, "output", "Final document result", output));
  hooks.onPhase?.("completed");
  return { status: "completed", output, trace, stepsUsed: 4, runtime: "browser-sandbox" };
}

function phaseForEvent(event: AgentTraceEvent): AgentPhase {
  if (event.kind === "action") return "acting";
  if (event.kind === "observation") return "observing";
  if (event.kind === "output") return "completed";
  if (event.kind === "error") return "failed";
  return "planning";
}

function isAgentRunResult(value: unknown): value is AgentRunResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AgentRunResult>;
  return (
    ["completed", "failed", "limit-reached"].includes(candidate.status ?? "") &&
    candidate.runtime === "langgraph" &&
    typeof candidate.output === "string" &&
    typeof candidate.stepsUsed === "number" &&
    Array.isArray(candidate.trace)
  );
}

async function runServerAgent(
  endpoint: string,
  payload: ResearchAgentConfig | DocumentAgentConfig,
  hooks: AgentRuntimeHooks,
  fallback: () => Promise<AgentRunResult>,
): Promise<AgentRunResult> {
  const apiUrl = process.env.NEXT_PUBLIC_AGENT_API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) return fallback();

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    Math.max(1, payload.timeoutSeconds) * 1_000,
  );

  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Agent service returned ${response.status}`);

    const result: unknown = await response.json();
    if (!isAgentRunResult(result)) throw new Error("Agent service returned an invalid response");

    for (const event of result.trace) {
      hooks.onPhase?.(phaseForEvent(event));
      hooks.onTrace?.(event);
      await wait(55);
    }
    hooks.onPhase?.(result.status);
    return result;
  } catch (error) {
    const fallbackResult = await fallback();
    return {
      ...fallbackResult,
      fallbackReason: error instanceof Error ? error.message : "Agent service unavailable",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function runResearchAgent(
  config: ResearchAgentConfig,
  hooks: AgentRuntimeHooks = {},
): Promise<AgentRunResult> {
  return runServerAgent(
    "/v1/agents/research/runs",
    config,
    hooks,
    () => runResearchAgentSandbox(config, hooks),
  );
}

export async function runDocumentAgent(
  config: DocumentAgentConfig,
  hooks: AgentRuntimeHooks = {},
): Promise<AgentRunResult> {
  return runServerAgent(
    "/v1/agents/document/runs",
    config,
    hooks,
    () => runDocumentAgentSandbox(config, hooks),
  );
}
