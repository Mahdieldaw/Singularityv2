// ui/components/AiTurnBlock.tsx - FIXED ALIGNMENT
import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
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

// --- Height Measurement Hook (Stabilized) ---
const useShorterHeight = (
  hasSynthesis: boolean,
  hasMapping: boolean,
  contentVersion: string | number, // something that changes when either side's text changes
  pause: boolean
) => {
  const synthRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{
    shorterHeight: number | null;
    shorterSection: "synthesis" | "mapping" | null;
  }>({ shorterHeight: null, shorterSection: null });

  useLayoutEffect(() => {
    if (pause) return;

    const s = synthRef.current;
    const m = mapRef.current;

    if (!hasSynthesis || !hasMapping || !s || !m) {
      setState((prev) =>
        prev.shorterHeight === null && prev.shorterSection === null
          ? prev
          : { shorterHeight: null, shorterSection: null }
      );
      return;
    }

    const synthH = s.scrollHeight;
    const mapH = m.scrollHeight;
    const isSynthShorter = synthH <= mapH;
    const nextHeight = isSynthShorter ? synthH : mapH;
    const nextSection = isSynthShorter ? "synthesis" : "mapping";

    setState((prev) => {
      if (
        prev.shorterHeight === nextHeight &&
        prev.shorterSection === nextSection
      ) {
        return prev; // no change, no re-render
      }
      return { shorterHeight: nextHeight, shorterSection: nextSection };
    });
  }, [contentVersion, hasSynthesis, hasMapping, pause]);

  return {
    synthRef,
    mapRef,
    shorterHeight: state.shorterHeight,
    shorterSection: state.shorterSection,
  };
};

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
  children?: React.ReactNode;
}

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
  children,
}) => {
  const setSynthExpanded = onSetSynthExpanded || (() => { });
  const setMapExpanded = onSetMapExpanded || (() => { });

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
  }, [aiTurn.id, JSON.stringify(aiTurn.synthesisResponses)]);

  const mappingResponses = useMemo(() => {
    const map = aiTurn.mappingResponses || {};
    const out: Record<string, ProviderResponse[]> = {};
    LLM_PROVIDERS_CONFIG.forEach((p) => (out[String(p.id)] = []));
    Object.entries(map).forEach(([pid, resp]) => {
      out[pid] = normalizeResponseArray(resp);
    });
    return out;
  }, [aiTurn.id, JSON.stringify(aiTurn.mappingResponses)]);

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

  // --- REFS COME FROM HERE ---
  const contentVersion =
    (getLatestResponse(synthesisResponses[activeSynthPid || ""] || [])?.text || "").length +
    ":" +
    (mappingTab === "options" ? optionsText.length : displayedMappingText.length);

  const { synthRef, mapRef, shorterHeight, shorterSection } = useShorterHeight(
    hasSynthesis,
    hasMapping,
    contentVersion,
    isLive || isLoading
  );

  const synthTruncated =
    hasSynthesis && hasMapping && shorterHeight && shorterSection === "mapping";
  const mapTruncated =
    hasSynthesis &&
    hasMapping &&
    shorterHeight &&
    shorterSection === "synthesis";

  const getSectionStyle = (
    section: "synthesis" | "mapping",
    isExpanded: boolean
  ): React.CSSProperties => {
    const isTruncated = section === "synthesis" ? synthTruncated : mapTruncated;
    const duringStreaming = isLive || isLoading;
    return {
      border: "1px solid #475569",
      borderRadius: 8,
      padding: 12,
      flex: "1 1 0%",
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      minHeight: 150,
      height: "auto",
      boxSizing: "border-box",
      maxHeight: isTruncated && !isExpanded ? `${shorterHeight}px` : "none",
      overflow: duringStreaming ? "hidden" : "visible",
      position: "relative",
    };
  };

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
          <div className="bg-surface border border-border-subtle rounded-lg p-2 text-text-secondary">
            {userPrompt}
          </div>
        </div>
      )}

      <div className="ai-turn-block border border-border-subtle rounded-2xl p-3">
        <div className="ai-turn-content flex flex-col gap-3">
          <div
            className="primaries"
            style={{ marginBottom: "1rem", position: "relative" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              {/* Synthesis Section */}
              <div
                ref={synthRef}
                className="synthesis-section"
                style={getSectionStyle("synthesis", synthExpanded)}
              >
                <div className="section-header flex items-center justify-between mb-2 flex-shrink-0">
                  <h4 className="m-0 text-sm text-text-secondary">
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
                      <ClipsCarousel
                        providers={LLM_PROVIDERS_CONFIG}
                        responsesMap={synthesisResponses}
                        activeProviderId={activeSynthPid}
                        onClipClick={(pid) => onClipClick?.("synthesis", pid)}
                        type="synthesis"
                      />
                    </div>

                    <div
                      className="clip-content mt-3 bg-surface border border-border-subtle rounded-lg p-3 pb-4.5 flex-1 min-w-0 break-words"
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
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                color: "#94a3b8",
                              }}
                            >
                              <span style={{ fontStyle: "italic" }}>
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
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                  {activeSynthPid} · {take.status}
                                </div>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await navigator.clipboard.writeText(
                                      String(take.text || "")
                                    );
                                  }}
                                  className="bg-surface-raised border border-border-subtle rounded-md px-2 py-1 text-text-muted text-xs cursor-pointer hover:bg-surface-highlight transition-all"
                                >
                                  📋 Copy
                                </button>
                              </div>
                              {(() => {
                                // Extract Claude artifacts
                                const { cleanText, artifacts } = extractClaudeArtifacts(take.text);

                                return (
                                  <>
                                    {/* Main content */}
                                    <div className="prose prose-sm max-w-none dark:prose-invert leading-7 text-base">
                                      <MarkdownDisplay content={String(cleanText || take.text || "")} />
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
                                                await navigator.clipboard.writeText(selectedArtifact.content);
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
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 60,
                            background: "linear-gradient(transparent, #1e293b)",
                            pointerEvents: "none",
                            borderRadius: "0 0 8px 8px",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setSynthExpanded(true)}
                          style={{
                            position: "absolute",
                            bottom: 12,
                            left: "50%",
                            transform: "translateX(-50%)",
                            padding: "6px 12px",
                            background: "#334155",
                            border: "1px solid #475569",
                            borderRadius: 6,
                            color: "#e2e8f0",
                            cursor: "pointer",
                            fontSize: 12,
                            zIndex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Show full response{" "}
                          <ChevronDownIcon style={{ width: 14, height: 14 }} />
                        </button>
                      </>
                    )}
                    {synthExpanded && synthTruncated && (
                      <button
                        type="button"
                        onClick={() => setSynthExpanded(false)}
                        style={{
                          marginTop: 12,
                          padding: "6px 12px",
                          background: "#334155",
                          border: "1px solid #475569",
                          borderRadius: 6,
                          color: "#94a3b8",
                          cursor: "pointer",
                          fontSize: 12,
                          alignSelf: "center",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <ChevronUpIcon style={{ width: 14, height: 14 }} />{" "}
                        Collapse
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Mapping Section */}
              <div
                ref={mapRef}
                className="mapping-section"
                style={getSectionStyle("mapping", mapExpanded)}
              >
                <div
                  className="section-header"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    flexShrink: 0,
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: 14, color: "#e2e8f0" }}>
                    Decision Map
                  </h4>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
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
                      title="Copy All"
                      style={{
                        padding: "4px 8px",
                        background: "#334155",
                        border: "1px solid #475569",
                        borderRadius: 6,
                        color: "#94a3b8",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      📦 Copy All
                    </button>
                    <div
                      style={{
                        width: 1,
                        height: 16,
                        background: "#475569",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onToggleMappingExpanded && onToggleMappingExpanded()
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      {isMappingExpanded ? (
                        <ChevronUpIcon style={{ width: 16, height: 16 }} />
                      ) : (
                        <ChevronDownIcon style={{ width: 16, height: 16 }} />
                      )}
                    </button>
                  </div>
                </div>

                {isMappingExpanded && (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      overflow:
                        mapTruncated && !mapExpanded ? "hidden" : "visible",
                      minHeight: 0,
                    }}
                  >
                    <ClipsCarousel
                      providers={LLM_PROVIDERS_CONFIG}
                      responsesMap={mappingResponses}
                      activeProviderId={activeMappingPid}
                      onClipClick={(pid) => onClipClick?.("mapping", pid)}
                      type="mapping"
                    />

                    {/* PILL TABS */}
                    <div
                      style={{
                        display: "flex",
                        background: "#1e293b",
                        padding: 3,
                        borderRadius: 8,
                        marginTop: 8,
                        alignSelf: "flex-start",
                        border: "1px solid #334155",
                      }}
                    >
                      <button
                        onClick={() =>
                          onSetMappingTab && onSetMappingTab("map")
                        }
                        style={{
                          padding: "4px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          background:
                            mappingTab === "map" ? "#475569" : "transparent",
                          color: mappingTab === "map" ? "#f8fafc" : "#94a3b8",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        Decision Map
                      </button>
                      <button
                        onClick={() =>
                          onSetMappingTab && onSetMappingTab("options")
                        }
                        style={{
                          padding: "4px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          background:
                            mappingTab === "options"
                              ? "#475569"
                              : "transparent",
                          color:
                            mappingTab === "options" ? "#f8fafc" : "#94a3b8",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        All Options
                      </button>
                    </div>

                    <div
                      className="clip-content"
                      style={{
                        marginTop: 12,
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        padding: 12,
                        paddingBottom: 18,
                        flex: 1,
                        minWidth: 0,
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
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
                              <div style={{ color: "#64748b" }}>
                                {!activeMappingPid
                                  ? "Select a mapping provider."
                                  : "No options found."}
                              </div>
                            );
                          return (
                            <div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                  All Available Options • via {activeMappingPid}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(options);
                                  }}
                                  style={{
                                    background: "#334155",
                                    border: "1px solid #475569",
                                    borderRadius: 6,
                                    padding: "4px 8px",
                                    color: "#94a3b8",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  📋 Copy
                                </button>
                              </div>
                              <div
                                className="prose prose-sm max-w-none dark:prose-invert"
                                style={{ lineHeight: 1.7, fontSize: 14 }}
                              >
                                <MarkdownDisplay
                                  content={transformCitations(options)}
                                  components={markdownComponents}
                                />
                              </div>
                            </div>
                          );
                        })();

                        const mapInner = (() => {
                          if (!wasMapRequested)
                            return (
                              <div
                                style={{
                                  color: "#64748b",
                                  fontStyle: "italic",
                                  textAlign: "center",
                                }}
                              >
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
                                <div
                                  style={{
                                    background: "#1f2937",
                                    border: "1px solid #ef4444",
                                    color: "#fecaca",
                                    borderRadius: 8,
                                    padding: 12,
                                  }}
                                >
                                  <div
                                    style={{ fontSize: 12, marginBottom: 8 }}
                                  >
                                    {activeMappingPid} · error
                                  </div>
                                  <div
                                    className="prose prose-sm max-w-none dark:prose-invert"
                                    style={{ lineHeight: 1.7, fontSize: 14 }}
                                  >
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
                                <div style={{ color: "#64748b" }}>
                                  No mapping yet.
                                </div>
                              );
                            return (
                              <div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    marginBottom: 8,
                                  }}
                                >
                                  <div
                                    style={{ fontSize: 12, color: "#94a3b8" }}
                                  >
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
                                    style={{
                                      background: "#334155",
                                      border: "1px solid #475569",
                                      borderRadius: 6,
                                      padding: "4px 8px",
                                      color: "#94a3b8",
                                      fontSize: 12,
                                      cursor: "pointer",
                                    }}
                                  >
                                    📋 Copy
                                  </button>
                                </div>
                                {(() => {
                                  // Extract Claude artifacts from mapping text
                                  const { cleanText, artifacts } = extractClaudeArtifacts(displayedMappingText);

                                  return (
                                    <>
                                      <div
                                        className="prose prose-sm max-w-none dark:prose-invert"
                                        style={{ lineHeight: 1.7, fontSize: 16 }}
                                      >
                                        <MarkdownDisplay
                                          content={transformCitations(cleanText || displayedMappingText)}
                                          components={markdownComponents}
                                        />
                                      </div>

                                      {/* Artifact badges */}
                                      {artifacts.length > 0 && (
                                        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                          {artifacts.map((artifact, idx) => (
                                            <button
                                              key={idx}
                                              onClick={() => setSelectedArtifact(artifact)}
                                              style={{
                                                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                                                border: "1px solid #818cf8",
                                                borderRadius: 8,
                                                padding: "8px 12px",
                                                color: "#ffffff",
                                                fontSize: 13,
                                                fontWeight: 500,
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                transition: "all 0.2s ease",
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = "translateY(-1px)";
                                                e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)";
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = "translateY(0)";
                                                e.currentTarget.style.boxShadow = "none";
                                              }}
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
                            <div
                              style={{
                                color: "#64748b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                fontStyle: "italic",
                              }}
                            >
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
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 60,
                            background: "linear-gradient(transparent, #1e293b)",
                            pointerEvents: "none",
                            borderRadius: "0 0 8px 8px",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setMapExpanded(true)}
                          style={{
                            position: "absolute",
                            bottom: 12,
                            left: "50%",
                            transform: "translateX(-50%)",
                            padding: "6px 12px",
                            background: "#334155",
                            border: "1px solid #475569",
                            borderRadius: 6,
                            color: "#e2e8f0",
                            cursor: "pointer",
                            fontSize: 12,
                            zIndex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Show full response{" "}
                          <ChevronDownIcon style={{ width: 14, height: 14 }} />
                        </button>
                      </>
                    )}
                    {mapExpanded && mapTruncated && (
                      <button
                        type="button"
                        onClick={() => setMapExpanded(false)}
                        style={{
                          marginTop: 12,
                          padding: "6px 12px",
                          background: "#334155",
                          border: "1px solid #475569",
                          borderRadius: 6,
                          color: "#94a3b8",
                          cursor: "pointer",
                          fontSize: 12,
                          alignSelf: "center",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <ChevronUpIcon style={{ width: 14, height: 14 }} />{" "}
                        Collapse
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sources Section */}
            {hasSources && (
              <div
                className="batch-filler"
                style={{
                  border: "1px solid #475569",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div className="sources-wrapper">
                  <div
                    className="sources-toggle"
                    style={{ textAlign: "center", marginBottom: 8 }}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleSourceOutputs?.()}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid #334155",
                        background: "#0b1220",
                        color: "#e2e8f0",
                        cursor: "pointer",
                      }}
                    >
                      {showSourceOutputs ? "Hide Sources" : "Show Sources"}
                    </button>
                  </div>
                  {showSourceOutputs && (
                    <div className="sources-content">{children}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AiTurnBlock);
