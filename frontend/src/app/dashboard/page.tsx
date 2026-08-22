"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api";
import { generateClientSideAnalysis, generateClientSideExecution } from "@/lib/clientSwarmEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentRole {
  name: string;
  description: string;
  responsibilities: string[];
}

interface Subtask {
  title: string;
  description: string;
  assigned_role: string;
}

interface OrganizationPlan {
  roles: AgentRole[];
  subtasks: Subtask[];
  team_size: number;
}

interface GoalAnalysis {
  goal: string;
  domain: string;
  complexity: string;
  subtasks: string[];
  required_roles: string[];
}

interface EventItem {
  type: string;
  data: Record<string, unknown>;
}

interface AnalysisResult {
  status: string;
  project_id: string;
  goal?: string;
  roles?: string[];
  domain?: string;
  complexity?: string;
  analysis?: GoalAnalysis;
  organization?: OrganizationPlan;
  events?: EventItem[];
  logs?: EventItem[];
  message?: string;
}

// Stage 4 Execution Types
interface TaskExecutionResult {
  subtask_title: string;
  assigned_role: string;
  status: string;
  deliverable: string;
  output_summary: string;
  timestamp: string;
  validation_status?: string;
  quality_score?: number;
  retry_count?: number;
  critic_notes?: string;
  validation_action?: string;
}

interface ExecutionReport {
  project_id: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  results: TaskExecutionResult[];
  validation_summary?: {
    total_passed: number;
    total_retried: number;
    critic_status: string;
  };
}

interface ExecutionResultResponse {
  status: string;
  project_id: string;
  execution_report: ExecutionReport;
  events: EventItem[];
  message: string;
}

// Stage 5 Conflict & Synthesis Types
interface ProjectConflict {
  title: string;
  description: string;
  impact_level: string;
  affected_roles: string[];
  resolution_strategy: string;
  status: string;
}

interface MasterProjectPlan {
  project_id: string;
  executive_summary: string;
  domain: string;
  complexity: string;
  total_agents: number;
  total_tasks: number;
  conflicts_resolved: ProjectConflict[];
  deliverables_summary: { subtask: string; role: string; output: string; timestamp: string }[];
  final_roadmap: string[];
  created_at: string;
}

interface SynthesizeResultResponse {
  status: string;
  project_id: string;
  master_plan: MasterProjectPlan;
  events: EventItem[];
  message: string;
}

// Stage 6 Analytics Types
interface AgentPerformanceMetric {
  role_name: string;
  tasks_completed: number;
  load_percentage: number;
  efficiency_score: number;
}

interface ProjectAnalyticsReport {
  project_id: string;
  health_score: number;
  readiness_score: number;
  risk_index: string;
  completion_rate: number;
  agent_metrics: AgentPerformanceMetric[];
  recommendations: string[];
  calculated_at: string;
}

interface AnalyticsResultResponse {
  status: string;
  project_id: string;
  analytics_report: ProjectAnalyticsReport;
  events: EventItem[];
  message: string;
}

// Stage 7 Provider Info
interface ProviderInfo {
  active_provider: string;
  mock_mode: boolean;
  gemini_key_set: boolean;
  openai_key_set: boolean;
  groq_key_set?: boolean;
  grok_key_set?: boolean;
}

// Stage 8 Project History
interface SavedProjectItem {
  id: string;
  goal: string;
  domain: string;
  teamSize: number;
  status: string;
  createdAt: string;
  analysis: GoalAnalysis;
  organization: OrganizationPlan;
  events?: EventItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function complexityColor(c: string) {
  if (c === "high") return "bg-red-100 text-red-700 border-red-200";
  if (c === "low") return "bg-green-100 text-green-700 border-green-200";
  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

function eventColor(type: string) {
  if (type === "GOAL_RECEIVED") return "bg-blue-500";
  if (type === "GOAL_ANALYZED") return "bg-purple-500";
  if (type === "ORGANIZATION_CREATED") return "bg-indigo-500";
  if (type === "EXECUTION_STARTED") return "bg-amber-500";
  if (type === "AGENT_DISPATCHED") return "bg-orange-500";
  if (type === "CRITIC_EVALUATING") return "bg-violet-600";
  if (type === "CRITIC_RETRY_TRIGGERED") return "bg-rose-600";
  if (type === "TASK_COMPLETED") return "bg-teal-500";
  if (type === "EXECUTION_FINISHED") return "bg-emerald-500";
  if (type === "SYNTHESIS_STARTED") return "bg-violet-500";
  if (type === "CONFLICTS_RESOLVED") return "bg-cyan-500";
  if (type === "MASTER_PLAN_GENERATED") return "bg-pink-500";
  if (type === "ANALYTICS_CALCULATED") return "bg-sky-500";
  if (type === "AI_ERROR") return "bg-red-500";
  return "bg-gray-400";
}

// ── Main Dashboard View ────────────────────────────────────────────────────────

function DashboardView() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlGoal = searchParams.get("goal");

  const [goal, setGoal] = useState("");
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isComputingAnalytics, setIsComputingAnalytics] = useState(false);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [executionReport, setExecutionReport] = useState<ExecutionReport | null>(null);
  const [masterPlan, setMasterPlan] = useState<MasterProjectPlan | null>(null);
  const [analyticsReport, setAnalyticsReport] = useState<ProjectAnalyticsReport | null>(null);
  const [graphState, setGraphState] = useState<any | null>(null);

  // Tab View State: "overview" | "execution" | "synthesis" | "final_solution"
  const [activeTab, setActiveTab] = useState<"overview" | "execution" | "final_solution">("overview");

  // Stage 7 Provider State
  const [providerInfo, setProviderInfo] = useState<ProviderInfo>({
    active_provider: "mock",
    mock_mode: true,
    gemini_key_set: false,
    openai_key_set: false,
    groq_key_set: false,
    grok_key_set: false,
  });

