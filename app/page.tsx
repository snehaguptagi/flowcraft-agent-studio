"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type NodeCategory = "Input" | "AI" | "Logic" | "Output";
type NodeStatus = "idle" | "pending" | "running" | "completed" | "failed";

type NodeConfig = {
  value?: string;
  prompt?: string;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  variables?: string;
  format?: string;
  schema?: string;
};

type WorkflowNode = {
  id: string;
  type: string;
  category: NodeCategory;
  name: string;
  description: string;
  x: number;
  y: number;
  status: NodeStatus;
  config: NodeConfig;
  output?: string;
  latency?: number;
};

type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
};

type LogEntry = {
  id: string;
  time: string;
  level: "info" | "success" | "error";
  node?: string;
  message: string;
};

type Snapshot = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

type CatalogItem = {
  type: string;
  name: string;
  category: NodeCategory;
  description: string;
  mark: string;
  config: NodeConfig;
};

const STORAGE_KEY = "flowcraft-workflow-v1";
const NODE_WIDTH = 232;
const PORT_Y = 58;

const catalog: CatalogItem[] = [
  { type: "text-input", name: "Text input", category: "Input", description: "Collect a text value", mark: "T", config: { value: "How can I reset a locked workspace?" } },
  { type: "file-upload", name: "File upload", category: "Input", description: "Accept PDF, DOCX or TXT", mark: "F", config: { value: "knowledge-base.pdf" } },
  { type: "url-input", name: "URL input", category: "Input", description: "Fetch content from a URL", mark: "↗", config: { value: "https://docs.example.com" } },
  { type: "prompt", name: "Prompt", category: "AI", description: "Build a reusable prompt", mark: "P", config: { prompt: "Answer the customer clearly using only the provided context.", variables: "question, context" } },
  { type: "llm", name: "LLM", category: "AI", description: "Generate with a language model", mark: "AI", config: { provider: "OpenAI", model: "GPT-4.1 mini", temperature: 0.3, maxTokens: 900 } },
  { type: "embedding", name: "Embedding", category: "AI", description: "Create vector embeddings", mark: "E", config: { provider: "OpenAI", model: "text-embedding-3-small" } },
  { type: "rag", name: "RAG", category: "AI", description: "Retrieve relevant context", mark: "R", config: { model: "Hybrid search", maxTokens: 1200 } },
  { type: "summarizer", name: "Summarizer", category: "AI", description: "Condense long content", mark: "S", config: { prompt: "Summarize the key facts in three bullets." } },
  { type: "translator", name: "Translator", category: "AI", description: "Translate into a language", mark: "文", config: { value: "French" } },
  { type: "classification", name: "Classification", category: "AI", description: "Assign a label", mark: "C", config: { value: "billing, access, bug, other" } },
  { type: "structured-output", name: "Structured output", category: "AI", description: "Return validated JSON", mark: "{}", config: { schema: "{ answer: string, confidence: number }", format: "JSON" } },
  { type: "if-else", name: "If / Else", category: "Logic", description: "Branch on a condition", mark: "?", config: { value: "confidence > 0.7" } },
  { type: "merge", name: "Merge", category: "Logic", description: "Combine multiple branches", mark: "M", config: {} },
  { type: "variable-store", name: "Variable store", category: "Logic", description: "Save a reusable value", mark: "V", config: { variables: "response" } },
  { type: "delay", name: "Delay", category: "Logic", description: "Pause execution", mark: "D", config: { value: "500 ms" } },
  { type: "chat-output", name: "Chat output", category: "Output", description: "Display a chat response", mark: "↳", config: { format: "Chat" } },
  { type: "markdown-output", name: "Markdown output", category: "Output", description: "Render formatted content", mark: "MD", config: { format: "Markdown" } },
  { type: "json-output", name: "JSON output", category: "Output", description: "Return machine-ready JSON", mark: "J", config: { format: "JSON" } },
  { type: "download-output", name: "Download", category: "Output", description: "Create a downloadable file", mark: "↓", config: { format: "TXT" } },
];

