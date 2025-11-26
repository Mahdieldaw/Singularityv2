import { useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { chatInputValueAtom } from "../state/atoms";
import { LLM_PROVIDERS_CONFIG } from "../constants";

interface ChatInputProps {
  onSendPrompt: (prompt: string) => void;
  onContinuation: (prompt: string) => void;
  // Abort/Stop current workflow
  onAbort?: () => void;
  isLoading: boolean;
  isRefining: boolean; // New prop
  isReducedMotion?: boolean;
  activeProviderCount: number;
  isVisibleMode: boolean;
  isContinuationMode: boolean;
  // Mapping-specific
  onStartMapping?: (prompt: string) => void;
  canShowMapping?: boolean; // ModelTray has >=2 selected and prompt has content
  mappingTooltip?: string;
  mappingActive?: boolean; // disable input and toggles while active
  onHeightChange?: (height: number) => void; // Callback for height changes
  isHistoryPanelOpen?: boolean;
  hasRejectedRefinement?: boolean;
  // Refiner Props
  isRefinerOpen?: boolean;
  onUndoRefinement?: () => void;
  onToggleAudit?: () => void;
  onToggleVariants?: () => void;
  onToggleExplanation?: () => void;
  showAudit?: boolean;
  showVariants?: boolean;
  showExplanation?: boolean;
  refinerContent?: React.ReactNode;
}

const ChatInput = ({
  onSendPrompt,
  onContinuation,
  onAbort,
  isLoading,
  isRefining, // Destructure new prop
  isReducedMotion = false,
  activeProviderCount,
  isVisibleMode,
  isContinuationMode,
  onStartMapping,
  canShowMapping = false,
  mappingTooltip,
  mappingActive = false,
  onHeightChange,
  isHistoryPanelOpen = false,
  hasRejectedRefinement = false,
  isRefinerOpen = false,
  onUndoRefinement,
  onToggleAudit,
  onToggleVariants,
  onToggleExplanation,
  showAudit = false,
  showVariants = false,
  showExplanation = false,
  refinerContent,
}: ChatInputProps) => {
  const CHAT_INPUT_STORAGE_KEY = "htos_chat_input_value";
  const [prompt, setPrompt] = useAtom(chatInputValueAtom);
  // Removed showRefineDropdown and refineModel state
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // Reset height
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, 120); // Max height 120px
      textareaRef.current.style.height = `${newHeight}px`;

      // Calculate total input area height (textarea + padding + borders + refiner content)
      // Note: refinerContent height is dynamic, so this might not be perfect, 
      // but onHeightChange is mostly for padding the chat history.
      const totalHeight = newHeight + 24 + 2 + (isRefinerOpen ? 40 : 0);
      onHeightChange?.(totalHeight);

    }
  }, [prompt, onHeightChange, isRefinerOpen]);

  const handleSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (isLoading || !prompt.trim()) return;

    const trimmed = prompt.trim();
    if (isContinuationMode) {
      onContinuation(trimmed);
    } else {
      onSendPrompt(trimmed);
    }
    // Only clear prompt if NOT refining (Launch clears it via parent)
    // Actually, parent handles clearing usually.
    // If isRefinerOpen, we are Launching.
    if (!isRefinerOpen && !hasRejectedRefinement) {
      setPrompt("");
    }
  };

  const buttonText = (isRefinerOpen || hasRejectedRefinement) ? "Launch" : (isContinuationMode ? "Continue" : "Draft");
  const isDisabled = isLoading || mappingActive || !prompt.trim();
  const showMappingBtn = canShowMapping && !!prompt.trim() && !isRefinerOpen && !hasRejectedRefinement;
  const showAbortBtn = !!onAbort && isLoading;

  return (
    <div className="w-full flex justify-center flex-col items-center pointer-events-auto">
      <div className="flex gap-2 items-center relative w-full max-w-[min(800px,calc(100%-32px))] px-3 py-2 bg-surface-raised/30 backdrop-blur-md border border-border-subtle/50 rounded-full flex-wrap shadow-sm">
        <div className="flex-1 relative min-w-[200px]">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setPrompt(e.target.value)
            }
            placeholder={
              isContinuationMode
                ? "Continue the conversation with your follow-up message..."
                : "Ask anything... Singularity will orchestrate multiple AI models for you."
            }
            rows={1}
            className={`w-full min-h-[38px] px-3 py-2 bg-transparent border-none text-text-primary text-[16px] font-inherit resize-none outline-none overflow-y-auto ${isReducedMotion ? '' : 'transition-all duration-200 ease-out'} placeholder:text-text-muted`}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={isLoading}
          />
        </div>

        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-chip-soft border border-border-subtle rounded-full text-text-secondary text-xs whitespace-nowrap opacity-90 cursor-default"
          role="status"
          aria-live="polite"
          title={`System: ${isLoading ? "Working…" : "Ready"} • Providers: ${activeProviderCount} • Mode: ${isVisibleMode ? "Visible" : "Headless"}`}
        >
          <span
            aria-hidden="true"
            className={`inline-block w-2 h-2 rounded-full ${isLoading ? 'bg-intent-warning animate-pulse' : 'bg-intent-success'} ${!isReducedMotion && !isLoading ? 'animate-pulse' : ''}`}
          />
          <span className="text-text-muted">System</span>
          <span>• {activeProviderCount}</span>
        </div>

        {/* Send/Draft/Launch Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isDisabled}
          className={`px-3.5 h-[38px] rounded-2xl text-white font-semibold cursor-pointer flex items-center gap-2 min-w-[90px] justify-center ${isDisabled ? 'opacity-50' : 'opacity-100'} ${(isRefinerOpen || hasRejectedRefinement) ? 'bg-gradient-to-br from-brand-500 to-brand-400 shadow-card' : 'bg-gradient-to-r from-brand-500 to-brand-400'} ${isReducedMotion ? '' : 'transition-all duration-200 ease-out'}`}
        >
          {isLoading ? (
            <div className="loading-spinner"></div>
          ) : (
            <>
              <span className="text-base">
                {(isRefinerOpen || hasRejectedRefinement) ? "🚀" : (isContinuationMode ? "💬" : "✨")}
              </span>
              <span>{buttonText}</span>
            </>
          )}
        </button>

        {/* Abort/Stop Button - visible while loading */}
        {showAbortBtn && (
          <button
            type="button"
            onClick={() => onAbort?.()}
            title="Stop current workflow"
            className={`px-3 h-[38px] bg-intent-danger/15 border border-intent-danger/45 rounded-2xl text-intent-danger font-semibold cursor-pointer flex items-center gap-2 min-w-[90px] justify-center ${isReducedMotion ? '' : 'transition-all duration-200 ease-out'}`}
          >
            <span className="text-base">⏹️</span>
            <span>Stop</span>
          </button>
        )}

        {/* Mapping Button (ChatInput path) */}
        {showMappingBtn && (
          <button
            type="button"
            onClick={() => {
              onStartMapping?.(prompt.trim());
              setPrompt("");
              try {
                localStorage.removeItem(CHAT_INPUT_STORAGE_KEY);
              } catch { }
            }}
            disabled={isLoading || mappingActive}
            title={mappingTooltip || "Mapping with selected models"}
            className={`px-3 h-[38px] bg-chip-soft border border-border-subtle rounded-2xl text-text-secondary font-semibold cursor-pointer flex items-center gap-2 min-w-[110px] justify-center hover:bg-surface-highlight ${isLoading || mappingActive ? 'opacity-50' : 'opacity-100'} ${isReducedMotion ? '' : 'transition-all duration-200 ease-out'}`}
          >
            <span className="text-base">🧩</span>
            <span>Mapping</span>
          </button>
        )}

        {/* Refiner Controls Toolbar */}
        {isRefinerOpen && (
          <div className="w-full flex items-center justify-between pt-3 mt-1 border-t border-border-subtle animate-[fadeIn_0.3s_ease-out] flex-wrap">
            <div className="flex gap-3">
              <button
                onClick={onUndoRefinement}
                className="bg-none border-none text-intent-danger cursor-pointer text-sm font-semibold flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-200 hover:bg-intent-danger/10"
              >
                <span>❌</span> Reject
              </button>

              <button
                onClick={onToggleExplanation}
                className={`bg-none border-none cursor-pointer text-sm font-semibold flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200 hover:bg-surface-highlight ${showExplanation ? 'text-brand-400' : 'text-text-muted'}`}
              >
                <span className={`transform transition-transform duration-200 ${showExplanation ? 'rotate-90' : 'rotate-0'}`}>▸</span> Explanation
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onToggleAudit}
                className={`bg-none border-none cursor-pointer text-sm font-semibold flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200 hover:bg-surface-highlight ${showAudit ? 'text-intent-warning' : 'text-text-muted'}`}
              >
                <span className={`transform transition-transform duration-200 ${showAudit ? 'rotate-90' : 'rotate-0'}`}>▸</span> Audit
              </button>
              <button
                onClick={onToggleVariants}
                className={`bg-none border-none cursor-pointer text-sm font-semibold flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200 hover:bg-surface-highlight ${showVariants ? 'text-brand-400' : 'text-text-muted'}`}
              >
                <span className={`transform transition-transform duration-200 ${showVariants ? 'rotate-90' : 'rotate-0'}`}>▸</span> Variants
              </button>
            </div>
          </div>
        )}

        {isRefinerOpen && refinerContent && (
          <div className="w-full mt-3">
            {refinerContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
