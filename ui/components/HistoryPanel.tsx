import React, { useEffect } from "react";
import { HistorySessionSummary } from "../types";
import logoIcon from "../assets/logos/logo-icon.svg";
import { PlusIcon, TrashIcon } from "./Icons";

interface HistoryPanelProps {
  isOpen: boolean;
  sessions: HistorySessionSummary[];
  isLoading: boolean;
  onNewChat: () => void;
  onSelectChat: (session: HistorySessionSummary) => void;
  onDeleteChat: (sessionId: string) => void;
  onRenameChat?: (sessionId: string, currentTitle: string) => void;
  // IDs currently being deleted (optimistic UI feedback)
  deletingIds?: Set<string>;
  // Batch selection mode
  isBatchMode?: boolean;
  selectedIds?: Set<string>;
  onToggleBatchMode?: () => void;
  onToggleSessionSelected?: (sessionId: string) => void;
  onConfirmBatchDelete?: () => void;
}

const HistoryPanel = ({
  isOpen,
  sessions,
  isLoading,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  deletingIds,
  isBatchMode = false,
  selectedIds,
  onToggleBatchMode,
  onToggleSessionSelected,
  onConfirmBatchDelete,
  currentSessionId,
}: HistoryPanelProps & { currentSessionId?: string | null }) => {
  return (
    <div className="relative w-full h-full bg-surface-soft/90 backdrop-blur-xl border-r border-border-subtle text-text-secondary p-5 overflow-y-auto overflow-x-hidden flex flex-col">
      {isOpen && (
        <>
          <div className="flex items-center gap-2 mb-4 px-1">
            <img src={logoIcon} alt="Singularity" className="w-6 h-6" />
            <span className="font-semibold text-lg text-text-primary">History</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onNewChat}
              className="flex-1 flex items-center justify-center px-3 py-2.5 rounded-lg border border-border-subtle bg-brand-500/15 text-text-secondary cursor-pointer mb-3 transition-all duration-200 hover:bg-brand-500/20 hover:border-border-strong"
              title="Start a new chat"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (!isBatchMode) {
                  onToggleBatchMode && onToggleBatchMode();
                  return;
                }
                const count = selectedIds ? selectedIds.size : 0;
                if (count > 0) {
                  onConfirmBatchDelete && onConfirmBatchDelete();
                } else {
                  // If none selected, exit batch mode
                  onToggleBatchMode && onToggleBatchMode();
                }
              }}
              className={`flex-1 flex items-center justify-center px-3 py-2.5 rounded-lg border cursor-pointer mb-3 transition-all duration-200 ${isBatchMode
                ? "bg-intent-danger/15 border-intent-danger/45 text-text-secondary hover:bg-intent-danger/20"
                : "bg-brand-500/15 border-border-subtle text-text-secondary hover:bg-brand-500/20 hover:border-border-strong"
                }`}
              title={
                isBatchMode
                  ? "Confirm delete selected chats"
                  : "Select chats to delete"
              }
            >
              {isBatchMode ? (
                <span className="text-sm font-medium">
                  {selectedIds && selectedIds.size ? `Delete (${selectedIds.size})` : "Delete"}
                </span>
              ) : (
                <TrashIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="history-items flex-grow overflow-y-auto">
            {isLoading ? (
              <p className="text-text-muted text-sm text-center mt-5">
                Loading history...
              </p>
            ) : sessions.length === 0 ? (
              <p className="text-text-muted text-sm text-center mt-5">
                No chat history yet.
              </p>
            ) : (
              sessions
                .filter((s) => s && s.sessionId)
                .sort(
                  (a, b) =>
                    (b.lastActivity || b.startTime || 0) -
                    (a.lastActivity || a.startTime || 0),
                )
                .map((session: HistorySessionSummary) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      const isDeleting =
                        !!deletingIds &&
                        (deletingIds as Set<string>).has(session.sessionId);
                      if (isDeleting) return; // disable selection while deletion is pending
                      if (isBatchMode) {
                        onToggleSessionSelected &&
                          onToggleSessionSelected(session.sessionId);
                      } else {
                        onSelectChat(session);
                      }
                    }}
                    className={`p-2.5 px-3 rounded-lg text-base cursor-pointer mb-2 flex items-start justify-between gap-2 transition-all duration-200 
                      ${session.sessionId === currentSessionId
                        ? "bg-brand-500/10 text-text-primary shadow-sm"
                        : "bg-chip text-text-secondary hover:bg-surface-highlight"
                      }
                      ${!!deletingIds && (deletingIds as Set<string>).has(session.sessionId)
                        ? "opacity-60 pointer-events-none"
                        : ""
                      }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const isDeleting =
                          !!deletingIds &&
                          (deletingIds as Set<string>).has(session.sessionId);
                        if (!isDeleting) {
                          if (isBatchMode) {
                            onToggleSessionSelected &&
                              onToggleSessionSelected(session.sessionId);
                          } else {
                            onSelectChat(session);
                          }
                        }
                      }
                    }}
                    title={session.title}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {isBatchMode && (
                        <input
                          type="checkbox"
                          checked={
                            !!selectedIds &&
                            (selectedIds as Set<string>).has(session.sessionId)
                          }
                          onChange={(e) => {
                            e.stopPropagation();
                            onToggleSessionSelected &&
                              onToggleSessionSelected(session.sessionId);
                          }}
                          aria-label={`Select ${session.title} for deletion`}
                          className="flex-shrink-0 accent-brand-500"
                        />
                      )}
                      <span className="overflow-wrap-anywhere break-words whitespace-normal">
                        {session.title}
                      </span>
                    </div>
                    {!isBatchMode && (
                      <div className="flex gap-1.5">
                        <button
                          aria-label={`Rename chat ${session.title}`}
                          title="Rename chat"
                          className="flex-shrink-0 ml-2 bg-intent-success/10 border border-intent-success/40 text-intent-success rounded-md px-1.5 py-1 cursor-pointer text-xs transition-all duration-200 hover:bg-intent-success/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRenameChat &&
                              onRenameChat(session.sessionId, session.title);
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          aria-label={`Delete chat ${session.title}`}
                          title="Delete chat"
                          className={`flex-shrink-0 ml-2 bg-intent-danger/10 border border-intent-danger/45 text-intent-danger rounded-md px-1.5 py-1 text-xs transition-all duration-200 ${!!deletingIds &&
                            (deletingIds as Set<string>).has(session.sessionId)
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer hover:bg-intent-danger/20"
                            }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChat(session.sessionId);
                          }}
                          disabled={
                            !!deletingIds &&
                            (deletingIds as Set<string>).has(session.sessionId)
                          }
                        >
                          {!!deletingIds &&
                            (deletingIds as Set<string>).has(session.sessionId)
                            ? "Deleting…"
                            : "🗑️"}
                        </button>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HistoryPanel;