const initialNodes: WorkflowNode[] = [
  {
    id: "input-1",
    type: "text-input",
    category: "Input",
    name: "Customer question",
    description: "Collect a text value",
    x: 58,
    y: 220,
    status: "idle",
    config: { value: "How can I reset a locked workspace?" },
  },
  {
    id: "rag-1",
    type: "rag",
    category: "AI",
    name: "Find help articles",
    description: "Retrieve relevant context",
    x: 342,
    y: 88,
    status: "idle",
    config: { model: "Hybrid search", maxTokens: 1200 },
  },
  {
    id: "prompt-1",
    type: "prompt",
    category: "AI",
    name: "Support prompt",
    description: "Build a reusable prompt",
    x: 342,
    y: 346,
    status: "idle",
    config: {
      prompt: "Answer clearly using only the retrieved help-center context. Include the exact next step.",
      variables: "question, context",
    },
  },
  {
    id: "llm-1",
    type: "llm",
    category: "AI",
    name: "Draft answer",
    description: "Generate with a language model",
    x: 626,
    y: 220,
    status: "idle",
    config: { provider: "OpenAI", model: "GPT-4.1 mini", temperature: 0.3, maxTokens: 900 },
  },
  {
    id: "output-1",
    type: "chat-output",
    category: "Output",
    name: "Reply to customer",
    description: "Display a chat response",
    x: 910,
    y: 220,
    status: "idle",
    config: { format: "Chat" },
  },
];

const initialEdges: WorkflowEdge[] = [
  { id: "e-input-rag", from: "input-1", to: "rag-1" },
  { id: "e-input-prompt", from: "input-1", to: "prompt-1" },
  { id: "e-rag-llm", from: "rag-1", to: "llm-1" },
  { id: "e-prompt-llm", from: "prompt-1", to: "llm-1" },
  { id: "e-llm-output", from: "llm-1", to: "output-1" },
];

const categoryOrder: NodeCategory[] = ["Input", "AI", "Logic", "Output"];

function cloneSnapshot(nodes: WorkflowNode[], edges: WorkflowEdge[]): Snapshot {
  return {
    nodes: nodes.map((node) => ({ ...node, config: { ...node.config } })),
    edges: edges.map((edge) => ({ ...edge })),
  };
}

