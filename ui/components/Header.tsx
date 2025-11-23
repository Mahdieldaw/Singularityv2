import React from "react";
import { useAtom, useSetAtom } from "jotai";
import { isHistoryPanelOpenAtom, isSettingsOpenAtom } from "../state/atoms";

// MenuIcon component (inline for simplicity)
const MenuIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

export default function Header() {
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useAtom(
    isHistoryPanelOpenAtom,
  );
  const setIsSettingsOpen = useSetAtom(isSettingsOpenAtom);

  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-surface-soft backdrop-blur-lg border-b border-border-subtle shrink-0 text-text-secondary">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
          className="bg-transparent border-0 text-text-secondary cursor-pointer p-1 hover:text-text-primary transition-colors"
          aria-label="Toggle History Panel"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 font-semibold text-base text-text-secondary">
          <div className="w-6 h-6 bg-brand-500/25 rounded-md flex items-center justify-center text-xs">
            ⚡
          </div>
          Singularity
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-2 bg-surface-highlight border border-border-strong rounded-lg text-text-secondary cursor-pointer transition-all duration-200 hover:bg-surface-raised"
          onClick={() => setIsSettingsOpen(true)}
        >
          ⚙️ Models
        </button>
      </div>
    </header>
  );
}
