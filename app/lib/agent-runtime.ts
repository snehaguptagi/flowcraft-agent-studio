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

export async function runResearchAgent(
  config: ResearchAgentConfig,
  hooks: AgentRuntimeHooks = {},
): Promise<AgentRunResult> {
  const apiUrl = process.env.NEXT_PUBLIC_AGENT_API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) return runResearchAgentSandbox(config, hooks);

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    Math.max(1, config.timeoutSeconds) * 1_000,
  );

  try {
    const response = await fetch(`${apiUrl}/v1/agents/research/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
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
    const fallback = await runResearchAgentSandbox(config, hooks);
    return {
      ...fallback,
      fallbackReason: error instanceof Error ? error.message : "Agent service unavailable",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