function nowLabel() {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusLabel(status: NodeStatus) {
  if (status === "completed") return "Complete";
  if (status === "running") return "Running";
  if (status === "failed") return "Failed";
  if (status === "pending") return "Queued";
  return "Ready";
}

export default function Home() {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(initialEdges);
  const [selectedId, setSelectedId] = useState<string>("llm-1");
  const [workflowName, setWorkflowName] = useState("Support desk copilot");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(0.84);
  const [pan, setPan] = useState({ x: 28, y: 30 });
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "ready", time: "Ready", level: "info", message: "Workflow is ready to run in sandbox mode." },
  ]);
  const [consoleTab, setConsoleTab] = useState<"logs" | "outputs" | "errors">("logs");
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runDuration, setRunDuration] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
    snapshot: Snapshot;
  } | null>(null);
  const [panning, setPanning] = useState<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedNode = nodes.find((node) => node.id === selectedId) ?? null;

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const storedTheme = window.localStorage.getItem(`${STORAGE_KEY}-theme`);
      if (stored) {
        const parsed = JSON.parse(stored) as Snapshot & { name?: string };
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          if (parsed.name) setWorkflowName(parsed.name);
          if (parsed.nodes[0]) setSelectedId(parsed.nodes[0].id);
        }
      }
      setDarkMode(storedTheme === "dark");
    } catch {
      // A malformed local draft should never block the starter workflow.
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: workflowName, nodes, edges }));
  }, [workflowName, nodes, edges]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.localStorage.setItem(`${STORAGE_KEY}-theme`, darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!dragging && !panning) return;

    const handleMove = (event: PointerEvent) => {
      if (dragging) {
        const dx = (event.clientX - dragging.startX) / zoom;
        const dy = (event.clientY - dragging.startY) / zoom;
        setNodes((current) =>
          current.map((node) =>
            node.id === dragging.id
              ? { ...node, x: Math.max(0, dragging.nodeX + dx), y: Math.max(0, dragging.nodeY + dy) }
              : node,
          ),
        );
      }
      if (panning) {
        setPan({
          x: panning.panX + event.clientX - panning.startX,
          y: panning.panY + event.clientY - panning.startY,
        });
      }
    };

    const handleUp = () => {
      if (dragging) {
        setUndoStack((current) => [...current.slice(-29), dragging.snapshot]);
        setRedoStack([]);
      }
      setDragging(null);
      setPanning(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging, panning, zoom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        showToast("Workflow saved");
      }
      if (event.key === "Escape") setConnectFrom(null);
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        removeNode(selectedId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const commit = useCallback(
    (nextNodes: WorkflowNode[], nextEdges: WorkflowEdge[]) => {
      setUndoStack((current) => [...current.slice(-29), cloneSnapshot(nodes, edges)]);
      setRedoStack([]);
      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [nodes, edges],
  );

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "time">) => {
    setLogs((current) => [
      ...current,
      { ...entry, id: `${Date.now()}-${Math.random()}`, time: nowLabel() },
    ]);
  }, []);

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return catalog;
    return catalog.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    );
  }, [search]);

  const getItem = (type: string) => catalog.find((item) => item.type === type) ?? catalog[0];

  const createNode = useCallback((type: string, x?: number, y?: number) => {
    const item = catalog.find((candidate) => candidate.type === type) ?? catalog[0];
    const id = `${item.type}-${Date.now()}`;
    const offset = nodes.length * 18;
    const next: WorkflowNode = {
      id,
      type: item.type,
      category: item.category,
      name: item.name,
      description: item.description,
      x: x ?? 90 + (offset % 360),
      y: y ?? 90 + (offset % 280),
      status: "idle",
      config: { ...item.config },
    };
    commit([...nodes, next], edges);
    setSelectedId(id);
    showToast(`${item.name} added`);
  }, [commit, edges, nodes, showToast]);

  const removeNode = useCallback((id: string) => {
    if (isRunning) return;
    const nextNodes = nodes.filter((node) => node.id !== id);
    const nextEdges = edges.filter((edge) => edge.from !== id && edge.to !== id);
    commit(nextNodes, nextEdges);
    setSelectedId(nextNodes[0]?.id ?? "");
    setConnectFrom((current) => (current === id ? null : current));
    showToast("Node removed");
  }, [commit, edges, isRunning, nodes, showToast]);

  const updateNode = useCallback((id: string, patch: Partial<WorkflowNode>) => {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)));
  }, []);

  const updateConfig = useCallback((key: keyof NodeConfig, value: string | number) => {
    if (!selectedNode) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id ? { ...node, config: { ...node.config, [key]: value } } : node,
      ),
    );
  }, [selectedNode]);

  const connectTo = (targetId: string) => {
    if (!connectFrom || connectFrom === targetId) {
      setConnectFrom(null);
      return;
    }
    const exists = edges.some((edge) => edge.from === connectFrom && edge.to === targetId);
    if (!exists) {
      commit(nodes, [...edges, { id: `edge-${Date.now()}`, from: connectFrom, to: targetId }]);
      showToast("Nodes connected");
    }
    setConnectFrom(null);
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous || isRunning) return;
    setRedoStack((current) => [...current, cloneSnapshot(nodes, edges)]);
    setUndoStack((current) => current.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    showToast("Undid last change");
  };

  const redo = () => {
    const next = redoStack.at(-1);
    if (!next || isRunning) return;
    setUndoStack((current) => [...current, cloneSnapshot(nodes, edges)]);
    setRedoStack((current) => current.slice(0, -1));
    setNodes(next.nodes);
    setEdges(next.edges);
    showToast("Redid change");
  };

  const validateWorkflow = useCallback(() => {
    const issues: string[] = [];
    const nodeIds = new Set(nodes.map((node) => node.id));
    const incoming = new Map<string, number>();
    nodes.forEach((node) => incoming.set(node.id, 0));

    edges.forEach((edge) => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) issues.push("A connection points to a missing node.");
      if (incoming.has(edge.to)) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    });

    nodes.forEach((node) => {
      if (node.category !== "Input" && (incoming.get(node.id) ?? 0) === 0) {
        issues.push(`${node.name} needs an input connection.`);
      }
      if (node.type === "text-input" && !node.config.value?.trim()) issues.push(`${node.name} is missing text.`);
      if (node.type === "prompt" && !node.config.prompt?.trim()) issues.push(`${node.name} is missing a prompt.`);
      if (node.type === "llm" && !node.config.model?.trim()) issues.push(`${node.name} is missing a model.`);
    });

    const graph = new Map<string, string[]>();
    nodes.forEach((node) => graph.set(node.id, []));
    edges.forEach((edge) => graph.get(edge.from)?.push(edge.to));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    let hasCycle = false;
    const visit = (id: string) => {
      if (visiting.has(id)) {
        hasCycle = true;
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      graph.get(id)?.forEach(visit);
      visiting.delete(id);
      visited.add(id);
    };
    nodes.forEach((node) => visit(node.id));
    if (hasCycle) issues.push("The workflow contains a circular dependency.");
    return [...new Set(issues)];
  }, [edges, nodes]);

  const computeOutput = (node: WorkflowNode, inputs: string[]) => {
    const input = inputs.filter(Boolean).join("\n\n");
    switch (node.type) {
      case "text-input":
      case "file-upload":
      case "url-input":
        return node.config.value || "Input received";
      case "rag":
        return "Matched 3 help-center passages: Workspace access, owner recovery, and security verification.";
      case "prompt":
        return `Instruction prepared: ${node.config.prompt}\n\nQuestion: ${input.slice(0, 180)}`;
      case "llm":
        return "To reset a locked workspace, open Workspace settings → Security → Restore access. If you cannot reach settings, ask a workspace owner to start account recovery and complete the verification email within 30 minutes.";
      case "summarizer":
        return `Summary: ${input.slice(0, 220)}`;
      case "translator":
        return `[${node.config.value || "Translated"}] ${input}`;
      case "classification":
        return "access · confidence 0.94";
      case "structured-output":
      case "json-output":
        return JSON.stringify({ answer: input.slice(0, 260), confidence: 0.94 }, null, 2);
      case "if-else":
        return `Condition passed: ${node.config.value || "true"}`;
      case "delay":
        return `Waited ${node.config.value || "500 ms"}`;
      case "embedding":
        return "Vector generated · 1,536 dimensions";
      case "merge":
        return input;
      default:
        return input || `${node.name} completed`;
    }
  };

  const runWorkflow = async () => {
    if (isRunning) return;
    const issues = validateWorkflow();
    setValidationIssues(issues);
    setConsoleOpen(true);
    if (issues.length) {
      setConsoleTab("errors");
      issues.forEach((message) => addLog({ level: "error", message }));
      showToast(`${issues.length} validation ${issues.length === 1 ? "issue" : "issues"}`);
      return;
    }

    setConsoleTab("logs");
    setIsRunning(true);
    setRunDuration(null);
    const started = performance.now();
    setLogs([{ id: `run-${Date.now()}`, time: nowLabel(), level: "info", message: "Execution started in sandbox mode." }]);
    setNodes((current) => current.map((node) => ({ ...node, status: "pending", output: undefined, latency: undefined })));

    const indegree = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
    edges.forEach((edge) => {
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
      outgoing.get(edge.from)?.push(edge.to);
    });
    const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
    const order: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      outgoing.get(id)?.forEach((nextId) => {
        const nextValue = (indegree.get(nextId) ?? 1) - 1;
        indegree.set(nextId, nextValue);
        if (nextValue === 0) queue.push(nextId);
      });
    }

    const outputs = new Map<string, string>();
    for (const id of order) {
      const node = nodes.find((candidate) => candidate.id === id)!;
      setSelectedId(id);
      setNodes((current) => current.map((candidate) => (candidate.id === id ? { ...candidate, status: "running" } : candidate)));
      addLog({ level: "info", node: node.name, message: "Node started" });
      const nodeStarted = performance.now();
      await sleep(380 + (node.type.length % 4) * 90);
      const inputValues = edges.filter((edge) => edge.to === id).map((edge) => outputs.get(edge.from) ?? "");
      const output = computeOutput(node, inputValues);
      outputs.set(id, output);
      const latency = Math.round(performance.now() - nodeStarted);
      setNodes((current) =>
        current.map((candidate) =>
          candidate.id === id ? { ...candidate, status: "completed", output, latency } : candidate,
        ),
      );
      addLog({ level: "success", node: node.name, message: `Completed in ${latency} ms` });
    }

    const duration = Math.round(performance.now() - started);
    setRunDuration(duration);
    setIsRunning(false);
    addLog({ level: "success", message: `Workflow completed · ${order.length} nodes · ${duration} ms` });
    showToast("Workflow completed");
  };

  const exportWorkflow = () => {
    const payload = JSON.stringify({ version: 1, name: workflowName, nodes, edges }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workflowName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Workflow exported");
  };

  const importWorkflow = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Snapshot & { name?: string };
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error("Invalid workflow");
      commit(parsed.nodes, parsed.edges);
      if (parsed.name) setWorkflowName(parsed.name);
      setSelectedId(parsed.nodes[0]?.id ?? "");
      showToast("Workflow imported");
    } catch {
      showToast("That file is not a valid workflow");
    }
    event.target.value = "";
  };

  const resetTemplate = () => {
    commit(cloneSnapshot(initialNodes, initialEdges).nodes, cloneSnapshot(initialNodes, initialEdges).edges);
    setWorkflowName("Support desk copilot");
    setSelectedId("llm-1");
    setLogs([{ id: "ready-reset", time: "Ready", level: "info", message: "Support copilot template loaded." }]);
    setValidationIssues([]);
    showToast("Template loaded");
  };

  const newWorkflow = () => {
    commit([], []);
    setWorkflowName("Untitled workflow");
    setSelectedId("");
    setLogs([{ id: "new", time: "Ready", level: "info", message: "Blank workflow created." }]);
    showToast("Blank workflow created");
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/x-flowcraft-node");
    if (!type || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - pan.x) / zoom - NODE_WIDTH / 2;
    const y = (event.clientY - rect.top - pan.y) / zoom - 30;
    createNode(type, Math.max(8, x), Math.max(8, y));
  };

  const edgePaths = edges.map((edge) => {
    const source = nodes.find((node) => node.id === edge.from);
    const target = nodes.find((node) => node.id === edge.to);
    if (!source || !target) return null;
    const x1 = source.x + NODE_WIDTH;
    const y1 = source.y + PORT_Y;
    const x2 = target.x;
    const y2 = target.y + PORT_Y;
    const curve = Math.max(60, Math.abs(x2 - x1) * 0.45);
    return {
      ...edge,
      path: `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`,
    };
  });

  const outputNodes = nodes.filter((node) => node.output);
  const errorLogs = logs.filter((log) => log.level === "error");

  return (
    <main className={`app-shell ${darkMode ? "theme-dark" : ""}`}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <div className="brand-name">Flowcraft</div>
            <div className="brand-context">AI workflow studio</div>
          </div>
        </div>

        <div className="workflow-title-wrap">
          <input
            className="workflow-title"
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            aria-label="Workflow name"
          />
          <span className="saved-state"><span className="saved-dot" /> Autosaved</span>
        </div>

        <div className="toolbar-actions">
          <div className="button-pair" aria-label="History controls">
            <button className="icon-button" onClick={undo} disabled={!undoStack.length || isRunning} aria-label="Undo">↶</button>
            <button className="icon-button" onClick={redo} disabled={!redoStack.length || isRunning} aria-label="Redo">↷</button>
          </div>
          <button className="toolbar-button subtle" onClick={resetTemplate}><span className="button-icon">▦</span> Templates</button>
          <button className="toolbar-button subtle" onClick={() => showToast("Workflow saved locally")}><span className="button-icon">⌁</span> Save</button>
          <button className="toolbar-button subtle compact" onClick={exportWorkflow} aria-label="Export workflow">Export</button>
          <button className="run-button" onClick={runWorkflow} disabled={isRunning || !nodes.length}>
            <span className={isRunning ? "run-spinner" : "play-mark"}>{isRunning ? "" : "▶"}</span>
            {isRunning ? "Running" : "Run workflow"}
          </button>
          <button className="avatar-button" aria-label="Account menu">SG</button>
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="node-library" aria-label="Node library">
          <div className="panel-heading library-heading">
            <div>
              <span className="eyebrow">BUILD</span>
              <h2>Node library</h2>
            </div>
            <button className="mini-button" onClick={newWorkflow} aria-label="New blank workflow">＋</button>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nodes" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="library-scroll">
            {categoryOrder.map((category) => {
              const items = filteredCatalog.filter((item) => item.category === category);
              if (!items.length) return null;
              return (
                <div className="node-group" key={category}>
                  <div className="group-label">
                    <span>{category}</span>
                    <span>{items.length}</span>
                  </div>
                  <div className="node-list">
                    {items.map((item) => (
                      <button
                        className="library-node"
                        key={item.type}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData("application/x-flowcraft-node", item.type)}
                        onClick={() => createNode(item.type)}
                      >
                        <span className={`node-mark category-${item.category.toLowerCase()}`}>{item.mark}</span>
                        <span className="library-node-copy">
                          <strong>{item.name}</strong>
                          <small>{item.description}</small>
                        </span>
                        <span className="add-mark" aria-hidden="true">＋</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {!filteredCatalog.length && <p className="empty-message">No nodes match “{search}”.</p>}
          </div>
          <div className="library-tip"><span>i</span> Drag a node onto the canvas, or click to add it.</div>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="breadcrumb"><span>Workflows</span><span>›</span><strong>{workflowName || "Untitled"}</strong></div>
            <div className="canvas-meta">
              <span className={`health-pill ${validationIssues.length ? "has-errors" : ""}`}>
                <span /> {validationIssues.length ? `${validationIssues.length} issues` : "Graph healthy"}
              </span>
              <span>{nodes.length} nodes</span>
              <span>{edges.length} connections</span>
            </div>
          </div>

          <div
            className={`workflow-canvas ${panning ? "is-panning" : ""}`}
            ref={canvasRef}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest(".workflow-node")) return;
              setSelectedId("");
              setPanning({ startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y });
            }}
          >
            <div className="canvas-grid" />
            <div className="world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <svg className="edge-layer" viewBox="0 0 1220 720" aria-hidden="true">
                {edgePaths.map((edge) => edge && (
                  <g key={edge.id} className="edge-group">
                    <path className="edge-hit" d={edge.path} />
                    <path className="edge-line" d={edge.path} />
                    <circle className="edge-pulse" r="4">
                      {isRunning && <animateMotion dur="1.4s" repeatCount="indefinite" path={edge.path} />}
                    </circle>
                  </g>
                ))}
              </svg>

              {nodes.map((node) => {
                const item = getItem(node.type);
                return (
                  <article
                    key={node.id}
                    className={`workflow-node status-${node.status} ${selectedId === node.id ? "is-selected" : ""}`}
                    style={{ left: node.x, top: node.y }}
                    onClick={(event) => { event.stopPropagation(); setSelectedId(node.id); }}
                    aria-label={`${node.name}, ${statusLabel(node.status)}`}
                  >
                    {node.category !== "Input" && (
                      <button
                        className={`port input-port ${connectFrom ? "is-connectable" : ""}`}
                        onClick={(event) => { event.stopPropagation(); connectTo(node.id); }}
                        aria-label={`Connect into ${node.name}`}
                      />
                    )}
                    <div
                      className="node-header"
                      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
                        if ((event.target as HTMLElement).closest("button")) return;
                        event.stopPropagation();
                        setDragging({
                          id: node.id,
                          startX: event.clientX,
                          startY: event.clientY,
                          nodeX: node.x,
                          nodeY: node.y,
                          snapshot: cloneSnapshot(nodes, edges),
                        });
                      }}
                    >
                      <span className={`node-mark category-${node.category.toLowerCase()}`}>{item.mark}</span>
                      <div className="node-title-copy"><strong>{node.name}</strong><small>{node.category}</small></div>
                      <span className={`node-status status-${node.status}`}>{node.status === "running" && <span className="run-spinner small" />}{statusLabel(node.status)}</span>
                    </div>
                    <div className="node-summary">
                      {node.type === "llm" ? (
                        <><span>{node.config.model}</span><span>{node.config.temperature} temp</span></>
                      ) : node.type === "prompt" ? (
                        <p>{node.config.prompt}</p>
                      ) : node.type === "text-input" ? (
                        <p>{node.config.value}</p>
                      ) : node.type === "rag" ? (
                        <><span>{node.config.model}</span><span>Top 3</span></>
                      ) : node.output ? (
                        <p>{node.output}</p>
                      ) : (
                        <p>{node.description}</p>
                      )}
                    </div>
                    <div className="node-footer">
                      <span>{node.latency ? `${node.latency} ms` : "Configured"}</span>
                      <button onClick={(event) => { event.stopPropagation(); removeNode(node.id); }} aria-label={`Delete ${node.name}`}>•••</button>
                    </div>
                    {node.category !== "Output" && (
                      <button
                        className={`port output-port ${connectFrom === node.id ? "is-active" : ""}`}
                        onClick={(event) => { event.stopPropagation(); setConnectFrom(connectFrom === node.id ? null : node.id); }}
                        aria-label={`Connect from ${node.name}`}
                      />
                    )}
                  </article>
                );
              })}
            </div>

            {!nodes.length && (
              <div className="empty-canvas">
                <div className="empty-canvas-mark">＋</div>
                <h3>Start with your first node</h3>
                <p>Drag a node from the library or load the support copilot template.</p>
                <button onClick={resetTemplate}>Load template</button>
              </div>
            )}

            {connectFrom && <div className="connect-banner">Choose an input port to complete the connection <button onClick={() => setConnectFrom(null)}>Cancel</button></div>}

            <div className="zoom-controls">
              <button onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))} aria-label="Zoom in">＋</button>
              <button className="zoom-value" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
              <button onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))} aria-label="Zoom out">−</button>
              <span />
              <button onClick={() => { setZoom(0.84); setPan({ x: 28, y: 30 }); }} aria-label="Fit workflow">⌗</button>
            </div>

            <div className="minimap" aria-label="Workflow minimap">
              {nodes.map((node) => <span key={node.id} style={{ left: node.x / 12, top: node.y / 12 }} />)}
              <div className="minimap-frame" />
            </div>
          </div>
        </section>

        <aside className="config-panel" aria-label="Node configuration">
          {selectedNode ? (
            <>
              <div className="config-header">
                <div>
                  <span className="eyebrow">CONFIGURE</span>
                  <h2>{selectedNode.name}</h2>
                </div>
                <button className="mini-button" onClick={() => setSelectedId("")} aria-label="Close configuration">×</button>
              </div>
              <div className="selected-node-card">
                <span className={`node-mark category-${selectedNode.category.toLowerCase()}`}>{getItem(selectedNode.type).mark}</span>
                <div><strong>{getItem(selectedNode.type).name}</strong><span>{selectedNode.description}</span></div>
                <span className={`live-dot status-${selectedNode.status}`} />
              </div>
              <div className="config-scroll">
                <div className="form-section">
                  <div className="form-section-title"><span>General</span><span>⌃</span></div>
                  <label className="field-label">Node name<input value={selectedNode.name} onChange={(event) => updateNode(selectedNode.id, { name: event.target.value })} /></label>
                  <div className="field-row">
                    <label className="field-label">Node ID<input value={selectedNode.id} disabled /></label>
                    <label className="field-label">Type<input value={selectedNode.category} disabled /></label>
                  </div>
                </div>

                {(selectedNode.config.prompt !== undefined || selectedNode.type === "prompt") && (
                  <div className="form-section">
                    <div className="form-section-title"><span>Prompt</span><span className="required-label">Required</span></div>
                    <label className="field-label">
                      Instructions
                      <textarea rows={6} value={selectedNode.config.prompt ?? ""} onChange={(event) => updateConfig("prompt", event.target.value)} />
                      <small className="field-help">Use <code>{"{{variable}}"}</code> to insert upstream values.</small>
                    </label>
                  </div>
                )}

                {selectedNode.config.value !== undefined && (
                  <div className="form-section">
                    <div className="form-section-title"><span>Value</span><span>⌃</span></div>
                    <label className="field-label">Input value<textarea rows={4} value={selectedNode.config.value ?? ""} onChange={(event) => updateConfig("value", event.target.value)} /></label>
                  </div>
                )}

                {(selectedNode.type === "llm" || selectedNode.config.provider !== undefined) && (
                  <div className="form-section">
                    <div className="form-section-title"><span>Model settings</span><span>⌃</span></div>
                    <label className="field-label">Provider<select value={selectedNode.config.provider ?? "OpenAI"} onChange={(event) => updateConfig("provider", event.target.value)}><option>OpenAI</option><option>Gemini</option><option>Claude</option></select></label>
                    <label className="field-label">Model<select value={selectedNode.config.model ?? "GPT-4.1 mini"} onChange={(event) => updateConfig("model", event.target.value)}><option>GPT-4.1 mini</option><option>GPT-4.1</option><option>Gemini 2.5 Flash</option><option>Claude Sonnet 4</option></select></label>
                    <div className="field-row">
                      <label className="field-label">Temperature<input type="number" min="0" max="2" step="0.1" value={selectedNode.config.temperature ?? 0.3} onChange={(event) => updateConfig("temperature", Number(event.target.value))} /></label>
                      <label className="field-label">Max tokens<input type="number" min="1" value={selectedNode.config.maxTokens ?? 900} onChange={(event) => updateConfig("maxTokens", Number(event.target.value))} /></label>
                    </div>
                  </div>
                )}

                {selectedNode.config.variables !== undefined && (
                  <div className="form-section">
                    <div className="form-section-title"><span>Variables</span><button>＋ Add</button></div>
                    <label className="field-label">Available variables<input value={selectedNode.config.variables ?? ""} onChange={(event) => updateConfig("variables", event.target.value)} /></label>
                  </div>
                )}

                <div className="form-section">
                  <div className="form-section-title"><span>Latest output</span><span>{selectedNode.latency ? `${selectedNode.latency} ms` : "—"}</span></div>
                  <div className={`output-preview ${selectedNode.output ? "has-output" : ""}`}>
                    {selectedNode.output ?? "Run the workflow to inspect this node’s output."}
                  </div>
                </div>
              </div>
              <div className="config-footer">
                <span><span className="saved-dot" /> Changes save automatically</span>
                <button onClick={() => removeNode(selectedNode.id)}>Delete node</button>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <div className="no-selection-mark">⌁</div>
              <h2>Select a node</h2>
              <p>Choose any node on the canvas to edit its configuration and inspect its output.</p>
            </div>
          )}
        </aside>

        <section className={`console-panel ${consoleOpen ? "is-open" : "is-collapsed"}`} aria-label="Execution console">
          <div className="console-header">
            <div className="console-tabs">
              <button className={consoleTab === "logs" ? "active" : ""} onClick={() => setConsoleTab("logs")}>Execution log <span>{logs.length}</span></button>
              <button className={consoleTab === "outputs" ? "active" : ""} onClick={() => setConsoleTab("outputs")}>Outputs <span>{outputNodes.length}</span></button>
              <button className={consoleTab === "errors" ? "active" : ""} onClick={() => setConsoleTab("errors")}>Errors <span className={errorLogs.length ? "error-count" : ""}>{errorLogs.length}</span></button>
            </div>
            <div className="console-actions">
              {runDuration && <span>Last run {runDuration} ms</span>}
              <button onClick={() => setLogs([])}>Clear</button>
              <button onClick={() => setConsoleOpen((value) => !value)} aria-label="Toggle console">{consoleOpen ? "⌄" : "⌃"}</button>
            </div>
          </div>
          {consoleOpen && (
            <div className="console-body">
              {consoleTab === "logs" && (
                <div className="log-list">
                  {logs.map((log) => (
                    <div className={`log-row level-${log.level}`} key={log.id}>
                      <span className="log-time">{log.time}</span>
                      <span className="log-level">{log.level === "success" ? "OK" : log.level === "error" ? "ERR" : "INFO"}</span>
                      <span className="log-message">{log.node && <strong>{log.node}</strong>}{log.message}</span>
                    </div>
                  ))}
                  {!logs.length && <p className="empty-message">No execution events yet.</p>}
                </div>
              )}
              {consoleTab === "outputs" && (
                <div className="output-grid">
                  {outputNodes.map((node) => <div className="output-card" key={node.id}><div><strong>{node.name}</strong><span>{node.latency} ms</span></div><pre>{node.output}</pre></div>)}
                  {!outputNodes.length && <p className="empty-message">Run the workflow to inspect intermediate outputs.</p>}
                </div>
              )}
              {consoleTab === "errors" && (
                <div className="error-list">
                  {errorLogs.map((log) => <div className="error-row" key={log.id}><span>!</span><div><strong>Validation issue</strong><p>{log.message}</p></div></div>)}
                  {!errorLogs.length && <div className="all-clear"><span>✓</span><div><strong>No errors found</strong><p>Your workflow structure is valid.</p></div></div>}
                </div>
              )}
            </div>
          )}
        </section>
      </section>

      <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importWorkflow} />
      <nav className="utility-rail" aria-label="Workflow utilities">
        <button onClick={() => fileInputRef.current?.click()} title="Import workflow">⇧</button>
        <button onClick={() => setDarkMode((value) => !value)} title="Toggle theme">{darkMode ? "☀" : "◐"}</button>
        <button onClick={() => showToast("Shortcuts: drag nodes, click ports to connect, Delete removes a node")} title="Keyboard shortcuts">?</button>
      </nav>
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
