// ui/components/AiTurnBlock.tsx - FIXED ALIGNMENT
import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useSetAtom } from "jotai";
import { toastAtom } from "../state/atoms";
import { AiTurn, ProviderResponse, AppStep } from "../types";
import MarkdownDisplay from "./MarkdownDisplay";
import { LLM_PROVIDERS_CONFIG } from "../constants";
import ClipsCarousel from "./ClipsCarousel";
import { ChevronDownIcon, ChevronUpIcon, ListIcon } from "./Icons";
import {
  normalizeResponseArray,
  getLatestResponse,
} from "../utils/turn-helpers";

// --- Helper Functions ---
function parseMappingResponse(response?: string | null) {
  // NOTE: This function is SPECIFICALLY for the "Decision Map" / "Options" split.
  // It should NOT be used on the Synthesis text, which is pure markdown.
  if (!response) return { mapping: "", options: null };
  const separator = "===ALL_AVAILABLE_OPTIONS===";
  if (response.includes(separator)) {
    const [mainMapping, optionsSection] = response.split(separator);
    return { mapping: mainMapping.trim(), options: optionsSection.trim() };
  }
  const optionsPatterns = [
    /\*\*All Available Options:\*\*/i,
    /## All Available Options/i,
    /All Available Options:/i,
  ];
  for (const pattern of optionsPatterns) {
    const match = response.match(pattern);
    if (match && typeof match.index === "number") {
      return {
        mapping: response.substring(0, match.index).trim(),
        options: response.substring(match.index).trim(),
      };
    }
  }
  return { mapping: response, options: null };
}

/**
 * Extract Claude artifacts from response text
 * Artifacts are wrapped in <document> tags with title and identifier attributes
 */
