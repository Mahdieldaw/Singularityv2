// ProviderResponseBlock.tsx - LAYOUT CONTAINER
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { LLMProvider, AppStep, ProviderResponse } from "../types";
import { LLM_PROVIDERS_CONFIG } from "../constants";
import { useAtom, useSetAtom } from "jotai";
import { visibleProvidersAtom, selectedHiddenProviderAtom, toastAtom } from "../state/atoms";
import clsx from "clsx";
import ProviderCard from "./ProviderCard";
import MarkdownDisplay from "./MarkdownDisplay";

interface ProviderResponseBlockProps {
  providerIds: string[];
  isStreamingTarget: (providerId: string) => boolean;
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
  providerIds,
  isStreamingTarget,
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
  // State for Claude artifact overlay
  const [selectedArtifact, setSelectedArtifact] = useState<{
    title: string;
    identifier: string;
    content: string;
  } | null>(null);

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

  // Pill click: Select hidden provider for swapping
  const handlePillClick = useCallback((providerId: string) => {
    // If no selection active and provider has no response yet, auto-bring into view and target
    const isHidden = !visibleSlots.includes(providerId);
    // Note: We don't check hasData here anymore as we don't have direct access to state.
    // We assume if user clicks a hidden pill they want to interact with it.

    if (!selectedHidden && isHidden) {
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
  }, [selectedHidden, setSelectedHidden, visibleSlots, setVisibleProviders, onToggleTarget]);

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
        if (!visibleSlots.includes(targetProviderId)) {
          setVisibleProviders(prev => {
            const next = [...prev];
            next[0] = targetProviderId;
            return next;
          });
        }

        setHighlightedProviderId(targetProviderId);
        setTimeout(() => {
          const el = document.getElementById(
            `provider-card-${targetTurnId || aiTurnId || "unknown"}-${targetProviderId}`,
          );
          if (el && typeof el.scrollIntoView === "function") {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 60);
        setTimeout(() => setHighlightedProviderId(null), 1600);
      } catch (e) {
        console.warn("scroll-to-provider handler failed", e);
      }
    };
    document.addEventListener("htos:scrollToProvider", handler as EventListener);
    return () => document.removeEventListener("htos:scrollToProvider", handler as EventListener);
  }, [aiTurnId, visibleSlots, setVisibleProviders]);

  if (allProviderIds.length === 0) {
    return null;
  }

  return (
    <div className="response-container mb-6">
      <div className="w-full">
        {/* PILL MENU + CARDS LAYOUT */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Hidden pills row */}
          {hiddenProviders.length > 0 && (
            <div className="hidden-pills grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-[1200px] px-2 justify-items-center">
              {hiddenProviders.map((pid: string, idx: number) => {
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

          {/* Visible pills row */}
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

          {/* Cards grid */}
          <div className="cards-grid grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-[1200px] relative">
            {visibleSlots.map((id: string) => (
              <div key={id} className="flex items-stretch justify-center">
                <ProviderCard
                  turnId={aiTurnId || ""}
                  providerId={id}
                  isStreamingTarget={isStreamingTarget(id)}
                  isReducedMotion={isReducedMotion}
                  sessionId={sessionId}
                  userTurnId={userTurnId || ""}
                  onRetry={onRetryProvider}
                  onToggleTarget={onToggleTarget}
                  onBranchContinue={onBranchContinue}
                  activeTarget={activeTarget}
                  onCardClick={() => {
                    if (selectedHidden) {
                      handleCardSwap(id);
                    }
                  }}
                  isHighlighted={highlightedProviderId === id}
                  isSwapActive={!!selectedHidden}
                  onArtifactOpen={setSelectedArtifact}
                />
              </div>
            ))}
          </div>

          {/* Copy All Button */}
          <div className="w-full max-w-[1200px] flex justify-end px-2">
            <CopyButton
              text={copyAllText || ""}
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

              <div className="flex-1 overflow-y-auto p-5 bg-surface">
                <MarkdownDisplay content={selectedArtifact.content} />
              </div>

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
      </div>
    </div>
  );
};

export default React.memo(ProviderResponseBlock);
