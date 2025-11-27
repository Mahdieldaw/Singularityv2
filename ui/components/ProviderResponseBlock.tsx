// ProviderResponseBlock.tsx - DERIVED STATE VERSION
import React from "react";
import { LLMProvider, AppStep, ProviderResponse } from "../types";
import {
  LLM_PROVIDERS_CONFIG,
  PRIMARY_STREAMING_PROVIDER_IDS,
} from "../constants";
import { BotIcon } from "./Icons";
import { useState, useCallback, useMemo, useEffect } from "react";
import { ProviderPill } from "./ProviderPill";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import { providerContextsAtom, toastAtom, providerHistoryExpandedFamily, activeRecomputeStateAtom, visibleProvidersAtom, selectedHiddenProviderAtom } from "../state/atoms";
import MarkdownDisplay from "./MarkdownDisplay";
import { normalizeProviderId } from "../utils/provider-id-mapper";
import clsx from "clsx";

// Import Claude artifact extraction helper
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

interface ProviderState {
  text: string;
  status: "pending" | "streaming" | "completed" | "error";
}

type ProviderStates = Record<string, ProviderState>;

interface ProviderResponseBlockProps {
  providerResponses?: Record<string, ProviderResponse>;
  providerResponseHistory?: Record<string, ProviderResponse[]>;
  providerStates?: ProviderStates;
  isLoading: boolean;
  currentAppStep: AppStep;
  isReducedMotion?: boolean;
  aiTurnId?: string;
  sessionId?: string;
  onRetryProvider?: (providerId: string) => void;
  userTurnId?: string;
  copyAllText?: string;
  activeTarget?: { aiTurnId: string; providerId: string } | null;
  onToggleTarget?: (providerId: string) => void;
  onBranchContinue?: (providerId: string, prompt: string) => void;
}

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const setToast = useSetAtom(toastAtom);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setToast({ id: Date.now(), message: 'Copied to clipboard', type: 'info' });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("Failed to copy text:", error);
        setToast({ id: Date.now(), message: 'Failed to copy', type: 'error' });
      }
    },
    [text, setToast],
  );

  return (
    <button
      onClick={handleCopy}
      aria-label={label}
      className="bg-surface-raised border border-border-subtle rounded-md px-2 py-1 text-text-muted text-xs cursor-pointer hover:bg-surface-highlight transition-all"
    >
      {copied ? "✓" : "📋"} {copied ? "Copied" : "Copy"}
    </button>
  );
};