function extractClaudeArtifacts(text: string | null | undefined): {
  cleanText: string;
  artifacts: Array<{ title: string; identifier: string; content: string }>;
} {
  if (!text) return { cleanText: "", artifacts: [] };

  const artifacts: Array<{ title: string; identifier: string; content: string }> = [];

  // Regex to match <document title="..." identifier="...">content</document>
  const artifactRegex = /<document\s+title="([^"]+)"\s+identifier="([^"]+)"\s*>([\s\S]*?)<\/document>/gi;

  let match;
  let cleanText = text;

  while ((match = artifactRegex.exec(text)) !== null) {
    const [fullMatch, title, identifier, content] = match;
    artifacts.push({
      title: title || "Untitled Artifact",
      identifier: identifier || "unknown",
      content: content.trim(),
    });

    // Remove artifact from clean text
    cleanText = cleanText.replace(fullMatch, "");
  }

  return {
    cleanText: cleanText.trim(),
    artifacts,
  };
}


interface AiTurnBlockProps {
  aiTurn: AiTurn;
  isLive?: boolean;
  isReducedMotion?: boolean;
  isLoading?: boolean;
  activeRecomputeState?: {
    aiTurnId: string;
    stepType: "synthesis" | "mapping";
    providerId: string;
  } | null;
  currentAppStep?: AppStep;
  showSourceOutputs?: boolean;
  onToggleSourceOutputs?: () => void;
  activeSynthesisClipProviderId?: string;
  activeMappingClipProviderId?: string;
  onClipClick?: (type: "synthesis" | "mapping", providerId: string) => void;
  isSynthesisExpanded?: boolean;
  onToggleSynthesisExpanded?: () => void;
  isMappingExpanded?: boolean;
  onToggleMappingExpanded?: () => void;
  synthExpanded?: boolean;
  onSetSynthExpanded?: (v: boolean) => void;
  mapExpanded?: boolean;
  onSetMapExpanded?: (v: boolean) => void;
  mappingTab?: "map" | "options";
  onSetMappingTab?: (t: "map" | "options") => void;
  primaryView?: "synthesis" | "decision-map";
  onSetPrimaryView?: (view: "synthesis" | "decision-map") => void;
  mapStatus?: "idle" | "streaming" | "ready" | "error";
  children?: React.ReactNode;
}

interface ProviderSelectorProps {
  providers: typeof LLM_PROVIDERS_CONFIG;
  responsesMap: Record<string, ProviderResponse[]>;
  activeProviderId?: string;
  onSelect: (providerId: string) => void;
  type: "synthesis" | "mapping";
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  providers,
  responsesMap,
  activeProviderId,
  onSelect,
  type,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeProvider = providers.find((p) => String(p.id) === activeProviderId);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-raised hover:bg-surface-highlight border border-border-subtle rounded-full text-xs font-medium text-text-secondary transition-all shadow-sm"
      >
        <span>{activeProvider?.name || "Select Model"}</span>
        <span className="text-[10px] opacity-70">▼</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          <div className="absolute top-full left-0 mt-2 z-50 bg-surface-raised border border-border-subtle rounded-xl shadow-xl p-2 w-[320px] flex flex-row flex-wrap gap-2 animate-in fade-in zoom-in-95 duration-100">
            {providers.map((p) => {
              const pid = String(p.id);
              const responses = responsesMap[pid] || [];
              const latest = getLatestResponse(responses);
              const isStreaming = latest?.status === "streaming";
              const hasError = latest?.status === "error";

              return (
                <button
                  key={pid}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(pid);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-2 transition-all border ${activeProviderId === pid
                    ? "bg-chip-active border-border-brand text-text-primary font-medium shadow-sm"
                    : "bg-surface border-border-subtle text-text-secondary hover:bg-surface-highlight hover:border-border-strong"
                    }`}
                >
                  <span>{p.name}</span>
                  {(isStreaming || hasError) && (
                    <div className="flex items-center gap-1">
                      {isStreaming && <span className="w-1.5 h-1.5 rounded-full bg-intent-warning animate-pulse" />}
                      {hasError && <span className="w-1.5 h-1.5 rounded-full bg-intent-danger" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
  aiTurn,
  onToggleSourceOutputs,
  showSourceOutputs = false,
  isReducedMotion = false,
  isLoading = false,
  isLive = false,
  currentAppStep,
  activeRecomputeState = null,
  activeSynthesisClipProviderId,
  activeMappingClipProviderId,
  onClipClick,
  isSynthesisExpanded = true,
  onToggleSynthesisExpanded,
  isMappingExpanded = true,
  onToggleMappingExpanded,
  synthExpanded = false,
  onSetSynthExpanded,
  mapExpanded = false,
  onSetMapExpanded,
  mappingTab = "map",
  onSetMappingTab,
  primaryView = "synthesis",
  onSetPrimaryView,
  mapStatus = "idle",
  children,
}) => {
  const setSynthExpanded = onSetSynthExpanded || (() => { });
  const setMapExpanded = onSetMapExpanded || (() => { });
  const setToast = useSetAtom(toastAtom);

  // State for Claude artifact overlay
  const [selectedArtifact, setSelectedArtifact] = useState<{
    title: string;
    identifier: string;
    content: string;
  } | null>(null);

  // --- REFS REMOVED HERE ---
  // We do NOT define mapRef/synthRef manually here anymore.
  // They come from useShorterHeight below.

  const synthesisResponses = useMemo(() => {
    if (!aiTurn.synthesisResponses) aiTurn.synthesisResponses = {};
    const out: Record<string, ProviderResponse[]> = {};
    LLM_PROVIDERS_CONFIG.forEach((p) => (out[String(p.id)] = []));
    Object.entries(aiTurn.synthesisResponses).forEach(([pid, resp]) => {
      out[pid] = normalizeResponseArray(resp);
    });
    return out;
  }, [aiTurn.id, aiTurn.synthesisVersion]);

  const mappingResponses = useMemo(() => {
    const map = aiTurn.mappingResponses || {};
    const out: Record<string, ProviderResponse[]> = {};
    LLM_PROVIDERS_CONFIG.forEach((p) => (out[String(p.id)] = []));
    Object.entries(map).forEach(([pid, resp]) => {
      out[pid] = normalizeResponseArray(resp);
    });
    return out;
  }, [aiTurn.id, aiTurn.mappingVersion]);

  const allSources = useMemo(() => {
    const sources: Record<string, ProviderResponse> = {
      ...(aiTurn.batchResponses || {}),
    };
    if (aiTurn.hiddenBatchOutputs) {
      Object.entries(aiTurn.hiddenBatchOutputs).forEach(
        ([providerId, response]) => {
          if (!sources[providerId]) {
            const typedResponse = response as ProviderResponse;
            sources[providerId] = {
              providerId,
              text: typedResponse.text || "",
              status: "completed" as const,
              createdAt: typedResponse.createdAt || Date.now(),
              updatedAt: typedResponse.updatedAt || Date.now(),
            } as ProviderResponse;
          }
        }
      );
    }
    return sources;
  }, [aiTurn.batchResponses, aiTurn.hiddenBatchOutputs]);

  const hasSources = Object.keys(allSources).length > 0;
  const providerIds = useMemo(
    () => LLM_PROVIDERS_CONFIG.map((p) => String(p.id)),
    []
  );

  const computeActiveProvider = useCallback(
    (explicit: string | undefined, map: Record<string, ProviderResponse[]>) => {
      if (explicit) return explicit;
      for (const pid of providerIds) {
        const arr = map[pid];
        if (arr && arr.length > 0) return pid;
      }
      return undefined;
    },
    [providerIds]
  );

  const activeSynthPid = computeActiveProvider(
    activeSynthesisClipProviderId,
    synthesisResponses
  );
  const activeMappingPid = computeActiveProvider(
    activeMappingClipProviderId,
    mappingResponses
  );

  const isSynthesisTarget = !!(
    activeRecomputeState &&
    activeRecomputeState.aiTurnId === aiTurn.id &&
    activeRecomputeState.stepType === "synthesis" &&
    (!activeSynthPid || activeRecomputeState.providerId === activeSynthPid)
  );
  const isMappingTarget = !!(
    activeRecomputeState &&
    activeRecomputeState.aiTurnId === aiTurn.id &&
    activeRecomputeState.stepType === "mapping" &&
    (!activeMappingPid || activeRecomputeState.providerId === activeMappingPid)
  );

  const getMappingAndOptions = useCallback(
    (take: ProviderResponse | undefined) => {
      if (!take?.text) return { mapping: "", options: null };
      return parseMappingResponse(String(take.text));
    },
    []
  );

  const getOptions = useCallback((): string | null => {
    if (!activeMappingPid) return null;
    const take = getLatestResponse(mappingResponses[activeMappingPid]);
    const { options } = getMappingAndOptions(take);
    return options;
  }, [activeMappingPid, mappingResponses, getMappingAndOptions]);

  const displayedMappingTake = useMemo(() => {
    if (!activeMappingPid) return undefined;
    return getLatestResponse(mappingResponses[activeMappingPid]);
  }, [activeMappingPid, mappingResponses]);

  const displayedMappingText = useMemo(() => {
    if (!displayedMappingTake?.text) return "";
    return String(getMappingAndOptions(displayedMappingTake).mapping ?? "");
  }, [displayedMappingTake, getMappingAndOptions]);

  const optionsText = useMemo(() => String(getOptions() || ""), [getOptions]);

  const hasMapping = !!(activeMappingPid && displayedMappingTake?.text);
  const hasSynthesis = !!(
    activeSynthPid &&
    getLatestResponse(synthesisResponses[activeSynthPid])?.text
  );

  const requestedSynth = (aiTurn.meta as any)?.requestedFeatures?.synthesis;
  const requestedMap = (aiTurn.meta as any)?.requestedFeatures?.mapping;
  const wasSynthRequested =
    requestedSynth === undefined ? true : !!requestedSynth;
  const wasMapRequested = requestedMap === undefined ? true : !!requestedMap;

  // Create refs for sections
  const synthRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // No cross-panel truncation in single viewport mode
  const synthTruncated = false;
  const mapTruncated = false;

  // --- 1. DEFINITION: Citation Click Logic (First) ---
  const handleCitationClick = useCallback(
    (modelNumber: number) => {
      try {
        if (!showSourceOutputs) onToggleSourceOutputs?.();

        const take = activeMappingPid
          ? getLatestResponse(mappingResponses[activeMappingPid])
          : undefined;
        const metaOrder = (take as any)?.meta?.citationSourceOrder || null;
        let providerId: string | undefined;
        if (metaOrder && typeof metaOrder === "object") {
          providerId = metaOrder[modelNumber];
        }
        if (!providerId) {
          const activeOrdered = LLM_PROVIDERS_CONFIG.map((p) =>
            String(p.id)
          ).filter((pid) => !!(aiTurn.batchResponses || {})[pid]);
          providerId = activeOrdered[modelNumber - 1];
        }
        if (!providerId) return;

        setTimeout(() => {
          const evt = new CustomEvent("htos:scrollToProvider", {
            detail: { aiTurnId: aiTurn.id, providerId },
            bubbles: true,
          });
          document.dispatchEvent(evt);
        }, 200);
      } catch (e) {
        console.warn("[AiTurnBlock] Citation click failed", e);
      }
    },
    [
      activeMappingPid,
      mappingResponses,
      showSourceOutputs,
      onToggleSourceOutputs,
      aiTurn.id,
      aiTurn.batchResponses,
    ]
  );

  // --- 2. DEFINITION: Custom Markdown Components (Depends on 1) ---
  const markdownComponents = useMemo(
    () => ({
      a: ({ href, children, ...props }: any) => {
        // Check for our specific hash pattern
        if (href && href.startsWith("#cite-")) {
          const idStr = href.replace("#cite-", "");
          const num = parseInt(idStr, 10);

          return (
            <button
              type="button"
              className="inline-flex items-center gap-1 px-1.5 mx-0.5 bg-chip-active border border-border-brand rounded-pill text-text-primary text-xs font-bold leading-snug cursor-pointer no-underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCitationClick(num);
              }}
              title={`View Source ${idStr}`}
            >
              {children}
            </button>
          );
        }

        // Normal links behave normally
        return (
          <a href={href} {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
    }),
    [handleCitationClick]
  );

  // --- 3. DEFINITION: Transformation Logic (Uses Hash Strategy) ---
  const transformCitations = useCallback((text: string) => {
    if (!text) return "";
    let t = text;

    // A. [[CITE:N]] -> [↗N](#cite-N)
    t = t.replace(/\[\[CITE:(\d+)\]\]/g, "[↗$1](#cite-$1)");

    // B. [1], [1, 2] -> [↗1](#cite-1) [↗2](#cite-2)
    // FIX: Added closing parenthesis to lookahead: (?!\()
    t = t.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (_m, grp) => {
      const nums = String(grp)
        .split(/\s*,\s*/)
        .map((n) => n.trim())
        .filter(Boolean);
      return " " + nums.map((n) => `[↗${n}](#cite-${n})`).join(" ") + " ";
    });

    return t;
  }, []);

  const userPrompt: string | null =
    (aiTurn as any)?.userPrompt ??
    (aiTurn as any)?.prompt ??
    (aiTurn as any)?.input ??
    null;

  return (
    <div className="turn-block pb-4 border-b border-border-subtle">
      {userPrompt && (
        <div className="user-prompt-block mb-2">
          <div className="text-xs text-text-muted mb-1.5">
            User
          </div>
          {/* Prose wrapper for consistent line width */}
          <div className="mx-auto max-w-prose">
            <div className="bg-surface border border-border-subtle rounded-lg p-3 text-text-secondary">
              {userPrompt}
            </div>
          </div>
        </div>
      )}

      <div className="ai-turn-block">
        <div className="ai-turn-content flex flex-col gap-3">
          <div className="primaries mb-4 relative">
            {/* Primary Toggle */}
            {/* Primary Toggle */}
            <div className="primary-toggle mb-3">
              <button
                type="button"
                onClick={() => onSetPrimaryView?.(primaryView === "synthesis" ? "decision-map" : "synthesis")}
                className="group flex items-center gap-2 px-3 py-1.5 bg-input hover:bg-surface-raised border border-border-subtle rounded-full text-sm font-medium text-text-secondary hover:text-text-primary transition-all shadow-sm hover:shadow-md"
                title={primaryView === "synthesis" ? "Switch to Decision Map" : "Switch to Synthesis"}
                aria-label={primaryView === "synthesis" ? "Switch to Decision Map" : "Switch to Synthesis"}
              >
                {/* Status LED - Only show if NOT idle */}
                {mapStatus !== "idle" && (
                  <span
                    className={`inline-block w-2 h-2 rounded-full transition-colors ${mapStatus === "streaming"
                      ? "bg-intent-warning animate-pulse shadow-[0_0_4px_rgba(255,170,0,0.4)]"
                      : mapStatus === "ready"
                        ? "bg-intent-success shadow-[0_0_4px_rgba(0,255,170,0.3)]"
                        : mapStatus === "error"
                          ? "bg-intent-danger"
                          : ""
                      }`}
                  />
                )}

                <span>
                  {primaryView === "synthesis" ? "Synthesis" : "Decision Map"}
                </span>

                {/* Swap Icon - Only show if NOT idle */}
                {mapStatus !== "idle" && (
                  <span className="text-text-muted group-hover:text-text-secondary transition-colors text-xs">
                    🔄
                  </span>
                )}
              </button>
            </div>

            {/* Single Content Viewport */}
            <div className="content-viewport">
              {/* Synthesis Section */}
              <div
                ref={synthRef}
                className={`${primaryView === "synthesis" ? "flex" : "hidden"} flex-1 min-w-0 flex-col min-h-[150px] relative
                           rounded-3xl p-4 gap-3`}
                style={synthExpanded ? {} : {}}
              >
                <div className="section-header flex items-center justify-between flex-shrink-0">
                  <h4 className="m-0 text-sm font-semibold text-text-secondary">
                    Unified Synthesis
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      onToggleSynthesisExpanded && onToggleSynthesisExpanded()
                    }
                    className="bg-transparent border-none text-text-muted cursor-pointer p-1"
                  >
                    {isSynthesisExpanded ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {isSynthesisExpanded && (
                  <div className="flex-1 flex flex-col min-h-0" style={{ overflow: synthTruncated && !synthExpanded ? "hidden" : "visible" }}>
                    <div className="flex-shrink-0">
                      {/* Provider Selector - Moved to body for alignment */}
                      <div className="mx-auto max-w-prose mb-4 px-1">
                        <ProviderSelector
                          providers={LLM_PROVIDERS_CONFIG}
                          responsesMap={synthesisResponses}
                          activeProviderId={activeSynthPid}
                          onSelect={(pid) => onClipClick?.("synthesis", pid)}
                          type="synthesis"
                        />
                      </div>
                    </div>

                    <div
                      className="clip-content rounded-2xl p-3 flex-1 min-w-0 break-words"
                      style={{
                        overflowY: isLive || isLoading ? "auto" : "visible",
                        maxHeight: isLive || isLoading ? "40vh" : "none",
                        minHeight: 0,
                      }}
                      // Scroll Props Only - Navigation handled by annotated buttons
                      onWheelCapture={(e: React.WheelEvent<HTMLDivElement>) => {
                        const el = e.currentTarget;
                        const dy = e.deltaY ?? 0;
                        const canDown =
                          el.scrollTop + el.clientHeight < el.scrollHeight;
                        const canUp = el.scrollTop > 0;
                        if ((dy > 0 && canDown) || (dy < 0 && canUp)) {
                          e.stopPropagation();
                        }
                      }}
                      onWheel={(e: React.WheelEvent<HTMLDivElement>) => {
                        const el = e.currentTarget;
                        const dy = e.deltaY ?? 0;
                        const canDown =
                          el.scrollTop + el.clientHeight < el.scrollHeight;
                        const canUp = el.scrollTop > 0;
                        if ((dy > 0 && canDown) || (dy < 0 && canUp)) {
                          e.stopPropagation();
                        }
                      }}
                      onTouchStartCapture={(
                        e: React.TouchEvent<HTMLDivElement>
                      ) => {
                        e.stopPropagation();
                      }}
                      onTouchMove={(e: React.TouchEvent<HTMLDivElement>) => {
                        const el = e.currentTarget;
                        const canDown =
                          el.scrollTop + el.clientHeight < el.scrollHeight;
                        const canUp = el.scrollTop > 0;
                        if (canDown || canUp) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {(() => {
                        if (!wasSynthRequested)
                          return (
                            <div className="text-text-muted/70 italic text-center">
                              Synthesis not enabled for this turn.
                            </div>
                          );
                        const latest = activeSynthPid
                          ? getLatestResponse(
                            synthesisResponses[activeSynthPid]
                          )
                          : undefined;
                        const isGenerating =
                          (latest &&
                            (latest.status === "streaming" ||
                              latest.status === "pending")) ||
                          isSynthesisTarget;
                        if (isGenerating)
                          return (
                            <div className="flex items-center justify-center gap-2 text-text-muted">
                              <span className="italic">
                                Synthesis generating
                              </span>
                              <span className="streaming-dots" />
                            </div>
                          );
                        if (activeSynthPid) {
                          const take = getLatestResponse(
                            synthesisResponses[activeSynthPid]
                          );
                          if (take && take.status === "error") {
                            return (
                              <div className="bg-intent-danger/15 border border-intent-danger text-intent-danger rounded-lg p-3">
                                <div className="text-xs mb-2">
                                  {activeSynthPid} · error
                                </div>
                                <div className="prose prose-sm max-w-none dark:prose-invert leading-7 text-sm">
                                  <MarkdownDisplay
                                    content={String(
                                      take.text || "Synthesis failed"
                                    )}
                                  />
                                </div>
                              </div>
                            );
                          }
                          if (!take)
                            return (
                              <div className="text-text-muted">
                                No synthesis yet.
                              </div>
                            );
                          return (
                            <div>
                              {(() => {
                                // Extract Claude artifacts
                                const { cleanText, artifacts } = extractClaudeArtifacts(take.text);


                                return (
                                  <>
                                    {/* Main content - Prose wrapper constrains narrative text */}
                                    <div className="mx-auto max-w-prose">
                                      {/* Header Row: Model Info & Copy Button */}
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="text-xs text-text-muted">
                                          {activeSynthPid} · {take.status}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              await navigator.clipboard.writeText(
                                                String(take.text || "")
                                              );
                                              setToast({ id: Date.now(), message: 'Copied to clipboard', type: 'info' });
                                            } catch (err) {
                                              console.error("Failed to copy:", err);
                                              setToast({ id: Date.now(), message: 'Failed to copy', type: 'error' });
                                            }
                                          }}
                                          className="bg-surface-raised border border-border-subtle rounded-md
                                                           px-2 py-1 text-text-muted text-xs cursor-pointer
                                                           hover:bg-surface-highlight transition-all flex items-center gap-1"
                                        >
                                          📋 Copy
                                        </button>
                                      </div>
                                      <div className="text-[16px] leading-relaxed text-text-primary">
                                        <MarkdownDisplay content={String(cleanText || take.text || "")} />
                                      </div>
                                    </div>

                                    {/* Artifact badges */}
                                    {artifacts.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {artifacts.map((artifact, idx) => (
                                          <button
                                            key={idx}
                                            onClick={() => setSelectedArtifact(artifact)}
                                            className="bg-gradient-to-br from-brand-500 to-brand-600 border border-brand-400 rounded-lg px-3 py-2 text-text-primary text-sm font-medium cursor-pointer flex items-center gap-1.5 hover:-translate-y-px hover:shadow-glow-brand-soft transition-all"
                                          >
                                            📄 {artifact.title}
                                          </button>
                                        ))}
                                      </div>
                                    )}

                                    {/* Artifact Overlay Modal */}
                                    {selectedArtifact && (
                                      <div className="fixed inset-0 bg-overlay-backdrop z-[9999] flex items-center justify-center p-5" onClick={() => setSelectedArtifact(null)}>
                                        <div className="bg-surface-raised border border-border-strong rounded-2xl max-w-[900px] w-full max-h-[90vh] flex flex-col shadow-elevated" onClick={(e) => e.stopPropagation()}>
                                          {/* Header */}
                                          <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                                            <div>
                                              <h3 className="m-0 text-lg text-text-primary font-semibold">
                                                📄 {selectedArtifact.title}
                                              </h3>
                                              <div className="text-xs text-text-muted mt-1">
                                                {selectedArtifact.identifier}
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setSelectedArtifact(null)}
                                              className="bg-transparent border-none text-text-muted text-2xl cursor-pointer px-2 py-1"
                                            >
                                              ×
                                            </button>
                                          </div>

                                          {/* Content */}
                                          <div className="flex-1 overflow-y-auto p-5 bg-surface">
                                            <MarkdownDisplay content={selectedArtifact.content} />
                                          </div>

                                          {/* Footer Actions */}
                                          <div className="flex gap-3 p-4 border-t border-border-subtle justify-end">
                                            <button
                                              onClick={async () => {
                                                try {
                                                  await navigator.clipboard.writeText(selectedArtifact.content);
                                                  setToast({ id: Date.now(), message: 'Copied artifact', type: 'info' });
                                                } catch (err) {
                                                  console.error("Failed to copy artifact:", err);
                                                  setToast({ id: Date.now(), message: 'Failed to copy', type: 'error' });
                                                }
                                              }}
                                              className="bg-surface-raised border border-border-subtle rounded-md px-4 py-2 text-text-secondary text-sm cursor-pointer flex items-center gap-1.5 hover:bg-surface-highlight transition-all"
                                            >
                                              📋 Copy
                                            </button>
                                            <button
                                              onClick={() => {
                                                const blob = new Blob([selectedArtifact.content], { type: "text/plain;charset=utf-8" });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement("a");
                                                a.href = url;
                                                a.download = `${selectedArtifact.identifier}.md`;
                                                document.body.appendChild(a);
                                                a.click();
                                                setTimeout(() => {
                                                  URL.revokeObjectURL(url);
                                                  try { document.body.removeChild(a); } catch { }
                                                }, 0);
                                              }}
                                              className="bg-brand-500 border border-brand-400 rounded-md px-4 py-2 text-text-primary text-sm cursor-pointer flex items-center gap-1.5 hover:bg-brand-600 transition-all"
                                            >
                                              ⬇️ Download
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          );
                        }
                        return (
                          <div className="flex items-center justify-center h-full text-text-muted italic">
                            Choose a model.
                          </div>
                        );
                      })()}
                    </div>
                    {synthTruncated && !synthExpanded && (
                      <>
                        <div
                          className="absolute bottom-0 left-0 right-0 h-16
                                     bg-gradient-to-t from-surface to-transparent
                                     pointer-events-none rounded-b-3xl"
                        />
                        <button
                          type="button"
                          onClick={() => setSynthExpanded(true)}
                          className="absolute bottom-3 left-1/2 -translate-x-1/2
                                     bg-surface-raised border border-border-subtle
                                     rounded-md px-3 py-1.5 text-text-secondary text-xs
                                     cursor-pointer hover:bg-surface-highlight
                                     transition-all flex items-center gap-1.5 z-10"
                        >
                          Show full response
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {synthExpanded && synthTruncated && (
                      <button
                        type="button"
                        onClick={() => setSynthExpanded(false)}
                        className="mt-3 px-3 py-1.5 bg-surface-raised border border-border-subtle
                                   rounded-md text-text-muted text-xs cursor-pointer
                                   flex items-center gap-1.5 hover:bg-surface-highlight
                                   transition-all self-center"
                      >
                        <ChevronUpIcon className="w-3.5 h-3.5" /> Collapse
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Mapping Section */}
              <div
                ref={mapRef}
                className={`${primaryView === "decision-map" ? "flex" : "hidden"} flex-1 min-w-0 flex-col min-h-[150px] relative
                           rounded-3xl p-4 gap-3`}
                style={mapExpanded ? {} : {}}
              >
                <div className="section-header flex items-center justify-between flex-shrink-0 min-h-[32px]">
                  <h4 className="m-0 text-sm font-semibold text-text-secondary">
                    Decision Map
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-surface-raised p-1 rounded-lg border border-border-subtle">
                    <button
                      onClick={() => onSetMappingTab && onSetMappingTab("map")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mappingTab === "map"
                        ? "bg-chip-active text-text-primary shadow-card-sm"
                        : "text-text-muted hover:text-text-secondary"
                        }`}
                    >
                      Decision Map
                    </button>
                    <button
                      onClick={() => onSetMappingTab && onSetMappingTab("options")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mappingTab === "options"
                        ? "bg-chip-active text-text-primary shadow-card-sm"
                        : "text-text-muted hover:text-text-secondary"
                        }`}
                    >
                      All Options
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      // Copy All Logic
                      try {
                        const ORDER = [
                          "gemini-exp",
                          "claude",
                          "gemini-pro",
                          "qwen",
                          "chatgpt",
                          "gemini",
                        ];
                        const nameMap = new Map(
                          LLM_PROVIDERS_CONFIG.map((p) => [
                            String(p.id),
                            p.name,
                          ])
                        );
                        const lines: string[] = [];

                        // Synthesis
                        ORDER.forEach((pid) => {
                          const take = getLatestResponse(
                            synthesisResponses[pid] || []
                          );
                          const text = take?.text ? String(take.text) : "";
                          if (text && text.trim().length > 0) {
                            lines.push(
                              `=== Synthesis • ${nameMap.get(pid) || pid} ===`
                            );
                            lines.push(text.trim());
                            lines.push("\n---\n");
                          }
                        });

                        // Mapping
                        ORDER.forEach((pid) => {
                          const take = getLatestResponse(
                            mappingResponses[pid] || []
                          );
                          const text = take?.text ? String(take.text) : "";
                          if (text && text.trim().length > 0) {
                            lines.push(
                              `=== Mapping • ${nameMap.get(pid) || pid} ===`
                            );
                            lines.push(text.trim());
                            lines.push("\n---\n");
                          }
                        });

                        // Sources
                        ORDER.forEach((pid) => {
                          const source = allSources[pid];
                          const text = source?.text
                            ? String(source.text)
                            : "";
                          if (text && text.trim().length > 0) {
                            lines.push(`=== ${nameMap.get(pid) || pid} ===`);
                            lines.push(text);
                            lines.push("");
                            lines.push("---");
                            lines.push("");
                          }
                        });

                        const payload = lines.join("\n");
                        await navigator.clipboard.writeText(payload);
                      } catch (err) {
                        console.error("Copy All failed", err);
                      }
                    }}
                    className="bg-surface-raised border border-border-subtle rounded-md
                                 px-2 py-1 text-text-muted text-xs cursor-pointer
                                 hover:bg-surface-highlight transition-all flex items-center gap-1"
                    title="Copy All"
                  >
                    📦 Copy All
                  </button>

                  <div className="w-px h-4 bg-border-subtle" />

                  <button
                    type="button"
                    onClick={() =>
                      onToggleMappingExpanded && onToggleMappingExpanded()
                    }
                    className="bg-transparent border-none text-text-muted cursor-pointer p-1
                                 hover:bg-surface-highlight rounded transition-colors"
                  >
                    {isMappingExpanded ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {isMappingExpanded && (
                <div
                  className="flex-1 flex flex-col min-h-0"
                  style={{ overflow: mapTruncated && !mapExpanded ? "hidden" : "visible" }}
                >
                  {/* Provider Selector - Moved to body for alignment */}
                  <div className="mx-auto max-w-prose mb-4 px-1">
                    <ProviderSelector
                      providers={LLM_PROVIDERS_CONFIG}
                      responsesMap={mappingResponses}
                      activeProviderId={activeMappingPid}
                      onSelect={(pid) => onClipClick?.("mapping", pid)}
                      type="mapping"
                    />
                  </div>

                  <div
                    className="clip-content rounded-2xl p-3 flex-1 min-w-0 break-words"
                    style={{
                      overflowY: isLive || isLoading ? "auto" : "visible",
                      maxHeight: isLive || isLoading ? "40vh" : "none",
                      minHeight: 0,
                    }}
                    // Scroll Props Only
                    onWheelCapture={(e: React.WheelEvent<HTMLDivElement>) => {
                      const el = e.currentTarget;
                      const dy = e.deltaY ?? 0;
                      const canDown =
                        el.scrollTop + el.clientHeight < el.scrollHeight;
                      const canUp = el.scrollTop > 0;
                      if ((dy > 0 && canDown) || (dy < 0 && canUp)) {
                        e.stopPropagation();
                      }
                    }}
                    onWheel={(e: React.WheelEvent<HTMLDivElement>) => {
                      const el = e.currentTarget;
                      const dy = e.deltaY ?? 0;
                      const canDown =
                        el.scrollTop + el.clientHeight < el.scrollHeight;
                      const canUp = el.scrollTop > 0;
                      if ((dy > 0 && canDown) || (dy < 0 && canUp)) {
                        e.stopPropagation();
                      }
                    }}
                    onTouchStartCapture={(
                      e: React.TouchEvent<HTMLDivElement>
                    ) => {
                      e.stopPropagation();
                    }}
                    onTouchMove={(e: React.TouchEvent<HTMLDivElement>) => {
                      const el = e.currentTarget;
                      const canDown =
                        el.scrollTop + el.clientHeight < el.scrollHeight;
                      const canUp = el.scrollTop > 0;
                      if (canDown || canUp) {
                        e.stopPropagation();
                      }
                    }}
                  >
                    {(() => {
                      const options = getOptions();
                      const optionsInner = (() => {
                        if (!options)
                          return (
                            <div className="text-text-muted">
                              {!activeMappingPid
                                ? "Select a mapping provider."
                                : "No options found."}
                            </div>
                          );
                        return (
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="text-xs text-text-muted">
                                All Available Options • via {activeMappingPid}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(options);
                                }}
                                className="bg-surface-raised border border-border-subtle rounded-md
                                               px-2 py-1 text-text-muted text-xs cursor-pointer
                                               hover:bg-surface-highlight transition-all flex items-center gap-1"
                              >
                                📋 Copy
                              </button>
                            </div>
                            {/* Prose wrapper constrains narrative text */}
                            <div className="mx-auto max-w-prose">
                              <div
                                className="text-[16px] leading-relaxed text-text-primary"
                              >
                                <MarkdownDisplay
                                  content={transformCitations(options)}
                                  components={markdownComponents}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })();

                      const mapInner = (() => {
                        if (!wasMapRequested)
                          return (
                            <div className="text-text-muted italic text-center">
                              Mapping not enabled.
                            </div>
                          );
                        const latest = displayedMappingTake;
                        const isGenerating =
                          (latest &&
                            (latest.status === "streaming" ||
                              latest.status === "pending")) ||
                          isMappingTarget;
                        if (isGenerating)
                          return (
                            <div className="flex items-center justify-center gap-2 text-text-muted">
                              <span className="italic">
                                Conflict map generating
                              </span>
                              <span className="streaming-dots" />
                            </div>
                          );
                        if (activeMappingPid) {
                          const take = displayedMappingTake;
                          if (take && take.status === "error") {
                            return (
                              <div className="bg-intent-danger/15 border border-intent-danger text-intent-danger rounded-lg p-3">
                                <div className="text-xs mb-2">
                                  {activeMappingPid} · error
                                </div>
                                <div className="text-sm leading-relaxed text-text-primary">
                                  <MarkdownDisplay
                                    content={String(
                                      take.text || "Mapping failed"
                                    )}
                                  />
                                </div>
                              </div>
                            );
                          }
                          if (!take)
                            return (
                              <div className="text-text-muted">
                                No mapping yet.
                              </div>
                            );
                          return (
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="text-xs text-text-muted">
                                  {activeMappingPid} · {take.status}
                                </div>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await navigator.clipboard.writeText(
                                      displayedMappingText
                                    );
                                  }}
                                  className="bg-surface-raised border border-border-subtle rounded-md
                                               px-2 py-1 text-text-muted text-xs cursor-pointer
                                               hover:bg-surface-highlight transition-all flex items-center gap-1"
                                >
                                  📋 Copy
                                </button>
                              </div>
                              {(() => {
                                // Extract Claude artifacts from mapping text
                                const { cleanText, artifacts } = extractClaudeArtifacts(displayedMappingText);

                                return (
                                  <>
                                    {/* Main mapping - Prose wrapper constrains narrative text */}
                                    <div className="mx-auto max-w-prose">
                                      <div
                                        className="text-[16px] leading-relaxed text-text-primary"
                                      >
                                        <MarkdownDisplay
                                          content={transformCitations(cleanText || displayedMappingText)}
                                          components={markdownComponents}
                                        />
                                      </div>
                                    </div>

                                    {/* Artifact badges */}
                                    {artifacts.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {artifacts.map((artifact, idx) => (
                                          <button
                                            key={idx}
                                            onClick={() => setSelectedArtifact(artifact)}
                                            className="bg-gradient-to-br from-brand-500 to-brand-600 border border-brand-400 rounded-lg px-3 py-2 text-text-primary text-sm font-medium cursor-pointer flex items-center gap-1.5 hover:-translate-y-px hover:shadow-glow-brand-soft transition-all"
                                          >
                                            📄 {artifact.title}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          );
                        }
                        return (
                          <div className="flex items-center justify-center h-full text-text-muted italic">
                            Choose a model.
                          </div>
                        );
                      })();

                      return (
                        <>
                          <div
                            style={{
                              display:
                                mappingTab === "options" ? "block" : "none",
                            }}
                          >
                            {optionsInner}
                          </div>
                          <div
                            style={{
                              display:
                                mappingTab === "map" ? "block" : "none",
                            }}
                          >
                            {mapInner}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {mapTruncated && !mapExpanded && (
                    <>
                      <div
                        className="absolute bottom-0 left-0 right-0 h-16
                                     bg-gradient-to-t from-surface to-transparent
                                     pointer-events-none rounded-b-3xl"
                      />
                      <button
                        type="button"
                        onClick={() => setMapExpanded(true)}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2
                                     bg-surface-raised border border-border-subtle
                                     rounded-md px-3 py-1.5 text-text-secondary text-xs
                                     cursor-pointer hover:bg-surface-highlight
                                     transition-all flex items-center gap-1.5 z-10"
                      >
                        Show full response
                        <ChevronDownIcon className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {mapExpanded && mapTruncated && (
                    <button
                      type="button"
                      onClick={() => setMapExpanded(false)}
                      className="mt-3 px-3 py-1.5 bg-surface-raised border border-border-subtle
                                   rounded-md text-text-muted text-xs cursor-pointer
                                   flex items-center gap-1.5 hover:bg-surface-highlight
                                   transition-all self-center"
                    >
                      <ChevronUpIcon className="w-3.5 h-3.5" /> Collapse
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sources Section */}
        {hasSources && (
          <div className="batch-filler mt-3 bg-surface-raised border border-border-subtle rounded-2xl p-3">
            <div className="sources-wrapper">
              <div className="sources-toggle text-center mb-2">
                <button
                  type="button"
                  onClick={() => onToggleSourceOutputs?.()}
                  className="px-3 py-1.5 rounded-lg border border-border-subtle
                                 bg-surface text-text-primary cursor-pointer
                                 hover:bg-surface-highlight transition-all text-sm"
                >
                  {showSourceOutputs ? "Hide Sources" : "Show Sources"}
                </button>
              </div>
              {showSourceOutputs && (
                <div className="sources-content">
                  {children}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  </div >
  );
};

export default React.memo(AiTurnBlock);
