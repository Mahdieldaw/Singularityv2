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
import { useAtomValue, useSetAtom } from "jotai";
import { providerContextsAtom } from "../state/atoms";
import MarkdownDisplay from "./MarkdownDisplay";
import { normalizeProviderId } from "../utils/provider-id-mapper";

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
  providerStates?: ProviderStates;
  isLoading: boolean;
  currentAppStep: AppStep;
  isReducedMotion?: boolean;
  aiTurnId?: string;
  sessionId?: string;
  onRetryProvider?: (providerId: string) => void;
  userTurnId?: string;
}

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("Failed to copy text:", error);
      }
    },
    [text],
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
  providerStates,
  isLoading,
  isReducedMotion = false,
  aiTurnId,
  sessionId,
  onRetryProvider,
  userTurnId,
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
    () =>
      LLM_PROVIDERS_CONFIG.map((p) => p.id).filter(
        (id) => id !== "system" && Object.prototype.hasOwnProperty.call(effectiveProviderResponses, id),
      ),
    [effectiveProviderResponses],
  );

  // --- SLOT MANAGEMENT (DERIVED STATE) ---
  const [manualVisibleSlots, setManualVisibleSlots] = useState<string[]>([]);
  const [rotationIndex, setRotationIndex] = useState(0);

  // Calculate visible slots during render
  const visibleSlots = useMemo(() => {
    // 1. Filter manual slots to only valid ones (present in current response set)
    const validManual = manualVisibleSlots.filter(id => allProviderIds.includes(id));

    // 2. If we have enough manual slots to fill the view (3), use them
    if (validManual.length >= 3) {
      return validManual.slice(0, 3);
    }

    // 3. Otherwise, fill remaining slots with available providers
    const needed = 3 - validManual.length;
    const used = new Set(validManual);

    // Prioritize primary streaming providers for default slots if not already used
    const available = allProviderIds.filter(id => !used.has(id));

    // Simple fill strategy: take the first available ones
    // (allProviderIds is already sorted by config order)
    const filled = [...validManual, ...available.slice(0, needed)];

    return filled;
  }, [manualVisibleSlots, allProviderIds]);

  // Derive hidden providers
  const hiddenProviders = useMemo(() => {
    return allProviderIds.filter(id => !visibleSlots.includes(id));
  }, [allProviderIds, visibleSlots]);

  // Split hidden into left/right for the UI
  const hiddenLeft = useMemo(() => hiddenProviders.slice(0, 2), [hiddenProviders]);
  const hiddenRight = useMemo(() => hiddenProviders.slice(2), [hiddenProviders]);

  const getProviderConfig = (providerId: string): LLMProvider | undefined => {
    return LLM_PROVIDERS_CONFIG.find((p) => p.id === providerId);
  };

  const swapProviderIn = useCallback((providerId: string) => {
    // Use the *current* visible slots as the base for modification
    const nextSlots = [...visibleSlots];

    // Replace the slot at the current rotation index
    nextSlots[rotationIndex] = providerId;

    setManualVisibleSlots(nextSlots);
    setRotationIndex((prev) => (prev + 1) % 3);
  }, [visibleSlots, rotationIndex]);

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
        // We do this by forcing it into the first slot manually
        setManualVisibleSlots(prev => {
          // If already visible, don't change layout, just highlight
          if (visibleSlots.includes(targetProviderId)) return prev;

          // Otherwise, force it into slot 0
          // We need to construct a new valid manual list.
          // Best bet: take current visible, replace index 0.
          const next = [...visibleSlots];
          next[0] = targetProviderId;
          return next;
        });

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

  const getStatusColor = (status: string, hasText: boolean = true) => {
    switch (status) {
      case "pending":
        return "#f59e0b";
      case "streaming":
        return "#f59e0b";
      case "completed":
        return hasText ? "#10b981" : "#f59e0b";
      case "error":
        return "#ef4444";
      default:
        return "#6b7280";
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
    const state = effectiveProviderStates[providerId];
    const provider = getProviderConfig(providerId);
    const context = providerContexts[providerId];
    const isStreaming = state?.status === "streaming";
    const isError = state?.status === "error";
    const isHighlighted = highlightedProviderId === providerId;
    const hasText = !!state?.text?.trim();

    const displayText = isError
      ? context?.errorMessage || state?.text || "Provider error"
      : state?.text || (state?.status === "completed" ? "Empty Response" : getStatusText(state?.status));

    return (
      <div
        key={providerId}
        id={`provider-card-${aiTurnId || "unknown"}-${providerId}`}
        className={`flex flex-col bg-surface-raised border rounded-2xl p-3 shadow-sm flex-shrink-0 overflow-hidden ${isHighlighted
          ? "border-brand-500 shadow-glow-brand"
          : "border-border-subtle"
          }`}
        style={{
          flex: "1 1 320px",
          minWidth: "260px",
          maxWidth: "380px",
          width: "100%",
          height: "300px",
          display: isVisible ? "flex" : "none",
          transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        }}
        aria-live="polite"
      >
        {/* Fixed Header */}
        <div className="flex items-center gap-2 mb-3 flex-shrink-0 h-6">
          {provider && (
            <div
              className={`model-logo ${provider.logoBgClass} w-4 h-4 rounded`}
            />
          )}
          <div className="font-medium text-xs text-text-muted">
            {provider?.name || providerId}
          </div>
          {context && (
            <div className="text-[10px] text-text-muted/70 ml-1">
              {context.rateLimitRemaining &&
                `(${context.rateLimitRemaining} left)`}
              {context.modelName && ` • ${context.modelName}`}
            </div>
          )}
          <div
            className="ml-auto w-2 h-2 rounded-full"
            style={{
              background: getStatusColor(state?.status, hasText),
              ...(isStreaming &&
                !isReducedMotion && {
                animation: "pulse 1.5s ease-in-out infinite",
              }),
            }}
          />
        </div>

        {/* Scrollable Content Area */}
        <div
          className="provider-card-scroll flex-1 overflow-y-auto overflow-x-hidden p-3 bg-surface-overlay rounded-lg min-h-0"
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
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,
          }}
        >
          {(() => {
            // Extract Claude artifacts
            const { cleanText, artifacts } = extractClaudeArtifacts(displayText);

            return (
              <>
                <div className="prose prose-sm max-w-none dark:prose-invert text-[13px] leading-relaxed text-text-secondary">
                  <MarkdownDisplay content={String(cleanText || displayText || "")} />
                  {isStreaming && <span className="streaming-dots" />}
                </div>

                {/* Artifact badges */}
                {artifacts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {artifacts.map((artifact, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedArtifact(artifact)}
                        className="bg-gradient-to-br from-brand-500 to-brand-600 border border-brand-400 rounded-lg px-3 py-2 text-white text-sm font-medium cursor-pointer flex items-center gap-1.5 hover:-translate-y-px hover:shadow-glow-brand-soft transition-all"
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

        {/* Fixed Footer with actions */}
        <div className="mt-3 flex justify-end gap-2 flex-shrink-0 h-8">
          {/* Retry Button - Only show for failed or empty completed responses */}
          {(isError || (state?.status === "completed" && !state?.text?.trim())) && onRetryProvider && (
            <button
              onClick={() => onRetryProvider(providerId)}
              title="Retry this provider"
              className="bg-intent-danger border border-intent-danger/80 rounded-md px-2 py-1 text-white text-xs cursor-pointer flex items-center gap-1"
            >
              🔄 Retry
            </button>
          )}
          <CopyButton
            text={state?.text}
            label={`Copy ${provider?.name || providerId}`}
          />
          <ProviderPill id={providerId as any} />
        </div>
      </div >
    );
  };

  // Render side indicator button (mimics ClipsCarousel style)
  const renderSideIndicator = (providerId: string) => {
    const state = effectiveProviderStates[providerId];
    const provider = getProviderConfig(providerId);
    const isStreaming = state?.status === "streaming";
    const isCompleted = state?.status === "completed";

    // State indicator similar to ClipsCarousel
    const statusIcon = isStreaming ? "⏳" : isCompleted ? "◉" : "○";
    const borderColor = isCompleted ? provider?.color || "#475569" : "#475569";
    const bgColor = isCompleted ? "rgba(255,255,255,0.06)" : "#0f172a";

    return (
      <button
        key={providerId}
        onClick={() => swapProviderIn(providerId)}
        title={`Click to view ${provider?.name || providerId}`}
        className="flex flex-col items-center justify-center gap-1 p-3 min-w-[80px] rounded-2xl bg-surface-soft border cursor-pointer flex-shrink-0 hover:-translate-y-0.5 hover:shadow-lg transition-all shadow-card-sm"
        style={{
          borderColor: borderColor,
          background: bgColor,
        }}
      >
        {/* Provider Logo */}
        {provider && (
          <div className={`model-logo ${provider.logoBgClass} w-5 h-5 rounded`} />
        )}

        {/* Status + Name */}
        <div className="text-[10px] font-medium text-text-secondary text-center leading-tight flex items-center gap-0.5">
          <span className="text-xs">{statusIcon}</span>
          <span>{provider?.name || providerId}</span>
        </div>

        {/* Streaming indicator dot */}
        {isStreaming && (
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: getStatusColor(state?.status, !!state?.text),
              animation: isReducedMotion
                ? "none"
                : "pulse 1.5s ease-in-out infinite",
            }}
          />
        )}
      </button>
    );
  };

  return (
    <div className="response-container mb-6 flex">
      <BotIcon className="w-8 h-8 text-text-brand mr-3 flex-shrink-0 mt-1" />
      <div className="flex-1">
        {/* Global Controls Header */}
        <div className="global-controls flex items-center justify-between mb-3 p-3 bg-surface-raised rounded-lg border border-border-subtle">
          <div className="text-sm font-medium text-text-muted">
            AI Responses ({allProviderIds.length})
          </div>
          <CopyButton
            text={allProviderIds
              .map((id) => {
                const state = effectiveProviderStates[id];
                const provider = getProviderConfig(id);
                return `${provider?.name || id}:\n${state.text}`;
              })
              .join("\n\n---\n\n")}
            label="Copy all responses"
          />
        </div>

        {/* CAROUSEL LAYOUT: [Left Indicator] [3 Main Cards] [Right Indicator] */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {hiddenLeft.map((pid) => (
              <div key={`left-${pid}`}>{renderSideIndicator(pid)}</div>
            ))}
          </div>

          {/* Main Cards Container (3 slots) */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              flex: 1,
              justifyContent: "flex-start",
              minWidth: 0,
              flexWrap: "wrap",
              width: "100%",
            }}
          >
            {/* Render only visible providers to reduce re-render cost */}
            {visibleSlots.map((id) => renderProviderCard(id, true))}
          </div>

          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {hiddenRight.map((pid) => (
              <div key={`right-${pid}`}>{renderSideIndicator(pid)}</div>
            ))}
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
                  className="bg-brand-500 border border-brand-400 rounded-md px-4 py-2 text-white text-sm cursor-pointer flex items-center gap-1.5 hover:bg-brand-600 transition-all"
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