const ProviderResponseBlock = ({
  providerResponses,
  providerResponseHistory,
  providerStates,
  isLoading,
  isReducedMotion = false,
  aiTurnId,
  sessionId,
  onRetryProvider,
  userTurnId,
  copyAllText,
  activeTarget,
  onToggleTarget,
  onBranchContinue,
}: ProviderResponseBlockProps) => {
  const providerContexts = useAtomValue(providerContextsAtom);

  // State for Claude artifact overlay
  const [selectedArtifact, setSelectedArtifact] = useState<{
    title: string;
    identifier: string;
    content: string;
  } | null>(null);

  const setProviderContexts = useSetAtom(providerContextsAtom);

  // Normalize responses
  // Normalize provider IDs to canonical form before processing
  const normalizedResponses = providerResponses
    ? Object.entries(providerResponses).reduce((acc, [id, resp]) => {
      const normId = normalizeProviderId(id);
      acc[normId] = resp;
      return acc;
    }, {} as Record<string, ProviderResponse>)
    : {};

  const effectiveProviderResponses = Object.keys(normalizedResponses).length
    ? normalizedResponses
    : Object.fromEntries(
      Object.entries(providerStates || {}).map(([id, s]) => [
        id,
        { text: s.text, status: s.status, meta: undefined },
      ]),
    );

  const effectiveProviderStates = Object.entries(
    effectiveProviderResponses,
  ).reduce((acc, [providerId, response]) => {
    acc[providerId] = {
      text: (response as any).text || "",
      status: (response as any).status,
    };
    return acc;
  }, {} as ProviderStates);

  // Get all provider IDs in order (excluding 'system')
  const allProviderIds = useMemo(
    () => LLM_PROVIDERS_CONFIG.map((p) => p.id).filter((id) => id !== "system"),
    [],
  );

  // --- PILL-MENU SWAP SYSTEM ---
  const [visibleProviders, setVisibleProviders] = useAtom(visibleProvidersAtom);
  const [selectedHidden, setSelectedHidden] = useAtom(selectedHiddenProviderAtom);

  // Calculate visible slots from atom, fallback to first 3 providers if none persisted
  const visibleSlots = useMemo(() => {
    const validVisible = visibleProviders.filter(id => allProviderIds.includes(id));

    // If we have 3 valid providers, use them
    if (validVisible.length >= 3) {
      return validVisible.slice(0, 3);
    }

    // Otherwise, fill with first available providers
    const needed = 3 - validVisible.length;
    const used = new Set(validVisible);
    const available = allProviderIds.filter(id => !used.has(id));

    return [...validVisible, ...available.slice(0, needed)];
  }, [visibleProviders, allProviderIds]);

  // Derive hidden providers
  const hiddenProviders = useMemo(() => {
    return allProviderIds.filter(id => !visibleSlots.includes(id));
  }, [allProviderIds, visibleSlots]);

  const getProviderConfig = (providerId: string): LLMProvider | undefined => {
    return LLM_PROVIDERS_CONFIG.find((p) => p.id === providerId);
  };

  // Pill click: Select hidden provider for swapping
  const handlePillClick = useCallback((providerId: string) => {
    // If no selection active and provider has no response yet, auto-bring into view and target
    const isHidden = !visibleSlots.includes(providerId);
    const hasData = !!effectiveProviderStates[providerId];
    if (!selectedHidden && isHidden && !hasData) {
      // Place it into the center slot (index 1) for prominence
      setVisibleProviders((prev) => {
        const next = [...prev];
        next[1] = providerId;
        return next;
      });
      // Target it to reveal inline input
      try { onToggleTarget?.(providerId); } catch { }
      return;
    }

    // Default behavior: toggle hidden selection for two-click swap
    if (selectedHidden === providerId) {
      setSelectedHidden(null); // Deselect if clicking same pill
    } else {
      setSelectedHidden(providerId);
    }
  }, [selectedHidden, setSelectedHidden, visibleSlots, effectiveProviderStates, setVisibleProviders, onToggleTarget]);

  // Card click: Complete swap if selection active
  const handleCardSwap = useCallback((targetSlotProviderId: string) => {
    if (!selectedHidden) return;

    setVisibleProviders(prev =>
      prev.map(id => id === targetSlotProviderId ? selectedHidden : id)
    );
    setSelectedHidden(null);
  }, [selectedHidden, setVisibleProviders, setSelectedHidden]);

  // Visible pill click: Alternative swap target (pill-to-pill)
  const handleVisiblePillClick = useCallback((visibleProviderId: string) => {
    if (!selectedHidden) return;

    setVisibleProviders(prev =>
      prev.map(id => id === visibleProviderId ? selectedHidden : id)
    );
    setSelectedHidden(null);
  }, [selectedHidden, setVisibleProviders, setSelectedHidden]);

  // Highlight target provider on citation click and scroll into view
  const [highlightedProviderId, setHighlightedProviderId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const handler = (evt: Event) => {
      try {
        const detail = (evt as CustomEvent<any>).detail || {};
        const targetTurnId: string | undefined = detail.aiTurnId;
        const targetProviderId: string | undefined = detail.providerId;
        if (!targetProviderId) return;
        if (aiTurnId && targetTurnId && targetTurnId !== aiTurnId) return;

        // Ensure target provider is brought into view
        // If already visible, don't change layout, just highlight
        if (!visibleSlots.includes(targetProviderId)) {
          // Force it into slot 0
          setVisibleProviders(prev => {
            const next = [...prev];
            next[0] = targetProviderId;
            return next;
          });
        }

        setHighlightedProviderId(targetProviderId);
        setTimeout(() => {
          // Use a per-turn unique ID to avoid collisions across turns
          const el = document.getElementById(
            `provider-card-${targetTurnId || aiTurnId || "unknown"}-${targetProviderId}`,
          );
          if (el && typeof el.scrollIntoView === "function") {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 60);
        // Clear highlight after pulse
        setTimeout(() => setHighlightedProviderId(null), 1600);
      } catch (e) {
        console.warn("scroll-to-provider handler failed", e);
      }
    };
    document.addEventListener(
      "htos:scrollToProvider",
      handler as EventListener,
    );
    return () =>
      document.removeEventListener(
        "htos:scrollToProvider",
        handler as EventListener,
      );
  }, [aiTurnId, visibleSlots]); // Added visibleSlots dependency to ensure we have fresh state

  const getStatusClass = (status: string, hasText: boolean = true) => {
    switch (status) {
      case "pending":
      case "streaming":
        return "bg-intent-warning";
      case "completed":
        return hasText ? "bg-intent-success" : "bg-intent-warning";
      case "error":
        return "bg-intent-danger";
      default:
        return "bg-text-muted";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Waiting...";
      case "streaming":
        return "Generating...";
      case "completed":
        return "Complete";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  if (allProviderIds.length === 0) {
    return null;
  }

  const renderProviderCard = (providerId: string, isVisible: boolean) => {
    const state = effectiveProviderStates[providerId] || { text: "", status: "pending" } as any;
    const provider = getProviderConfig(providerId);
    const context = providerContexts[providerId];
    const isStreaming = state?.status === "streaming";
    const isError = state?.status === "error";
    const isHighlighted = highlightedProviderId === providerId;
    const hasText = !!state?.text?.trim();

    const displayText = isError
      ? context?.errorMessage || state?.text || "Provider error"
      : state?.text || (state?.status === "completed" ? "Empty Response" : getStatusText(state?.status));

    const isTargeted = activeTarget?.providerId === providerId;
    const history = providerResponseHistory?.[providerId] || [];

    // Persisted history toggle
    const [showHistory, setShowHistory] = useAtom(
      useMemo(() => providerHistoryExpandedFamily(`${aiTurnId}-${providerId}`), [aiTurnId, providerId])
    );

    // Inline branch input state
    const [branchInput, setBranchInput] = useState("");

    // Reset branch input when card is untargeted
    useEffect(() => {
      if (!isTargeted) {
        setBranchInput("");
      }
    }, [isTargeted]);

    // Branch send handler
    const handleBranchSend = useCallback(() => {
      if (!branchInput.trim() || !onBranchContinue) return;
      onBranchContinue(providerId, branchInput);
      setBranchInput("");
    }, [branchInput, onBranchContinue, providerId]);

    // Branching visual state
    const activeRecompute = useAtomValue(activeRecomputeStateAtom);
    const isBranching = isLoading &&
      activeRecompute?.stepType === "batch" &&
      activeRecompute?.providerId === providerId;

    return (
      <div
        key={providerId}
        id={`provider-card-${aiTurnId || "unknown"}-${providerId}`}
        onClick={(e) => {
          // If a hidden provider is selected for swap, allow clicking anywhere to drop it here
          if (selectedHidden) {
            handleCardSwap(providerId);
            return;
          }
          // Otherwise, prevent when clicking interactive elements
          if ((e.target as HTMLElement).closest('button, a, .provider-card-scroll')) return;
          onToggleTarget?.(providerId);
        }}
        className={clsx(
          "flex flex-col bg-surface-raised border rounded-2xl p-3",
          "shadow-card-sm flex-shrink-0 overflow-hidden",
          "flex-1 basis-[320px] min-w-[260px] max-w-[380px] w-full h-[300px]",
          "transition-[box-shadow,border-color] duration-300 cursor-pointer relative",
          isHighlighted ? "border-brand-500 shadow-glow-brand" :
            isTargeted ? "border-brand-500 ring-2 ring-brand-500/50 shadow-glow-brand" :
              selectedHidden ? "ring-2 ring-brand-300 shadow-glow-brand-soft" : // Swappable state
                "border-border-subtle hover:border-border-strong",
          isBranching && "animate-pulse-ring",
          !isVisible && "hidden"
        )}
        aria-live="polite"
      >
        {isBranching && (
          <div className="absolute top-2 right-2 z-10 text-xs font-bold bg-brand-500 text-white px-2 py-0.5 rounded-full shadow-sm animate-in fade-in zoom-in duration-300">
            Branching...
          </div>
        )}
        {/* Fixed Header */}
        <div className="flex items-center gap-2 mb-3 flex-shrink-0 h-6">
          {provider?.logoSrc ? (
            <img
              src={provider.logoSrc}
              alt={provider.name}
              className="w-4 h-4 rounded object-contain"
            />
          ) : (
            provider && (
              <div
                className={`model-logo ${provider.logoBgClass} w-4 h-4 rounded`}
              />
            )
          )}
          <div className="font-medium text-xs text-text-muted">
            {provider?.name || providerId}
          </div>
          {isTargeted && (
            <div className="bg-brand-500 text-white text-xs px-1.5 py-0.5 rounded font-medium animate-in fade-in zoom-in duration-200">
              Targeted
            </div>
          )}
          {context && (
            <div className="text-xs text-text-muted/70 ml-1">
              {context.rateLimitRemaining &&
                `(${context.rateLimitRemaining} left)`}
              {context.modelName && ` • ${context.modelName}`}
            </div>
          )}
          <div
            className={clsx(
              "ml-auto w-2 h-2 rounded-full",
              getStatusClass(state?.status, hasText),
              isStreaming && !isReducedMotion && "animate-pulse"
            )}
          />
        </div>

        {/* Scrollable Content Area */}
        <div
          className="provider-card-scroll flex-1 overflow-y-auto overflow-x-hidden p-3 bg-surface-overlay rounded-lg min-h-0 relative group"
          onWheelCapture={(e: React.WheelEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            const dy = e.deltaY ?? 0;
            const canDown = el.scrollTop + el.clientHeight < el.scrollHeight;
            const canUp = el.scrollTop > 0;
            if ((dy > 0 && canDown) || (dy < 0 && canUp)) {
              // keep wheel within the card when it can scroll
              e.stopPropagation();
            }
          }}
          onWheel={(e: React.WheelEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            const dy = e.deltaY ?? 0;
            const canDown = el.scrollTop + el.clientHeight < el.scrollHeight;
            const canUp = el.scrollTop > 0;
            if ((dy > 0 && canDown) || (dy < 0 && canUp)) {
              e.stopPropagation();
            }
          }}
          onTouchStartCapture={(e: React.TouchEvent<HTMLDivElement>) => {
            // hint to keep gesture inside this element
            e.stopPropagation();
          }}
          onTouchMove={(e: React.TouchEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            const canDown = el.scrollTop + el.clientHeight < el.scrollHeight;
            const canUp = el.scrollTop > 0;
            if (canDown || canUp) {
              e.stopPropagation();
            }
          }}
        >
          {(() => {
            // Extract Claude artifacts
            const { cleanText, artifacts } = extractClaudeArtifacts(displayText);

            return (
              <>
                <div className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed text-text-secondary">
                  <MarkdownDisplay content={String(cleanText || displayText || "")} />
                  {isStreaming && <span className="streaming-dots" />}
                </div>

                {/* Artifact badges */}
                {artifacts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {artifacts.map((artifact, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedArtifact(artifact);
                        }}
                        className="bg-gradient-to-br from-brand-500 to-brand-600 border border-brand-400 rounded-lg px-3 py-2 text-text-primary text-sm font-medium cursor-pointer flex items-center gap-1.5 hover:-translate-y-px hover:shadow-glow-brand-soft transition-all"
                      >
                        📄 {artifact.title}
                      </button>
                    ))}
                  </div>
                )}

                {/* History Stack (Previous Attempts) */}
                {showHistory && history.length > 1 && (
                  <div className="mt-6 pt-4 border-t border-border-subtle space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Previous Attempts</div>
                    {history.slice(0, -1).reverse().map((resp, idx) => {
                      // Debug logging for empty responses
                      if (!resp.text || resp.text.trim().length === 0) {
                        console.log(`[ProviderResponseBlock] Empty history item found for provider ${providerId} at index ${idx}`, resp);
                      }

                      const { cleanText, artifacts: histArtifacts } = extractClaudeArtifacts(resp.text);
                      const hasContent = cleanText || histArtifacts.length > 0;

                      return (
                        <div key={idx} className="bg-surface p-3 rounded border border-border-subtle opacity-75 hover:opacity-100 transition-opacity">
                          <div className="text-xs text-text-muted mb-1 flex justify-between">
                            <span>Attempt {history.length - 1 - idx}</span>
                            <span>{new Date(resp.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div className="prose prose-sm max-w-none dark:prose-invert text-xs text-text-secondary line-clamp-3 hover:line-clamp-none transition-all">
                            {hasContent ? (
                              <>
                                <MarkdownDisplay content={cleanText || (histArtifacts.length ? "*Artifact content*" : resp.text)} />
                                {histArtifacts.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {histArtifacts.map((art, i) => (
                                      <span key={i} className="text-xs bg-brand-500/10 text-brand-500 px-1.5 py-0.5 rounded border border-brand-500/20 flex items-center gap-1">
                                        📄 {art.title}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-text-muted italic opacity-70">
                                No content available (empty response)
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Inline Branch Input (only when targeted) */}
        {isTargeted && (
          <div className="mt-3 p-3 bg-brand-500/5 border border-brand-500/30 rounded-lg animate-in slide-in-from-bottom-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={branchInput}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setBranchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleBranchSend();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onToggleTarget?.(providerId); // Untarget
                  }
                }}
                placeholder={`Continue with ${provider?.name || providerId}...`}
                className="flex-1 bg-surface border border-border-subtle rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                autoFocus
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleBranchSend(); }}
                disabled={!branchInput.trim()}
                className="bg-brand-500 text-white px-4 py-2 rounded text-sm disabled:opacity-50 hover:bg-brand-600"
              >
                Send
              </button>
            </div>
            <div className="text-xs text-text-muted mt-1.5 px-1">
              Enter to send • ESC to cancel
            </div>
          </div>
        )}

        {/* Fixed Footer with actions */}
        <div className="mt-3 flex justify-between items-center flex-shrink-0 h-8">
          {/* Left: History Toggle */}
          {history.length > 1 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowHistory(!showHistory);
              }}
              className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 px-1.5 py-1 rounded hover:bg-surface-highlight transition-colors"
            >
              {showHistory ? '▼' : '▶'} {history.length - 1} previous
            </button>
          ) : <div />}

          {/* Right: Actions */}
          <div className="flex gap-2">
            {/* Retry Button - Only show for failed or empty completed responses */}
            {(isError || (state?.status === "completed" && !state?.text?.trim())) && onRetryProvider && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRetryProvider(providerId);
                }}
                title="Retry this provider"
                className="bg-intent-danger border border-intent-danger/80 rounded-md px-2 py-1 text-text-primary text-xs cursor-pointer flex items-center gap-1"
              >
                🔄 Retry
              </button>
            )}
            <div onClick={e => e.stopPropagation()}>
              <CopyButton
                text={state?.text}
                label={`Copy ${provider?.name || providerId}`}
              />
            </div>
            <ProviderPill id={providerId as any} />
          </div>
        </div>
      </div >
    );
  };



  return (
    <div className="response-container mb-6">
      <div className="w-full">

        {/* PILL MENU + CARDS LAYOUT */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Hidden pills row (centered, greyed out inactive providers) */}
          {hiddenProviders.length > 0 && (
            <div className="hidden-pills grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-[1200px] px-2 justify-items-center">
              {hiddenProviders.map((pid: string, idx: number) => {
                // Centering logic for first row of hidden pills
                let colClass = "";
                if (idx < 3) {
                  const len = hiddenProviders.length;
                  if (len === 1) colClass = "sm:col-start-2";
                  else if (len === 2) colClass = idx === 0 ? "sm:col-start-1" : "sm:col-start-3";
                  else colClass = idx === 0 ? "sm:col-start-1" : idx === 1 ? "sm:col-start-2" : "sm:col-start-3";
                }
                return (
                  <div key={pid} className={clsx("flex items-center justify-center", colClass)}>
                    <button
                      onClick={() => handlePillClick(pid)}
                      className={clsx(
                        "text-xs px-3 py-1.5 rounded-full border transition-all",
                        selectedHidden === pid
                          ? "bg-chip-active border-border-strong text-text-primary shadow-glow-brand"
                          : "bg-chip-active border-border-subtle text-text-muted hover:bg-surface-highlight opacity-60"
                      )}
                    >
                      {LLM_PROVIDERS_CONFIG.find(p => p.id === pid)?.name || pid}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Visible pills row (centered, aligned to cards) */}
          <div className="visible-pills grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-[1200px] px-2 justify-items-center">
            {visibleSlots.map((pid: string) => (
              <div key={pid} className="flex items-center justify-center">
                <button
                  onClick={() => handleVisiblePillClick(pid)}
                  disabled={!selectedHidden}
                  className={clsx(
                    "text-xs px-3 py-1.5 rounded-full border transition-all",
                    selectedHidden
                      ? "bg-surface-highlight border-brand-300 cursor-pointer hover:bg-brand-100"
                      : "bg-surface-highest border-border-subtle text-text-primary cursor-default shadow-sm"
                  )}
                >
                  {LLM_PROVIDERS_CONFIG.find(p => p.id === pid)?.name || pid}
                </button>
              </div>
            ))}
          </div>

          {/* Cards grid (aligned under visible pills) */}
          <div className="cards-grid grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-[1200px] relative">
            {visibleSlots.map((id: string) => (
              <div key={id} className="flex items-stretch justify-center">
                {renderProviderCard(id, true)}
              </div>
            ))}
          </div>

          {/* Copy All Button - Positioned below grid */}
          <div className="w-full max-w-[1200px] flex justify-end px-2">
            <CopyButton
              text={copyAllText || allProviderIds
                .map((id) => {
                  const state = effectiveProviderStates[id] || { text: "" } as any;
                  const provider = getProviderConfig(id);
                  return `${provider?.name || id}:\n${state?.text || ""}`;
                })
                .join("\n\n---\n\n")}
              label="Copy all responses"
            />
          </div>
        </div>

        {/* Artifact Overlay Modal */}
        {selectedArtifact && (
          <div
            className="fixed inset-0 bg-overlay-backdrop z-[9999] flex items-center justify-center p-5"
            onClick={() => setSelectedArtifact(null)}
          >
            <div
              className="bg-surface-raised border border-border-strong rounded-2xl max-w-[900px] w-full max-h-[90vh] flex flex-col shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
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
                  📋 Copy                </button>
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
      </div>
    </div>
  );
};

export default React.memo(ProviderResponseBlock);
