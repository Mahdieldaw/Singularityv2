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

// --- Height Measurement Hook (Stabilized) ---
const useShorterHeight = (
  hasSynthesis: boolean,
  hasMapping: boolean,
  synthesisVersion: string | number,
  pause: boolean
) => {
  const synthRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [shorterHeight, setShorterHeight] = useState<number | null>(null);
  const [shorterSection, setShorterSection] = useState<
    "synthesis" | "mapping" | null
  >(null);
  
  // Ref to track user interaction to prevent fighting the user scroll
  const isUserActive = useRef(false);
  const userActiveTimer = useRef<number | null>(null);
  
  // Ref to store the actual measurement function to decouple dependencies
  const measureRef = useRef<() => void>(() => {});

  const measureOnce = useCallback(() => {
    if (pause) return;
    const s = synthRef.current;
    const m = mapRef.current;

    if (!hasSynthesis || !hasMapping || !s || !m) {
      if (shorterHeight !== null) setShorterHeight(null);
      if (shorterSection !== null) setShorterSection(null);
      return;
    }

    if (isUserActive.current) return;

    const synthH = s.scrollHeight;
    const mapH = m.scrollHeight;

    // STABILITY FIX 1: Add a buffer. 
    // If the difference is less than 5px, don't change the active section 
    // to prevent flip-flopping loops.
    let isSynthShorter = synthH <= mapH;
    
    // If they are nearly identical, stick to the existing section to prevent loop
    if (Math.abs(synthH - mapH) < 5 && shorterSection) {
       isSynthShorter = shorterSection === "synthesis";
    }

    const h = isSynthShorter ? synthH : mapH;
    const sec = isSynthShorter ? "synthesis" : "mapping";

    // STABILITY FIX 2: Only update state if height difference is significant (>2px)
    setShorterHeight((prev) => {
      if (prev === null) return h;
      return Math.abs(prev - h) > 2 ? h : prev;
    });

    setShorterSection((prev) => (prev !== sec ? sec : prev));
  }, [hasSynthesis, hasMapping, pause, shorterHeight, shorterSection]);

  // Keep ref up to date
  useEffect(() => {
    measureRef.current = measureOnce;
  }, [measureOnce]);

  useEffect(() => {
    const s = synthRef.current;
    const m = mapRef.current;
    if (!s || !m) return;

    // STABILITY FIX 3: Debounce the observer slightly
    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => measureRef.current());
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(s);
    ro.observe(m);

    const markUserActive = () => {
      isUserActive.current = true;
      if (userActiveTimer.current !== null)
        window.clearTimeout(userActiveTimer.current);
      userActiveTimer.current = window.setTimeout(() => {
        isUserActive.current = false;
        userActiveTimer.current = null;
        handleResize(); // Measure once after user stops
      }, 300);
    };

    const events = ["wheel", "touchstart", "pointerdown"];
    events.forEach((evt) => {
      s.addEventListener(evt, markUserActive, { passive: true });
      m.addEventListener(evt, markUserActive, { passive: true });
    });

    // Initial measure
    handleResize();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
      if (userActiveTimer.current) window.clearTimeout(userActiveTimer.current);
      events.forEach((evt) => {
        s.removeEventListener(evt, markUserActive as EventListener);
        m.removeEventListener(evt, markUserActive as EventListener);
      });
    };
  }, []); // Empty dependency array - we use refs inside

  // Run on content update (synthesisVersion changes)
  useLayoutEffect(() => {
    measureRef.current();
  }, [synthesisVersion, hasSynthesis, hasMapping, pause]);

  return { synthRef, mapRef, shorterHeight, shorterSection };
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
  const setSynthExpanded = onSetSynthExpanded || (() => {});
  const setMapExpanded = onSetMapExpanded || (() => {});

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
  const { synthRef, mapRef, shorterHeight, shorterSection } = useShorterHeight(
    hasSynthesis,
    hasMapping,
    displayedMappingText,
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
              className="citation-pill" // Ensure this class is in your CSS
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCitationClick(num);
            }}
            title={`View Source ${idStr}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "0 6px",
              margin: "0 2px",
              backgroundColor: "#2563eb",
              border: "1px solid #1d4ed8",
              borderRadius: "9999px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: "700",
              lineHeight: "1.4",
              cursor: "pointer",
              textDecoration: "none",
            }}
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
    <div
      className="turn-block"
      style={{ paddingBottom: "1rem", borderBottom: "1px solid #334155" }}
    >
      {userPrompt && (
        <div className="user-prompt-block" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
            User
          </div>
          <div
            style={{
              background: "#0b1220",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: 8,
              color: "#cbd5e1",
            }}
          >
            {userPrompt}
          </div>
        </div>
      )}

      <div
        className="ai-turn-block"
        style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}
      >
        <div
          className="ai-turn-content"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
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
                    Unified Synthesis
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      onToggleSynthesisExpanded && onToggleSynthesisExpanded()
                    }
                    style={{
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    {isSynthesisExpanded ? (
                      <ChevronUpIcon style={{ width: 16, height: 16 }} />
                    ) : (
                      <ChevronDownIcon style={{ width: 16, height: 16 }} />
                    )}
                  </button>
                </div>

                {isSynthesisExpanded && (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      minHeight: 0,
                      overflow:
                        synthTruncated && !synthExpanded ? "hidden" : "visible",
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <ClipsCarousel
                        providers={LLM_PROVIDERS_CONFIG}
                        responsesMap={synthesisResponses}
                        activeProviderId={activeSynthPid}
                        onClipClick={(pid) => onClipClick?.("synthesis", pid)}
                        type="synthesis"
                      />
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
                            <div
                              style={{
                                color: "#64748b",
                                fontStyle: "italic",
                                textAlign: "center",
                              }}
                            >
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
                              <div
                                style={{
                                  background: "#1f2937",
                                  border: "1px solid #ef4444",
                                  color: "#fecaca",
                                  borderRadius: 8,
                                  padding: 12,
                                }}
                              >
                                <div style={{ fontSize: 12, marginBottom: 8 }}>
                                  {activeSynthPid} · error
                                </div>
                                <div
                                  className="prose prose-sm max-w-none dark:prose-invert"
                                  style={{ lineHeight: 1.7, fontSize: 14 }}
                                >
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
                              <div style={{ color: "#64748b" }}>
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
                                style={{ lineHeight: 1.7, fontSize: 16 }}
                              >
                                <MarkdownDisplay
                                  content={String(take.text || "")}
                                />
                              </div>
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
                                <div
                                  className="prose prose-sm max-w-none dark:prose-invert"
                                  style={{ lineHeight: 1.7, fontSize: 16 }}
                                >
                                  <MarkdownDisplay
                                    content={transformCitations(
                                      displayedMappingText
                                    )}
                                    components={markdownComponents}
                                  />
                                </div>
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

                    {mapTruncated && !mapExpanded && mappingTab === "map" && (
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
