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
    if (!isRefinerOpen) {
      setPrompt("");
    }
  };

  const buttonText = isRefinerOpen ? "Launch" : (isContinuationMode ? "Continue" : "Draft");
  const isDisabled = isLoading || mappingActive || !prompt.trim();
  const showMappingBtn = canShowMapping && !!prompt.trim() && !isRefinerOpen;
  const showAbortBtn = !!onAbort && isLoading;

  // Status color for system pill
  const statusColor = isLoading ? "#f59e0b" : "#10b981";

  return (
    <div
      className="input-area"
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        width: "100%",
        padding: "8px 12px",
        boxSizing: "border-box",
        zIndex: isHistoryPanelOpen ? 900 : 2001,
        pointerEvents: isHistoryPanelOpen ? "none" : "auto",
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        className="input-container"
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          position: "relative",
          width: "100%",
          maxWidth: "min(800px, calc(100% - 32px))",
          padding: "12px 16px",
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "24px",
          boxSizing: "border-box",
          flexWrap: "wrap",
        }}
      >
        <div
          className="input-wrapper"
          style={{ flex: 1, position: "relative", minWidth: "200px" }}
        >
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
            className="prompt-textarea"
            style={{
              width: "100%",
              minHeight: "38px",
              padding: "8px 12px",
              background: "transparent",
              border: "none",
              color: "#e2e8f0",
              fontSize: "15px",
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              transition: isReducedMotion ? undefined : "all 0.2s ease",
              overflowY: "auto",
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={isLoading}
          />
        </div>

        {/* System status pill (minimal) to the right of the input */}
        <div
          className="system-pill"
          role="status"
          aria-live="polite"
          title={`System: ${isLoading ? "Working…" : "Ready"} • Providers: ${activeProviderCount} • Mode: ${isVisibleMode ? "Visible" : "Headless"}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "999px",
            color: "#cbd5e1",
            fontSize: "12px",
            whiteSpace: "nowrap",
            opacity: 0.9,
            cursor: "default",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: statusColor,
              animation:
                isLoading || !isReducedMotion
                  ? "pulse 1.5s ease-in-out infinite"
                  : undefined,
            }}
          />
          <span style={{ color: "#94a3b8" }}>System</span>
          <span>• {activeProviderCount}</span>
        </div>

        {/* Send/Draft/Launch Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isDisabled}
          className="action-button"
          style={{
            padding: "0px 14px",
            height: "38px",
            background: isRefinerOpen
              ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
              : "linear-gradient(45deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: "16px",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            transition: isReducedMotion ? undefined : "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "90px",
            justifyContent: "center",
            opacity: isDisabled ? 0.5 : 1,
            boxShadow: isRefinerOpen ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none",
          }}
        >
          {isLoading ? (
            <div className="loading-spinner"></div>
          ) : (
            <>
              <span className="magic-icon" style={{ fontSize: "16px" }}>
                {isRefinerOpen ? "🚀" : (isContinuationMode ? "💬" : "✨")}
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
            className="stop-button"
            style={{
              padding: "0px 12px",
              height: "38px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.45)",
              borderRadius: "16px",
              color: "#fecaca",
              fontWeight: 600,
              cursor: "pointer",
              transition: isReducedMotion ? undefined : "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: "90px",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "16px" }}>⏹️</span>
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
            style={{
              padding: "0px 12px",
              height: "38px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "16px",
              color: "#e2e8f0",
              fontWeight: 600,
              cursor: "pointer",
              transition: isReducedMotion ? undefined : "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: "110px",
              justifyContent: "center",
              opacity: isLoading || mappingActive ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: "16px" }}>🧩</span>
            <span>Mapping</span>
          </button>
        )}

        {/* Refiner Controls Toolbar */}
        {isRefinerOpen && (
          <div
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "12px",
              marginTop: "4px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              animation: "fadeIn 0.3s ease-out",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={onUndoRefinement}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444", // Red for Reject
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>❌</span> Reject
              </button>

              <button
                onClick={onToggleExplanation}
                style={{
                  background: "none",
                  border: "none",
                  color: showExplanation ? "#3b82f6" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span style={{ transform: showExplanation ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▸</span> Explanation
              </button>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={onToggleAudit}
                style={{
                  background: "none",
                  border: "none",
                  color: showAudit ? "#f59e0b" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span style={{ transform: showAudit ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▸</span> Audit
              </button>
              <button
                onClick={onToggleVariants}
                style={{
                  background: "none",
                  border: "none",
                  color: showVariants ? "#8b5cf6" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span style={{ transform: showVariants ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▸</span> Variants
              </button>
            </div>
          </div>
        )}

        {/* Refiner Content (Audit/Variants) */}
        {isRefinerOpen && refinerContent && (
          <div style={{ width: "100%", marginTop: "12px" }}>
            {refinerContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
