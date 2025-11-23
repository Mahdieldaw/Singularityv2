import React from "react";
import { useSetAtom } from "jotai";
import { EXAMPLE_PROMPT } from "../constants";

interface WelcomeScreenProps {
  onSendPrompt?: (prompt: string) => void;
  isLoading?: boolean;
}

const WelcomeScreen = ({ onSendPrompt, isLoading }: WelcomeScreenProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-10">
      <div className="w-20 h-20 bg-gradient-brand-icon rounded-2xl flex items-center justify-center text-[32px] mb-6">
        🧠
      </div>

      <h2 className="text-2xl font-semibold mb-3 text-text-primary">
        Intelligence Augmentation
      </h2>

      <p className="text-base text-text-muted mb-8 max-w-md">
        Ask one question, get synthesized insights from multiple AI models in
        real-time
      </p>

      {onSendPrompt && (
        <button
          onClick={() => onSendPrompt(EXAMPLE_PROMPT)}
          disabled={isLoading}
          className="text-sm text-text-brand px-4 py-2
                     border border-text-brand rounded-lg
                     bg-chip-soft hover:bg-surface-highlight
                     disabled:cursor-not-allowed disabled:opacity-50
                     transition-all duration-200"
        >
          Try: "{EXAMPLE_PROMPT}"
        </button>
      )}
    </div>
  );
};

export default WelcomeScreen;