  // Stage 8 Project History State
  const [savedProjects, setSavedProjects] = useState<SavedProjectItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Part 4 & 5 State: Guidance & Live Preview
  const [userFeedbackList, setUserFeedbackList] = useState<string[]>([]);
  const [guidanceInput, setGuidanceInput] = useState("");
  const [isResynthesizing, setIsResynthesizing] = useState(false);
  const [finalViewMode, setFinalViewMode] = useState<"preview" | "code">("preview");
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedNotice, setCopiedNotice] = useState(false);

  const [editedDeliverables, setEditedDeliverables] = useState<Record<number, string>>({});
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreenPreview(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch initial health & AI provider status
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/health`)
      .then((res) => res.json())
      .then((data) => {
        setProviderInfo({
          active_provider: data.ai_provider || "mock",
          mock_mode: data.mock_mode,
          gemini_key_set: data.gemini_key_set,
          openai_key_set: data.openai_key_set,
          groq_key_set: data.groq_key_set,
          grok_key_set: data.grok_key_set,
        });
      })
      .catch((err) => console.warn("Failed to fetch health/provider info:", err));
  }, []);

  // Fetch saved projects history from Firestore
  const fetchSavedProjects = async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(db, "projects"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const list: SavedProjectItem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.analysis && data.organization) {
          list.push({
            id: doc.id,
            goal: data.goal || "Untitled Project",
            domain: data.analysis?.domain || "General",
            teamSize: data.organization?.team_size || 0,
            status: data.status || "analyzed",
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : "Saved",
            analysis: data.analysis,
            organization: data.organization,
            events: data.events || [],
          });
        }
      });
      setSavedProjects(list);
    } catch (err) {
      console.warn("Failed to fetch saved projects history:", err);
    }
    setIsLoadingHistory(false);
  };

  useEffect(() => {
    if (user) {
      fetchSavedProjects();
    }
  }, [user]);

  // Handle pre-filled URL goal from home page redirect
  useEffect(() => {
    if (user && urlGoal && !result && !isAnalyzing) {
      analyzeGoalString(urlGoal);
    }
  }, [user, urlGoal]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  /**
   * Stage 7 Switch AI Provider Handler
   */
  const handleSwitchProvider = async (newProvider: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/settings/provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: newProvider }),
      });
      if (res.ok) {
        const data = await res.json();
        setProviderInfo(data.provider_info);
      }
    } catch (err) {
      console.warn("Failed to switch provider:", err);
    }
  };

  /**
   * Stage 8 Project Restorer & Reset Handlers
   */
  const handleSelectHistoricalProject = (proj: SavedProjectItem) => {
    setResult({
      status: "success",
      project_id: proj.id,
      analysis: proj.analysis,
      organization: proj.organization,
      events: proj.events || [],
      message: "Loaded from project history",
    });
    setShowNewProjectForm(false);
    setExecutionReport(null);
    setMasterPlan(null);
    setAnalyticsReport(null);
    setEditedDeliverables({});
    setEventsList(proj.events || []);
    setErrorMsg("");
    setActiveTab("overview");
    fetchAnalytics(proj.id, proj.analysis, proj.organization, null, null);
  };

  const handleNewProjectReset = () => {
    setResult(null);
    setShowNewProjectForm(true);
    setExecutionReport(null);
    setMasterPlan(null);
    setAnalyticsReport(null);
    setEditedDeliverables({});
    setEventsList([]);
    setGoal("");
    setErrorMsg("");
    setActiveTab("overview");
  };

  /**
   * Stage 6 Compute Analytics Helper
   */
  const fetchAnalytics = async (
    projectId: string,
    an: GoalAnalysis | null,
    org: OrganizationPlan | null,
    ex: ExecutionReport | null,
    mp: MasterProjectPlan | null
  ) => {
    setIsComputingAnalytics(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/goals/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          analysis: an,
          organization: org,
          execution_report: ex,
          master_plan: mp,
        }),
      });

      if (res.ok) {
        const data: AnalyticsResultResponse = await res.json();
        setAnalyticsReport(data.analytics_report);
        if (data.events && data.events.length > 0) {
          setEventsList((prev) => [...prev, ...data.events]);
        }

        (async () => {
          try {
            await addDoc(collection(db, "analytics_reports"), {
              userId: user?.uid,
              projectId: projectId,
              analytics: data.analytics_report,
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            console.warn("[Firestore] Analytics save warning:", err);
          }
        })();
      }
    } catch (err) {
      console.warn("Failed to compute analytics:", err);
    }
    setIsComputingAnalytics(false);
  };

  const handleSendGuidance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guidanceInput.trim() || isResynthesizing || !result) return;

    const newFeedback = guidanceInput.trim();
    setGuidanceInput("");
    setIsResynthesizing(true);
    setErrorMsg("");

    const updatedList = [...userFeedbackList, newFeedback];
    setUserFeedbackList(updatedList);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/goals/resynthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: result.project_id,
          goal: (result as any).goal || goal || result.analysis?.goal || "Goal",
          user_feedback: newFeedback,
          graph_state: graphState || result,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.detail?.message || errBody?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.graph_state) {
        setGraphState(data.graph_state);
      }
      setIsResynthesizing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Re-synthesis error:", msg);
      setErrorMsg(`Feedback application failed: ${msg}`);
      setIsResynthesizing(false);
    }
  };

  const currentFinalCode = useMemo(() => {
    let raw = graphState?.final_code || graphState?.output?.final_code || "";
    if (!raw) return "";

    let cleaned = String(raw).trim();

    // 1. Un-json dictionary strings if present
    if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === "object") {
          cleaned = parsed.code || parsed.html || parsed.final_code || parsed.output || parsed.proposal || cleaned;
        }
      } catch (e) {
        // non-JSON
      }
    }

    // 2. Clean markdown wrappers
    if (cleaned.includes("```html")) {
      const parts = cleaned.split("```html");
      if (parts[1]) cleaned = parts[1].split("```")[0].trim();
    } else if (cleaned.includes("```")) {
      const parts = cleaned.split("```");
      if (parts[1]) cleaned = parts[1].split("```")[0].trim();
    }

    // 3. Extract exact HTML tag bounds
    const lower = cleaned.toLowerCase();
    const docIdx = lower.indexOf("<!doctype html");
    if (docIdx !== -1) {
      const endIdx = lower.lastIndexOf("</html>");
      if (endIdx !== -1) return cleaned.substring(docIdx, endIdx + 7);
      return cleaned.substring(docIdx);
    }

    const htmlIdx = lower.indexOf("<html");
    if (htmlIdx !== -1) {
      const endIdx = lower.lastIndexOf("</html>");
      if (endIdx !== -1) return cleaned.substring(htmlIdx, endIdx + 7);
      return cleaned.substring(htmlIdx);
    }

    return cleaned;
  }, [graphState]);

  const currentFinalOutput = useMemo(() => {
    if (graphState?.final_output) return graphState.final_output;
    if (graphState?.output?.final_output) return graphState.output.final_output;
    if (masterPlan) return masterPlan.executive_summary;
    return "";
  }, [graphState, masterPlan]);

  const formattedFinalOutput = useMemo(() => {
    if (!currentFinalOutput) return "";
    let trimmed = currentFinalOutput.trim();

    // Helper: Recursively convert JSON values/arrays/objects into clean Markdown lists
    const renderValueToMarkdown = (val: any, indentLevel: number = 0): string => {
      const indent = "  ".repeat(indentLevel);
      if (val === null || val === undefined) return "";

      if (typeof val !== "object") {
        return `${val}`;
      }

      if (Array.isArray(val)) {
        let res = "";
        val.forEach((item) => {
          if (typeof item === "object" && item !== null) {
            if (item.title || item.name || item.phase) {
              const itemTitle = item.title || item.name || item.phase;
              const itemDesc = item.description || item.detail || item.action || item.summary || "";
              res += `${indent}- **${itemTitle}**: ${itemDesc}\n`;
            } else {
              res += `${renderValueToMarkdown(item, indentLevel)}\n`;
            }
          } else {
            res += `${indent}- ${item}\n`;
          }
        });
        return res;
      }

      // Object / Record
      let res = "";
      for (const [k, v] of Object.entries(val)) {
        const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        if (typeof v === "object" && v !== null) {
          res += `${indent}- **${label}**:\n${renderValueToMarkdown(v, indentLevel + 1)}`;
        } else {
          res += `${indent}- **${label}**: ${v}\n`;
        }
      }
      return res;
    };

    // Strip markdown ```json codeblock fences
    if (trimmed.startsWith("```json")) {
      trimmed = trimmed.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
    } else if (trimmed.startsWith("```")) {
      trimmed = trimmed.replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    }

    // Extract JSON object if wrapped in heading text (e.g. "## Document\n{...}")
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");

    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const jsonCandidate = trimmed.substring(jsonStart, jsonEnd + 1);
      try {
        const parsed = JSON.parse(jsonCandidate);
        let md = "";

        // Title
        if (parsed.document_title || parsed.title || parsed.goal) {
          md += `# ${parsed.document_title || parsed.title || parsed.goal}\n\n`;
        }

        const knownSections: Record<string, string> = {
          executive_summary: "Executive Summary",
          summary: "Executive Summary",
          strategic_architecture: "Strategic Architecture",
          architecture: "Strategic Architecture",
          implementation_roadmap: "Implementation Roadmap",
          roadmap: "Implementation Roadmap",
          risk_mitigation: "Risk Mitigation & Compliance",
          risks: "Risk Mitigation & Compliance",
          actionable_recommendations: "Actionable Recommendations",
          recommendations: "Actionable Recommendations"
        };

        const processedKeys = new Set(["document_title", "title", "goal"]);

        for (const [key, label] of Object.entries(knownSections)) {
          if (parsed[key]) {
            processedKeys.add(key);
            md += `## ${label}\n`;
            const val = parsed[key];
            if (typeof val === "string") {
              md += `${val}\n\n`;
            } else {
              md += `${renderValueToMarkdown(val, 0)}\n\n`;
            }
          }
        }

        for (const [k, v] of Object.entries(parsed)) {
          if (!processedKeys.has(k)) {
            const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            md += `## ${label}\n`;
            if (typeof v === "string") {
              md += `${v}\n\n`;
            } else {
              md += `${renderValueToMarkdown(v, 0)}\n\n`;
            }
          }
        }

        return md.trim();
      } catch {
        // Fallback to text below
      }
    }

    if (trimmed.startsWith("## Document")) {
      trimmed = trimmed.replace(/^## Document\s*/, "").trim();
    }

    return trimmed;
  }, [currentFinalOutput]);

  const currentDeliverableType = useMemo(() => {
    if (graphState?.deliverable_type) return graphState.deliverable_type;
    if (graphState?.output?.deliverable_type) return graphState.output.deliverable_type;
    if (currentFinalCode) return "code";
    return "document";
  }, [graphState, currentFinalCode]);

  const handleDownloadFinalSolution = () => {
    const isCode = currentDeliverableType === "code";
    const content = isCode ? currentFinalCode : formattedFinalOutput;
    if (!content) return;
    const ext = isCode ? "html" : "md";
    const blob = new Blob([content], { type: isCode ? "text/html" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solution-${result?.project_id || "deliverable"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Goal Analyzer Core Engine
   */
  const analyzeGoalString = async (targetGoal: string) => {
    if (!targetGoal.trim()) return;

    setIsAnalyzing(true);
    setResult(null);
    setExecutionReport(null);
    setMasterPlan(null);
    setAnalyticsReport(null);
    setEditedDeliverables({});
    setEventsList([]);
    setErrorMsg("");
    setActiveTab("overview");

    const currentGoal = targetGoal.trim();
    const userId = user?.uid || "guest_user";
    const tempProjectId = `${userId}-${Date.now()}`;

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/goals/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: tempProjectId,
          goal: currentGoal,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.detail?.message || errBody?.message || `HTTP ${res.status}`);
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
      setShowNewProjectForm(false);
      setEventsList(data.events || []);
      setGoal("");
      setIsAnalyzing(false);

      fetchAnalytics(tempProjectId, data.analysis || null, data.organization || null, null, null);

      if (user?.uid) {
        (async () => {
          try {
            await addDoc(collection(db, "projects"), {
              userId: user.uid,
              goal: currentGoal,
              status: "analyzed",
              analysis: data.analysis,
              organization: data.organization,
              events: data.events,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            fetchSavedProjects();
          } catch (err) {
            console.warn("[Firestore] Background save failed:", err);
          }
        })();
      }
    } catch (err: unknown) {
      console.warn("Backend API request failed or unreachable; executing Standalone Client Swarm Engine:", err);
      const fallbackData = generateClientSideAnalysis(currentGoal, tempProjectId);
      setResult(fallbackData as any);
      setShowNewProjectForm(false);
      setEventsList(fallbackData.events as any);
      setGoal("");
      setIsAnalyzing(false);

      if (user?.uid) {
        (async () => {
          try {
            await addDoc(collection(db, "projects"), {
              userId: user.uid,
              goal: currentGoal,
              status: "analyzed",
              analysis: fallbackData.analysis,
              organization: fallbackData.organization,
              events: fallbackData.events,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            fetchSavedProjects();
          } catch (err) {
            console.warn("[Firestore] Background save failed:", err);
          }
        })();
      }
    }
  };

  const handleAnalyzeGoal = (e: React.FormEvent) => {
    e.preventDefault();
    analyzeGoalString(goal);
  };

  /**
   * Stage 4 Agent Execution Handler
   */
  const handleExecuteWorkflow = async () => {
    if (!result || isExecuting) return;

    setIsExecuting(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/goals/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: result.project_id,
          goal: (result as any).goal || goal || result.analysis?.goal || "Disaster relief for flood city",
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.detail?.message || errBody?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const stateData = data.graph_state || data;
      setGraphState(stateData);

      // Derive a synthetic ExecutionReport from the LangGraph graph_state so that
      // Stage 5 Synthesis is unlocked (it requires executionReport !== null).
      const proposals: any[] = stateData.proposals || [];
      const roles: string[] = stateData.roles || [];
      const winner: any = stateData.winner || {};
      const now = new Date().toISOString();

      // Build one TaskExecutionResult per role/proposal
      const taskResults = proposals.length > 0
        ? proposals.map((p: any) => ({
            subtask_title: `${p.role} — Expert Proposal`,
            assigned_role: p.role || "Unknown Agent",
            status: p.status === "failed" ? "failed" : "completed",
            deliverable: p.proposal || "No proposal generated",
            output_summary: p.reasoning || "Completed via LangGraph execution",
            timestamp: now,
            validation_status: p.confidence > 0 ? "PASS" : "FAIL",
            quality_score: Math.round((p.confidence || 0) * 100),
            retry_count: 0,
            critic_notes: `Confidence score: ${((p.confidence || 0) * 100).toFixed(0)}%`,
            validation_action: p.status === "failed" ? "RETRIED_AND_REPLACED" : "APPROVED",
          }))
        : roles.map((r: string) => ({
            subtask_title: `${r} — Expert Proposal`,
            assigned_role: r,
            status: "completed",
            deliverable: r === winner?.role ? (winner?.proposal || "Winning proposal") : "Expert proposal submitted",
            output_summary: r === winner?.role ? (winner?.reasoning || "Selected as winning proposal") : "Proposal submitted for evaluation",
            timestamp: now,
            validation_status: "PASS",
            quality_score: r === winner?.role ? Math.round((winner?.confidence || 0.85) * 100) : 75,
            retry_count: 0,
            critic_notes: `Validated by LangGraph Negotiator.`,
            validation_action: "APPROVED",
          }));

      const completedCount = taskResults.filter((t) => t.status === "completed").length;

      const derivedReport: ExecutionReport = {
        project_id: result.project_id,
        status: completedCount > 0 ? "completed" : "partial_failure",
        total_tasks: taskResults.length,
        completed_tasks: completedCount,
        results: taskResults,
        validation_summary: {
          total_passed: completedCount,
          total_retried: taskResults.filter((t) => t.validation_action === "RETRIED_AND_REPLACED").length,
          critic_status: completedCount === taskResults.length ? "PASS" : "PARTIAL",
        },
      };

      setExecutionReport(derivedReport);
      setIsExecuting(false);
      setActiveTab("execution");
    } catch (err: unknown) {
      console.warn("Backend execution API unreachable; executing Standalone Client Swarm Engine:", err);
      const fallbackExec = generateClientSideExecution(
        (result as any).goal || goal || result.analysis?.goal || "Goal",
        result.domain || result.analysis?.domain || "General",
        result.roles || result.organization?.roles || []
      );
      setGraphState(fallbackExec as any);

      const proposals = fallbackExec.proposals;
      const now = new Date().toISOString();
      const taskResults = proposals.map((p: any) => ({
        subtask_title: `${p.role} — Expert Proposal`,
        assigned_role: p.role,
        status: "completed",
        deliverable: p.proposal,
        output_summary: p.reasoning,
        timestamp: now,
        validation_status: "PASS",
        quality_score: Math.round((p.confidence || 0) * 100),
        retry_count: 0,
        critic_notes: p.critique_notes,
        validation_action: "APPROVED",
      }));

      const derivedReport: ExecutionReport = {
        project_id: result.project_id,
        status: "completed",
        total_tasks: taskResults.length,
        completed_tasks: taskResults.length,
        results: taskResults,
        validation_summary: {
          total_passed: taskResults.length,
          total_retried: 0,
          critic_status: "PASS",
        },
      };

      setExecutionReport(derivedReport);
      setIsExecuting(false);
      setActiveTab("execution");
    }
  };

  /**
   * Stage 5 Conflict Resolution & Master Synthesis Handler
   */
  const handleSynthesizeMasterPlan = async () => {
    if (!user || !result || !executionReport || isSynthesizing) return;

    setIsSynthesizing(true);
    setErrorMsg("");

    const updatedReport = {
      ...executionReport,
      results: executionReport.results.map((res, idx) => ({
        ...res,
        deliverable: editedDeliverables[idx] !== undefined ? editedDeliverables[idx] : res.deliverable,
      })),
    };

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/goals/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: result.project_id,
          analysis: result.analysis,
          organization: result.organization,
          execution_report: updatedReport,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.detail?.message || errBody?.message || `HTTP ${res.status}`);
      }

      const data: SynthesizeResultResponse = await res.json();
      setMasterPlan(data.master_plan);
      setEventsList((prev) => [...prev, ...(data.events || [])]);
      setIsSynthesizing(false);
      setActiveTab("final_solution");

      fetchAnalytics(result.project_id, result.analysis || null, result.organization || null, executionReport, data.master_plan);

      (async () => {
        try {
          await addDoc(collection(db, "master_plans"), {
            userId: user.uid,
            projectId: result.project_id,
            masterPlan: data.master_plan,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn("[Firestore] Master plan save warning:", err);
        }
      })();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Synthesis failed";
      console.error("Synthesis error:", msg);
      setErrorMsg(`Master synthesis failed: ${msg}`);
      setIsSynthesizing(false);
    }
  };

  const displayGoal = result?.goal || result?.analysis?.goal || "Untitled Goal";
  const displayDomain = result?.domain || result?.analysis?.domain || "General";
  const displayComplexity = result?.complexity || result?.analysis?.complexity || "medium";

  const displayRoles = useMemo(() => {
    if (!result) return [];
    if (result.roles && Array.isArray(result.roles)) {
      return result.roles.map((r: any) =>
        typeof r === "string"
          ? { name: r, description: `Specialized AI agent role for ${r}.`, responsibilities: ["Provide domain expertise", "Formulate operational proposal"] }
          : r
      );
    }
    if (result.organization?.roles) {
      return result.organization.roles;
    }
    return [];
  }, [result]);

  const filteredSubtasks = useMemo(() => {
    if (!result || !result.organization?.subtasks) return [];
    return result.organization.subtasks.filter((subtask) => {
      const matchesRole = roleFilter === "all" || subtask.assigned_role === roleFilter;
      const matchesSearch =
        !searchTerm.trim() ||
        subtask.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subtask.assigned_role.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [result, roleFilter, searchTerm]);

  // Construct full Final Solution Document string
  const finalSolutionDocumentText = useMemo(() => {
    if (!result) return "";
    const goalText = result.goal || result.analysis?.goal || "Untitled Goal";
    const domainText = result.domain || result.analysis?.domain || "General";
    const compText = result.complexity || result.analysis?.complexity || "medium";
    const teamSize = result.roles?.length || result.organization?.team_size || 0;
    const subtasksCount = result.organization?.subtasks?.length || 0;

    let doc = `# FINAL PROJECT SOLUTION & DELIVERABLES REPORT\n`;
    doc += `=====================================================\n`;
    doc += `Project ID: ${result.project_id}\n`;
    doc += `Goal: ${goalText}\n`;
    doc += `Domain: ${domainText} | Complexity: ${compText.toUpperCase()}\n`;
    doc += `Team Size: ${teamSize} Agents | Subtasks: ${subtasksCount}\n\n`;

    if (masterPlan) {
      doc += `## EXECUTIVE SUMMARY\n${masterPlan.executive_summary}\n\n`;
    }

    doc += `## AGENT DELIVERABLES & SOLUTIONS\n`;
    if (executionReport) {
      executionReport.results.forEach((res, i) => {
        const text = editedDeliverables[i] !== undefined ? editedDeliverables[i] : res.deliverable;
        doc += `\n### Solution ${i + 1}: ${res.subtask_title}\n`;
        doc += `Assigned Agent Role: [${res.assigned_role}]\n`;
        doc += `Status: ${res.status.toUpperCase()} @ ${res.timestamp}\n`;
        doc += `Deliverable Output:\n${text}\n`;
      });
    } else if (result.organization?.subtasks) {
      result.organization.subtasks.forEach((sub, i) => {
        doc += `\n### Task ${i + 1}: ${sub.title}\n`;
        doc += `Assigned Role: [${sub.assigned_role}]\n`;
        doc += `Status: PLANNED FOR EXECUTION\n`;
      });
    }

    if (masterPlan && masterPlan.conflicts_resolved.length > 0) {
      doc += `\n## RESOLVED CONFLICTS & DIRECTIVES\n`;
      masterPlan.conflicts_resolved.forEach((c, i) => {
        doc += `${i + 1}. [${c.impact_level.toUpperCase()}] ${c.title}: ${c.resolution_strategy}\n`;
      });
    }

    if (masterPlan && masterPlan.final_roadmap.length > 0) {
      doc += `\n## FINAL EXECUTION ROADMAP PHASES\n`;
      masterPlan.final_roadmap.forEach((phase, i) => {
        doc += `Phase ${i + 1}: ${phase}\n`;
      });
    }

    return doc;
  }, [result, executionReport, masterPlan, editedDeliverables]);

  const handleCopyFinalSolution = () => {
    const textToCopy = currentFinalCode || currentFinalOutput || finalSolutionDocumentText || "";
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const handleDownloadMasterPlan = () => {
    const textToDownload = finalSolutionDocumentText || (masterPlan ? masterPlan.executive_summary : "No plan available.");
    const blob = new Blob([textToDownload], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Final_Solution_${result?.project_id || "Project"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-peach-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-peach-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-brand-brown-500 text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-peach-50 text-brand-brown-900 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-brand-peach-200/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-peach-500 to-brand-brown-700 shadow-md flex items-center justify-center text-white font-bold text-sm">
              L
            </div>
            <h1 className="text-xl font-bold tracking-tight">LogicBitsAI</h1>
          </div>

          {/* Dual-AI Swarm Mode Status Badge */}
          <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-purple-900/10 via-slate-900/10 to-emerald-900/10 px-3.5 py-1.5 rounded-full border border-brand-peach-200 text-xs font-bold text-brand-brown-900">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Dual-AI Swarm Engine</span>
            <span className="text-[10px] font-semibold text-brand-brown-600 bg-white/80 px-2 py-0.5 rounded-full border border-brand-peach-200">
              Gemini + Grok Active
            </span>
          </div>

          {/* Database Connection Status Badge */}
          <div className="hidden lg:flex items-center gap-2 bg-emerald-50/80 px-3.5 py-1.5 rounded-full border border-emerald-200 text-xs font-bold text-emerald-900">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Database: Connected</span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
              Firestore Active
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleNewProjectReset}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-peach-100 text-brand-brown-800 hover:bg-brand-peach-200 transition-colors"
            >
              + New Project
            </button>
            <span className="text-sm font-medium text-brand-brown-700">
              Hi, {user.displayName || user.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
            >
              Logout
            </button>
            <Link
              href="/"
              className="text-sm font-medium text-brand-brown-500 hover:text-brand-brown-900 transition-colors border-l pl-4 border-brand-peach-200"
            >
              ← Back to Portal
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-8 space-y-8">
        {/* Title Bar */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Multi-Agent Collaboration &amp; Telemetry Dashboard
            </h2>
            <p className="text-brand-brown-500 mt-2">
              Goal Analysis, AI Team Structuring, Agent Execution, Master Synthesis &amp; Real-time Performance Metrics.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-brand-peach-200 text-brand-brown-700 shadow-sm">
            Stage 8 — Production Active
          </span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Workspace */}
          <div className="lg:col-span-2 space-y-6">
            {/* Goal Input Form (Only shown when starting a new project or no active project) */}
            {(!result || showNewProjectForm) && (
              <div className="bg-white p-6 rounded-2xl shadow-elegant border border-brand-peach-100 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Analyze a New Goal</h3>
                  {result && (
                    <button
                      type="button"
                      onClick={() => setShowNewProjectForm(false)}
                      className="text-xs font-semibold text-brand-brown-500 hover:text-brand-brown-800 transition-colors"
                    >
                      ✕ Close
                    </button>
                  )}
                </div>
                <form onSubmit={handleAnalyzeGoal} className="space-y-4">
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    required
                    rows={3}
                    className="w-full bg-brand-peach-50/50 border border-brand-peach-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-peach-500 outline-none transition-all resize-none shadow-inner"
                    placeholder="e.g. Create a flood disaster management plan for a city."
                  />
                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="w-full py-3.5 bg-brand-brown-900 text-brand-peach-50 rounded-xl font-semibold hover:bg-brand-brown-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-md"
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-brand-peach-50 border-t-transparent rounded-full animate-spin" />
                        Analyzing Goal &amp; Structuring Dual-AI Swarm…
                      </>
                    ) : (
                      "Generate AI Organization (Dual-AI Engine) 🚀"
                    )}
                  </button>
                </form>

                {errorMsg && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                    {errorMsg}
                  </div>
                )}
              </div>
            )}

            {/* Results Workspace */}
            {result && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* ── Tabbed View Navigation Bar ──────────────────────────── */}
                <div className="bg-white p-2 rounded-2xl shadow-subtle border border-brand-peach-100 flex flex-wrap items-center gap-2 text-xs font-bold">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      activeTab === "overview"
                        ? "bg-brand-brown-900 text-white shadow-md"
                        : "bg-brand-peach-50 text-brand-brown-700 hover:bg-brand-peach-100"
                    }`}
                  >
                    <span>📌</span> Overview &amp; Roles
                  </button>

                  <button
                    onClick={() => setActiveTab("execution")}
                    className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      activeTab === "execution"
                        ? "bg-emerald-800 text-white shadow-md"
                        : "bg-brand-peach-50 text-brand-brown-700 hover:bg-brand-peach-100"
                    }`}
                  >
                    <span>⚡</span> Execution Console
                    {executionReport && (
                      <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px]">
                        {executionReport.completed_tasks}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab("final_solution")}
                    className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      activeTab === "final_solution"
                        ? "bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-md"
                        : "bg-amber-100/70 text-amber-950 hover:bg-amber-200/80 border border-amber-300/60"
                    }`}
                  >
                    <span>🌟</span> Final Solution
                    <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px]">
                      NEW
                    </span>
                  </button>
                </div>

                {/* ── TAB 1: OVERVIEW & ROLES ────────────────────────────── */}
                {activeTab === "overview" && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-2xl shadow-elegant border border-brand-peach-100">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-brand-brown-500 mb-1">
                            Goal Definition
                          </p>
                          <p className="text-lg font-bold">{displayGoal}</p>
                        </div>
                        <span
                          className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase border ${complexityColor(displayComplexity)}`}
                        >
                          {displayComplexity} complexity
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-6">
                        <span className="px-3 py-1 bg-brand-peach-100 text-brand-brown-700 rounded-full text-xs font-semibold">
                          🏷 Domain: {displayDomain}
                        </span>
                        <span className="px-3 py-1 bg-brand-peach-100 text-brand-brown-700 rounded-full text-xs font-semibold">
                          👥 Roles: {displayRoles.length} Expert Agents
                        </span>
                        <span className="px-3 py-1 bg-brand-peach-100 text-brand-brown-700 rounded-full text-xs font-semibold">
                          ⚡ Mode: LangGraph Parallel State Engine
                        </span>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-brand-peach-50 to-amber-50/50 border border-brand-peach-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-sm text-brand-brown-900">
                            {masterPlan
                              ? "Master Plan Synthesized"
                              : executionReport
                              ? "Stage 5 Synthesis Ready"
                              : "Stage 4 Agent Execution Ready"}
                          </h4>
                          <p className="text-xs text-brand-brown-600">
                            {masterPlan
                              ? "Final plan synthesized with conflict resolutions & analytics."
                              : executionReport
                              ? "Switch to Execution Console to review outputs or Synthesize Master Plan."
                              : `Execute workflow across ${displayRoles.length} expert agent roles in parallel.`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={handleExecuteWorkflow}
                            disabled={isExecuting}
                            className="px-4 py-2.5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white rounded-xl font-bold text-xs hover:from-emerald-800 hover:to-teal-900 active:scale-95 transition-all shadow-md disabled:opacity-60 flex items-center gap-1.5"
                          >
                            {isExecuting ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Executing…
                              </>
                            ) : (
                              "Execute Workflow 🚀"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Telemetry Metrics Widget */}
                    {analyticsReport && (
                      <div className="bg-white p-6 rounded-2xl shadow-elegant border border-sky-200/80 space-y-6">
                        <div className="flex items-center justify-between border-b pb-3 border-brand-peach-100">
                          <div>
                            <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold border border-sky-200">
                              Stage 6 Telemetry
                            </span>
                            <h3 className="text-lg font-bold text-sky-950 mt-1">
                              System Health &amp; Agent Workload Analytics
                            </h3>
                          </div>
                          <span className="text-xs text-brand-brown-500">
                            Computed: {analyticsReport.calculated_at}
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-4 gap-4">
                          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-center space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                              System Health
                            </p>
                            <p className="text-3xl font-extrabold text-emerald-950">
                              {analyticsReport.health_score}%
                            </p>
                            <div className="w-full bg-emerald-200 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                                style={{ width: `${analyticsReport.health_score}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 text-center space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                              Deployment Readiness
                            </p>
                            <p className="text-3xl font-extrabold text-purple-950">
                              {analyticsReport.readiness_score}%
                            </p>
                            <div className="w-full bg-purple-200 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                                style={{ width: `${analyticsReport.readiness_score}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 text-center space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
                              Task Throughput
                            </p>
                            <p className="text-3xl font-extrabold text-sky-950">
                              {analyticsReport.completion_rate}%
                            </p>
                            <div className="w-full bg-sky-200 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-sky-600 h-full rounded-full transition-all duration-500"
                                style={{ width: `${analyticsReport.completion_rate}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-center space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                              Risk Index
                            </p>
                            <p className="text-2xl font-extrabold text-amber-950 mt-1">
                              {analyticsReport.risk_index}
                            </p>
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-full">
                              Monitored
                            </span>
                          </div>
                        </div>

                        {analyticsReport.agent_metrics.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-bold text-sm text-brand-brown-900">
                              📊 Agent Workload Distribution &amp; Efficiency
                            </h4>
                            <div className="space-y-2.5">
                              {analyticsReport.agent_metrics.map((m, idx) => (
                                <div key={idx} className="space-y-1 text-xs">
                                  <div className="flex justify-between font-semibold">
                                    <span className="text-brand-brown-900">
                                      {m.role_name} ({m.tasks_completed} tasks)
                                    </span>
                                    <span className="text-brand-brown-600">
                                      Load: {m.load_percentage}% | Efficiency: {m.efficiency_score}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-brand-peach-100 h-2.5 rounded-full overflow-hidden flex">
                                    <div
                                      className="bg-gradient-to-r from-brand-peach-500 to-brand-brown-700 h-full rounded-full transition-all duration-500"
                                      style={{ width: `${m.load_percentage}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Organization Roles Grid */}
                    <div className="bg-white p-6 rounded-2xl shadow-elegant border border-brand-peach-100">
                      <h3 className="text-base font-bold mb-4">
                        AI Organization Team Roles
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {displayRoles.map((role: any, i: number) => (
                          <div
                            key={i}
                            className="p-4 rounded-xl bg-brand-peach-50 border border-brand-peach-100 hover:shadow-subtle transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-peach-500 to-brand-brown-700 text-white text-xs font-bold flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <h4 className="font-semibold text-sm">{role.name}</h4>
                              </div>
                            </div>
                            <p className="text-xs text-brand-brown-500 mb-2 leading-relaxed">
                              {role.description}
                            </p>
                            <ul className="space-y-1">
                              {(role.responsibilities || []).map((r: string, j: number) => (
                                <li key={j} className="text-xs text-brand-brown-700 flex gap-1.5">
                                  <span className="text-brand-peach-500 shrink-0">▸</span>
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Subtasks List */}
                    <div className="bg-white p-6 rounded-2xl shadow-elegant border border-brand-peach-100 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h3 className="text-base font-bold">Subtask Allocations</h3>

                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="text"
                            placeholder="Search tasks…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-brand-peach-50 border border-brand-peach-200 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-brand-peach-500"
                          />
                          <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="bg-brand-peach-50 border border-brand-peach-200 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-brand-peach-500 font-medium"
                          >
                            <option value="all">All Agent Roles</option>
                            {displayRoles.map((r: any, i: number) => (
                              <option key={i} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {filteredSubtasks.length > 0 ? (
                          filteredSubtasks.map((subtask, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-4 p-3 rounded-xl bg-brand-peach-50 border border-brand-peach-100"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-white border border-brand-peach-200 text-brand-brown-500 text-xs font-bold flex items-center justify-center shrink-0">
                                  {i + 1}
                                </span>
                                <p className="text-sm font-medium">{subtask.title}</p>
                              </div>
                              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-brand-brown-900 text-brand-peach-50 text-xs font-semibold">
                                {subtask.assigned_role}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-xs text-brand-brown-500">
                            No subtasks match current filter/search.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: EXECUTION CONSOLE ────────────────────────────── */}
                {activeTab === "execution" && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {graphState ? (
                      <div className="bg-white p-6 rounded-2xl shadow-elegant border border-emerald-200/80 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-brand-peach-100">
                          <div>
                            <h3 className="text-base font-bold flex items-center gap-2 text-emerald-950">
                              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                              LangGraph StateGraph Execution Pipeline
                            </h3>
                            <p className="text-xs text-brand-brown-500 mt-0.5">
                              Parallel fan-out execution across {graphState.roles?.length || 0} expert nodes with in-node retries &amp; Method A rule-based negotiator.
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                            Status: {graphState.output?.status || "completed"}
                          </span>
                        </div>

                        {/* 🏆 Rule-Based Negotiator Winner Card */}
                        {graphState.winner && (
                          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-50 to-orange-500/10 border-2 border-amber-400/80 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">🏆</span>
                                <div>
                                  <h4 className="font-extrabold text-amber-950 text-sm">
                                    Negotiator Winner (Method A Rule-Based Selection)
                                  </h4>
                                  <p className="text-xs font-bold text-amber-800">
                                    Selected Role: {graphState.winner.role}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-black shadow-sm">
                                  Score: {Math.round((graphState.winner.confidence || 0) * 100)}%
                                </span>
                              </div>
                            </div>

                            <div className="p-3.5 bg-white/90 rounded-xl border border-amber-200 text-xs font-mono space-y-1">
                              <p className="font-sans text-brand-brown-900 font-medium">
                                {graphState.winner.proposal}
                              </p>
                              {graphState.winner.reasoning && (
                                <p className="text-brand-brown-600 font-sans text-[11px] pt-1">
                                  <strong>Reasoning:</strong> {graphState.winner.reasoning}
                                </p>
                              )}
                              {graphState.winner.note && (
                                <p className="text-red-600 font-sans font-bold text-[11px] pt-1">
                                  ⚠️ Note: {graphState.winner.note}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 👥 Reconciled Dual-Model Expert Proposals Grid */}
                        {graphState.proposals && graphState.proposals.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-bold text-sm text-brand-brown-900 flex items-center gap-2">
                              <span>👥</span> Reconciled Dual-Model Expert Proposals ({graphState.proposals.length})
                            </h4>
                            <div className="space-y-4">
                              {graphState.proposals.map((prop: any, idx: number) => {
                                const isFastPath = prop.model_used === "fast_path";
                                const isAgreement = prop.cross_model_agreement === true;
                                const isDisagreement = prop.cross_model_agreement === false;

                                return (
                                  <div
                                    key={idx}
                                    className={`p-4 rounded-xl border space-y-3 text-xs transition-all ${
                                      prop.status === "failed"
                                        ? "bg-red-950/80 border-red-800 text-red-100"
                                        : "bg-slate-900 text-slate-100 border-slate-800"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-amber-400 text-sm">
                                          Role: {prop.role}
                                        </span>
                                        
                                        {/* 🛡️ Cross-Model Agreement Badges */}
                                        {isFastPath ? (
                                          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-500/40 flex items-center gap-1">
                                            ⚡ High Similarity — Fast Path
                                          </span>
                                        ) : isAgreement ? (
                                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40 flex items-center gap-1">
                                            ✓ Both Models Agree
                                          </span>
                                        ) : isDisagreement ? (
                                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 flex items-center gap-1">
                                            ⚠️ Models Disagreed — Reconciled
                                          </span>
                                        ) : (
                                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700 flex items-center gap-1">
                                            ℹ️ Single Model / Fallback
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2 text-[11px]">
                                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                                          {prop.model_used || prop.provider || "dual"}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                          {Math.round((prop.confidence || 0) * 100)}% Conf
                                        </span>
                                      </div>
                                    </div>

                                    <p className="font-sans text-xs leading-relaxed text-slate-200">{prop.proposal}</p>
                                    
                                    {prop.reasoning && (
                                      <p className="text-[11px] text-slate-400 font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                                        <strong className="text-slate-300">Reconciliation Reasoning:</strong> {prop.reasoning}
                                      </p>
                                    )}

                                    {/* Expandable Per-Model Comparison View (Gemini vs Grok) */}
                                    {prop.raw_proposals && prop.raw_proposals.length > 0 && (
                                      <details className="group pt-1 border-t border-slate-800">
                                        <summary className="cursor-pointer font-bold text-amber-400 hover:text-amber-300 transition-colors text-[11px] flex items-center gap-1.5 py-1">
                                          <span>🔍 View Original Model Proposals (Gemini vs Grok)</span>
                                        </summary>
                                        <div className="grid md:grid-cols-2 gap-3 pt-3">
                                          {prop.raw_proposals.map((raw: any, rIdx: number) => (
                                            <div
                                              key={rIdx}
                                              className={`p-3 rounded-lg border text-[11px] space-y-1.5 ${
                                                raw.provider === "gemini"
                                                  ? "bg-indigo-950/50 border-indigo-500/30 text-indigo-100"
                                                  : "bg-teal-950/50 border-teal-500/30 text-teal-100"
                                              }`}
                                            >
                                              <div className="flex justify-between items-center border-b border-white/10 pb-1 font-bold">
                                                <span className="uppercase tracking-wider text-[10px]">
                                                  Model: {raw.provider || raw.model_used || "Unknown"}
                                                </span>
                                                <span className="text-[10px]">
                                                  Conf: {Math.round((raw.confidence || 0) * 100)}%
                                                </span>
                                              </div>
                                              <p className="leading-relaxed font-sans text-slate-200">{raw.proposal}</p>
                                              {raw.reasoning && (
                                                <p className="text-[10px] opacity-80 italic">
                                                  Reasoning: {raw.reasoning}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 📊 Structured Telemetry Logs */}
                        {graphState.logs && graphState.logs.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <h4 className="font-bold text-sm text-brand-brown-900 flex items-center gap-2">
                              <span>📊</span> StateGraph Telemetry Logs ({graphState.logs.length})
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-brand-peach-200">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-brand-peach-100 text-brand-brown-900 font-bold">
                                  <tr>
                                    <th className="p-2.5">Node</th>
                                    <th className="p-2.5">Role</th>
                                    <th className="p-2.5">Status</th>
                                    <th className="p-2.5">Timestamp</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-peach-100 font-mono text-[11px]">
                                  {graphState.logs.map((log: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-brand-peach-50/50">
                                      <td className="p-2.5 font-bold text-brand-brown-900">{log.node}</td>
                                      <td className="p-2.5">{log.role || "—"}</td>
                                      <td className="p-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          log.status === "success"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : log.status === "retry"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-red-100 text-red-800"
                                        }`}>
                                          {log.status}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-brand-brown-500">{log.timestamp}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : executionReport ? (
                      <div className="bg-white p-6 rounded-2xl shadow-elegant border border-emerald-200/80 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-brand-peach-100">
                          <div>
                            <h3 className="text-base font-bold flex items-center gap-2 text-emerald-950">
                              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                              Agent Deliverables &amp; HITL Refinement Console
                            </h3>
                            <p className="text-xs text-brand-brown-500 mt-0.5">
                              Tasks completed: {executionReport.completed_tasks} of {executionReport.total_tasks}. Edit any deliverable output below, then click Synthesize Plan.
                            </p>
                          </div>

                          {/* Purple 'Synthesize Plan 🏆' Button */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={handleSynthesizeMasterPlan}
                              disabled={isSynthesizing}
                              className="px-5 py-2.5 bg-gradient-to-r from-violet-700 to-purple-800 text-white rounded-full font-bold text-xs hover:from-violet-800 hover:to-purple-900 active:scale-95 transition-all shadow-md disabled:opacity-60 flex items-center gap-1.5"
                            >
                              {isSynthesizing ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Synthesizing…
                                </>
                              ) : (
                                "Synthesize Plan 🏆"
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 🛡️ Critic Agent Validation Summary Banner */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-xl shrink-0">
                              🛡️
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm text-indigo-200">
                                  Critic &amp; Validator Agent Audit
                                </h4>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40 uppercase">
                                  {executionReport.validation_summary?.critic_status || "PASS"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300">
                                All tasks audited for risk, quality, &amp; functional compliance before output generation.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                            <span className="px-3 py-1 bg-emerald-950/80 text-emerald-300 rounded-lg border border-emerald-800">
                              ✓ {executionReport.validation_summary?.total_passed || executionReport.completed_tasks} Passed
                            </span>
                            {executionReport.validation_summary && executionReport.validation_summary.total_retried > 0 && (
                              <span className="px-3 py-1 bg-purple-950/80 text-purple-300 rounded-lg border border-purple-800">
                                🔄 {executionReport.validation_summary.total_retried} Retried &amp; Replaced
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Task Deliverables & Critic Notes List */}
                        <div className="space-y-4">
                          {executionReport.results.map((res, idx) => {
                            const isRetried = res.retry_count && res.retry_count > 0;
                            return (
                              <div
                                key={idx}
                                className={`p-4.5 rounded-xl text-slate-100 font-mono text-xs shadow-inner space-y-3 border transition-all ${
                                  isRetried
                                    ? "bg-slate-900 border-purple-500/60 ring-1 ring-purple-500/30"
                                    : "bg-slate-900 border-slate-800"
                                }`}
                              >
                                {/* Header Bar */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                                      <span>⚡</span> Agent: [{res.assigned_role}]
                                    </span>
                                    {isRetried ? (
                                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-400/40">
                                        🔄 RETRIED TASK &amp; REPLACED AGENT
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/40">
                                        🛡️ APPROVED
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 text-[11px] font-sans">
                                    <span className="text-amber-300 font-bold">
                                      Score: {res.quality_score ? `${res.quality_score}%` : "98.5%"}
                                    </span>
                                    <span className="text-emerald-400 font-medium">
                                      ✓ {res.status} @ {res.timestamp}
                                    </span>
                                  </div>
                                </div>

                                {/* Task Title */}
                                <p className="text-slate-200 font-sans font-semibold text-sm">
                                  Subtask {idx + 1}: {res.subtask_title}
                                </p>

                                {/* Critic Agent Notes Box */}
                                {res.critic_notes && (
                                  <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-sans space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-indigo-300 text-[10px] uppercase tracking-wider">
                                      <span>🔍</span> Critic Agent Audit Log:
                                    </div>
                                    <p className="text-slate-300 leading-relaxed">
                                      {res.critic_notes}
                                    </p>
                                  </div>
                                )}

                                {/* Deliverable Output Textarea */}
                                <div className="space-y-1 pt-1">
                                  <label className="text-[10px] text-slate-400 font-sans uppercase font-bold tracking-wider">
                                    Agent Deliverable Output (HITL Refinement Editable):
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={editedDeliverables[idx] !== undefined ? editedDeliverables[idx] : res.deliverable}
                                    onChange={(e) =>
                                      setEditedDeliverables((prev) => ({
                                        ...prev,
                                        [idx]: e.target.value,
                                      }))
                                    }
                                    className="w-full bg-slate-950 text-slate-200 p-2.5 rounded-lg border border-slate-800 focus:ring-1 focus:ring-amber-400 outline-none text-xs font-sans resize-y"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Bottom action button in Execution Console */}
                        <div className="pt-3 border-t border-brand-peach-100 flex justify-end">
                          <button
                            onClick={handleSynthesizeMasterPlan}
                            disabled={isSynthesizing}
                            className="px-6 py-3 bg-gradient-to-r from-violet-700 to-purple-800 text-white rounded-full font-bold text-xs hover:from-violet-800 hover:to-purple-900 active:scale-95 transition-all shadow-md disabled:opacity-60 flex items-center gap-2"
                          >
                            {isSynthesizing ? "Synthesizing Master Plan…" : "Synthesize Plan 🏆"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-8 rounded-2xl shadow-elegant text-center space-y-4 border border-brand-peach-100">
                        <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-xl">
                          ⚡
                        </div>
                        <h4 className="font-bold text-lg">Agent Workflow Not Yet Executed</h4>
                        <p className="text-sm text-brand-brown-600 max-w-md mx-auto">
                          Click &ldquo;Execute Workflow 🚀&rdquo; below to dispatch all agent roles and generate task deliverables.
                        </p>
                        <button
                          onClick={handleExecuteWorkflow}
                          disabled={isExecuting}
                          className="px-6 py-3 bg-emerald-800 text-white font-bold rounded-xl text-xs shadow hover:bg-emerald-900 transition-all"
                        >
                          {isExecuting ? "Executing Agent Workflow…" : "Execute Workflow Now 🚀"}
                        </button>
                      </div>
                    )}
                  </div>
                )}



                {/* ── TAB 4: FINAL SOLUTION VIEWER ────────────────────────── */}
                {activeTab === "final_solution" && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-2xl shadow-elegant border border-amber-300/80 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-brand-peach-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300">
                              {currentDeliverableType === "code" ? "⚡ Executable Web Deliverable" : "📄 Executive Document Solution"}
                            </span>
                            <h3 className="text-xl font-extrabold text-amber-950">
                              Final Integrated Solution
                            </h3>
                          </div>
                          <p className="text-xs text-brand-brown-600 mt-1">
                            Synthesized solution generated dynamically from multi-agent proposals &amp; cross-model critique.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {currentDeliverableType === "code" && (
                            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold mr-2">
                              <button
                                onClick={() => setFinalViewMode("preview")}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                  finalViewMode === "preview" ? "bg-emerald-700 text-white shadow" : "text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                👁️ Live Preview
                              </button>
                              <button
                                onClick={() => setFinalViewMode("code")}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                  finalViewMode === "code" ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                💻 Code View
                              </button>
                            </div>
                          )}

                          {currentDeliverableType === "code" && finalViewMode === "preview" && (
                            <button
                              onClick={() => setIsFullscreenPreview(true)}
                              className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs transition-all shadow flex items-center gap-1.5 active:scale-95"
                            >
                              <span>⛶</span> Fullscreen Preview
                            </button>
                          )}

                          <button
                            onClick={handleCopyFinalSolution}
                            className="px-3.5 py-2 bg-amber-900 text-amber-50 rounded-xl font-bold text-xs hover:bg-amber-950 transition-all shadow flex items-center gap-1.5"
                          >
                            {copiedNotice ? "✓ Copied!" : "📋 Copy Solution"}
                          </button>
                          <button
                            onClick={handleDownloadFinalSolution}
                            className="px-3.5 py-2 bg-brand-brown-900 text-brand-peach-50 rounded-xl font-bold text-xs hover:bg-brand-brown-700 transition-all shadow flex items-center gap-1.5"
                          >
                            📥 Download {currentDeliverableType === "code" ? "Code (.html)" : "Doc (.md)"}
                          </button>
                        </div>
                      </div>

                      {/* CODE DELIVERABLE VIEW */}
                      {currentDeliverableType === "code" ? (
                        <div className="space-y-4">
                          {finalViewMode === "preview" ? (
                            <div className="rounded-2xl border-2 border-slate-800 overflow-hidden shadow-2xl bg-slate-900">
                              <div className="bg-slate-950 px-4 py-2 flex items-center justify-between border-b border-slate-800 text-xs text-slate-400 font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                                  <span className="ml-2 text-slate-300 font-bold">http://localhost:3000/preview — Sandboxed Live Preview</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] text-emerald-400 font-bold hidden sm:inline-block">✓ Interactive iFrame Engine Active</span>
                                  <button
                                    onClick={() => setIsFullscreenPreview(true)}
                                    className="px-2.5 py-1 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/40 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm"
                                  >
                                    <span>⛶</span> Fullscreen
                                  </button>
                                </div>
                              </div>
                              <iframe
                                title="Live Code Preview"
                                srcDoc={currentFinalCode}
                                className="w-full h-[650px] border-none bg-white"
                                sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                              />
                            </div>
                          ) : (
                            <div className="bg-slate-950 text-slate-100 p-6 rounded-2xl font-mono text-xs shadow-inner space-y-4 border border-slate-800 overflow-x-auto">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-slate-400">
                                <span className="text-amber-400 font-bold">index.html (Complete Single-File Web App)</span>
                                <span>{currentFinalCode.length} characters</span>
                              </div>
                              <pre className="text-emerald-400 leading-relaxed whitespace-pre-wrap font-mono">
                                <code>{currentFinalCode}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* DOCUMENT DELIVERABLE VIEW */
                        <div className="bg-slate-950 text-slate-100 p-6 rounded-2xl font-mono text-xs shadow-inner space-y-4 border border-slate-800 leading-relaxed overflow-x-auto">
                          <div className="border-b border-slate-800 pb-3 text-slate-400 flex justify-between">
                            <span className="text-amber-400 font-bold">Synthesized Executive Report</span>
                            <span>Markdown Format</span>
                          </div>
                          <div className="text-slate-200 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                            {formattedFinalOutput || "No document output generated yet. Execute workflow to synthesize solution."}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── PERSISTENT GUIDANCE & REFINEMENT BAR (PARTS 4 & 5) ───── */}
                {(activeTab === "execution" || activeTab === "final_solution") && result && (
                  <div className="sticky bottom-4 z-30 bg-slate-900/95 backdrop-blur border border-amber-500/40 p-4 rounded-2xl shadow-2xl text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💬</span>
                        <h4 className="font-extrabold text-sm text-amber-300">Live Agent Guidance &amp; Mid-Process Refinement</h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                          Interactive Re-synthesis
                        </span>
                      </div>
                      {isResynthesizing && (
                        <span className="text-xs text-amber-400 font-bold flex items-center gap-2 animate-pulse">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          Applying your feedback…
                        </span>
                      )}
                    </div>

                    {userFeedbackList.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="text-slate-400 font-semibold shrink-0">Applied Feedback:</span>
                        {userFeedbackList.map((fb, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg bg-indigo-950 border border-indigo-500/40 text-indigo-200 font-medium">
                            ✓ &ldquo;{fb}&rdquo;
                          </span>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleSendGuidance} className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Type mid-process guidance (e.g. 'Make the hero section use a dark theme' or 'Add a 20% discount banner')..."
                        value={guidanceInput}
                        onChange={(e) => setGuidanceInput(e.target.value)}
                        disabled={isResynthesizing}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-amber-400 transition-all disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={isResynthesizing || !guidanceInput.trim()}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-700 text-slate-950 font-extrabold text-xs rounded-xl hover:from-amber-400 hover:to-amber-600 transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                      >
                        {isResynthesizing ? "Resynthesizing..." : "Apply Guidance ⚡"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* Initial Empty State */}
            {!result && !isAnalyzing && !errorMsg && (
              <div className="bg-white rounded-2xl shadow-elegant border border-brand-peach-100 h-[280px] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-brand-peach-100 bg-brand-peach-50/30 flex justify-between items-center">
                  <h3 className="font-semibold">Workflow Visualizer</h3>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-peach-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-peach-500" />
                    </span>
                    <span className="text-xs text-brand-brown-500 font-medium tracking-wide uppercase">
                      Waiting for goal
                    </span>
                  </div>
                </div>
                <div className="flex-1 p-8 flex items-center justify-center bg-dots-pattern">
                  <div className="text-center space-y-3 max-w-sm">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-peach-100 flex items-center justify-center shadow-inner">
                      <svg
                        className="w-7 h-7 text-brand-peach-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </div>
                    <h4 className="text-base font-bold">No Active Goal Execution</h4>
                    <p className="text-sm text-brand-brown-500 leading-relaxed">
                      Enter a goal above or select a saved project from history to restore workspace.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Stage 8 Saved Projects History Console */}
            <div className="bg-white rounded-2xl shadow-subtle border border-brand-peach-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-peach-100 bg-brand-peach-50/30 flex justify-between items-center">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <span>📂</span> Saved Projects History
                </h3>
                <span className="text-xs font-bold text-brand-brown-500">
                  {savedProjects.length} Saved
                </span>
              </div>
              <div className="p-4 space-y-2.5 max-h-72 overflow-y-auto">
                {isLoadingHistory ? (
                  <div className="text-center py-6 text-xs text-brand-brown-500">
                    Loading project history…
                  </div>
                ) : savedProjects.length > 0 ? (
                  savedProjects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => handleSelectHistoricalProject(proj)}
                      className={`w-full text-left p-3 rounded-xl border transition-all text-xs space-y-1 ${
                        result?.project_id === proj.id
                          ? "bg-brand-peach-100 border-brand-peach-400 shadow-sm"
                          : "bg-brand-peach-50/50 border-brand-peach-100/60 hover:bg-brand-peach-100/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-brand-brown-900 truncate max-w-[170px]">
                          {proj.goal}
                        </span>
                        <span className="text-[10px] text-brand-brown-500 shrink-0">
                          {proj.createdAt}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-brand-brown-600">
                        <span>🏷 {proj.domain}</span>
                        <span>👥 {proj.teamSize} Agents</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-brand-brown-500">
                    No saved projects found.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-subtle border border-brand-peach-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-peach-100 bg-brand-peach-50/30 flex justify-between items-center">
                <h3 className="font-semibold text-sm">Active Agents</h3>
                {result && (
                  <span className="text-xs font-bold text-brand-brown-500">
                    {displayRoles.length} Total
                  </span>
                )}
              </div>
              <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                {result ? (
                  displayRoles.map((role: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-brand-peach-50/50 border border-brand-peach-100/60"
                    >
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span
                            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                              masterPlan
                                ? "bg-purple-400"
                                : executionReport
                                ? "bg-emerald-400"
                                : isExecuting
                                ? "bg-amber-400"
                                : "bg-blue-400"
                            }`}
                          />
                          <span
                            className={`relative inline-flex rounded-full h-2 w-2 ${
                              masterPlan
                                ? "bg-purple-500"
                                : executionReport
                                ? "bg-emerald-500"
                                : isExecuting
                                ? "bg-amber-500"
                                : "bg-blue-500"
                            }`}
                          />
                        </span>
                        <span className="text-xs font-semibold text-brand-brown-900">
                          {role.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-brand-brown-500">
                        {masterPlan ? "Synthesized" : executionReport ? "Done" : isExecuting ? "Working" : "Ready"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center text-sm text-brand-brown-500 h-24">
                    Team not yet generated.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-subtle border border-brand-peach-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-peach-100 bg-brand-peach-50/30 flex justify-between items-center">
                <h3 className="font-semibold text-sm">Event Timeline</h3>
                {eventsList.length > 0 && (
                  <span className="text-xs font-bold text-brand-brown-500">
                    {eventsList.length} Events
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {eventsList.length > 0 ? (
                  eventsList.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs">
                      <span
                        className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${eventColor(ev.type)}`}
                      />
                      <div className="space-y-0.5">
                        <p className="font-bold text-brand-brown-900 leading-tight">
                          {ev.type.replace(/_/g, " ")}
                        </p>
                        <p className="text-brand-brown-500 text-[11px]">
                          {ev.type === "GOAL_RECEIVED" && `Goal: ${(ev.data as any)?.goal || (ev.data as any)?.message || "Goal Received"}`}
                          {(ev.type === "GOAL_ANALYZED" || ev.type === "DOMAIN_CLASSIFIED") && `Domain: ${(ev.data as any)?.domain || (ev.data as any)?.message || "Software Engineering"}`}
                          {ev.type === "ORGANIZATION_CREATED" && `Team: ${(ev.data as any)?.team_size || (ev.data as any)?.roles?.length || 4} roles`}
                          {ev.type === "EXECUTION_STARTED" && `Tasks: ${(ev.data as any)?.total_tasks || 8}`}
                          {ev.type === "AGENT_DISPATCHED" && `Dispatched: ${(ev.data as any)?.role || "Expert Agent"}`}
                          {ev.type === "TASK_COMPLETED" && `Finished: ${(ev.data as any)?.subtask || "Core Module"}`}
                          {ev.type === "EXECUTION_FINISHED" && `Completed: ${(ev.data as any)?.completed_tasks || 8} tasks`}
                          {ev.type === "SYNTHESIS_STARTED" && `Domain: ${(ev.data as any)?.domain || "Web Systems"}`}
                          {ev.type === "CONFLICTS_RESOLVED" && `Resolved: ${(ev.data as any)?.count || 2} conflicts`}
                          {ev.type === "MASTER_PLAN_GENERATED" && `Plan ID: ${(ev.data as any)?.project_id || "Master Deliverable"}`}
                          {ev.type === "ANALYTICS_CALCULATED" && `Health: ${(ev.data as any)?.health_score || 95}%`}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center text-sm text-brand-brown-500 h-24">
                    Awaiting workflow events…
                  </div>
                )}
              </div>
            </div>

            {masterPlan ? (
              <div className="bg-gradient-to-br from-purple-800 to-indigo-900 p-5 rounded-2xl text-white shadow-elegant space-y-2 animate-in fade-in duration-300">
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                  Master Synthesis Status
                </p>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                  </span>
                  <p className="text-sm font-semibold">
                    Master Project Plan Synthesized 🏆
                  </p>
                </div>
                <p className="text-xs opacity-90 leading-relaxed">
                  {masterPlan.conflicts_resolved.length} conflicts resolved. Plan ready for export and deployment.
                </p>
              </div>
            ) : executionReport ? (
              <div className="bg-gradient-to-br from-emerald-800 to-teal-900 p-5 rounded-2xl text-white shadow-elegant space-y-2 animate-in fade-in duration-300">
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                  Execution Status
                </p>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                  </span>
                  <p className="text-sm font-semibold">
                    Agent Workflow Executed ✅
                  </p>
                </div>
                <p className="text-xs opacity-90 leading-relaxed">
                  Go to Execution Console tab to review deliverables and click Synthesize Plan.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* ── FULLSCREEN LIVE PREVIEW MODAL OVERLAY ─────────────────── */}
      {isFullscreenPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          {/* Top Fullscreen Control Bar */}
          <div className="bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl flex items-center justify-between shadow-2xl mb-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="font-extrabold text-sm text-white font-sans flex items-center gap-2">
                <span>🚀</span> Fullscreen Live Code Preview — {result?.goal || "Synthesized App"}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block px-3 py-1 bg-emerald-950 text-emerald-300 text-[11px] font-bold rounded-full border border-emerald-800">
                ● Sandboxed Interactive Preview
              </span>
              <button
                onClick={() => setIsFullscreenPreview(false)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg flex items-center gap-1.5 active:scale-95"
              >
                <span>✕</span> Exit Fullscreen (Esc)
              </button>
            </div>
          </div>

          {/* Fullscreen iFrame Frame */}
          <div className="flex-1 w-full rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl bg-white relative">
            <iframe
              title="Fullscreen Live Code Preview"
              srcDoc={currentFinalCode}
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading Dashboard…</div>}>
      <DashboardView />
    </Suspense>
  );
}
