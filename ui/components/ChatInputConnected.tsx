import React, { useCallback } from "react";
import { useAtom } from "jotai";
import { useChat } from "../hooks/useChat";
import {
  isLoadingAtom,
  isRefiningAtom,
  isContinuationModeAtom,
  activeProviderCountAtom,
  isVisibleModeAtom,
  isReducedMotionAtom,
  chatInputHeightAtom,
  isHistoryPanelOpenAtom,
  isRefinerOpenAtom, // Import
  refinerDataAtom,
  chatInputValueAtom,
} from "../state/atoms";
import ChatInput from "./ChatInput";
import RefinerBlock from "./RefinerBlock"; // Import

const ChatInputConnected = () => {
  const [isLoading] = useAtom(isLoadingAtom as any) as [boolean, any];
  const [isRefining] = useAtom(isRefiningAtom as any) as [boolean, any];
  const [isContinuationMode] = useAtom(isContinuationModeAtom as any) as [
    boolean,
    any,
  ];
  const [activeProviderCount] = useAtom(activeProviderCountAtom as any) as [
    number,
    any,
  ];
  const [isVisibleMode] = useAtom(isVisibleModeAtom as any) as [boolean, any];
  const [isReducedMotion] = useAtom(isReducedMotionAtom as any) as [
    boolean,
    any,
  ];
  const [, setChatInputHeight] = useAtom(chatInputHeightAtom);
  const [isHistoryOpen] = useAtom(isHistoryPanelOpenAtom);
  const [isRefinerOpen, setIsRefinerOpen] = useAtom(isRefinerOpenAtom);
  const [refinerData, setRefinerData] = useAtom(refinerDataAtom);
  const [, setChatInputValue] = useAtom(chatInputValueAtom);

  const [showAudit, setShowAudit] = React.useState(false);
  const [showVariants, setShowVariants] = React.useState(false);
  const [showExplanation, setShowExplanation] = React.useState(false);

  const { sendMessage, abort, refinePrompt } = useChat();

  const handleSend = useCallback(
    (prompt: string) => {
      // If refiner is open, we are Launching the refined prompt
      if (isRefinerOpen && refinerData) {
        sendMessage(prompt, "new");
        setIsRefinerOpen(false);
        setRefinerData(null);
        setChatInputValue("");
        setShowAudit(false);
        setShowVariants(false);
        setShowExplanation(false);
      } else {
        // Otherwise, we are Draft-ing (refining)
        void refinePrompt(prompt);
      }
    },
    [refinePrompt, isRefinerOpen, refinerData, sendMessage, setIsRefinerOpen, setRefinerData, setChatInputValue],
  );

  const handleCont = useCallback(
    (prompt: string) => {
      // Continuation also triggers refinement by default
      void refinePrompt(prompt);
    },
    [refinePrompt],
  );

  const handleAbort = useCallback(() => {
    void abort();
  }, [abort]);

  const handleUndoRefinement = useCallback(() => {
    if (refinerData?.originalPrompt) {
      setChatInputValue(refinerData.originalPrompt);
    }
    setIsRefinerOpen(false);
    setRefinerData(null);
    setShowAudit(false);
    setShowVariants(false);
    setShowExplanation(false);
  }, [refinerData, setChatInputValue, setIsRefinerOpen, setRefinerData]);

  return (
    <ChatInput
      onSendPrompt={handleSend}
      onContinuation={handleCont}
      onAbort={handleAbort}
      isLoading={isLoading}
      isRefining={isRefining}
      isReducedMotion={isReducedMotion}
      activeProviderCount={activeProviderCount}
      isVisibleMode={isVisibleMode}
      isContinuationMode={isContinuationMode}
      onHeightChange={setChatInputHeight}
      isHistoryPanelOpen={!!isHistoryOpen}
      // Refiner Props
      isRefinerOpen={isRefinerOpen}
      onUndoRefinement={handleUndoRefinement}
      onToggleAudit={() => setShowAudit(!showAudit)}
      onToggleVariants={() => setShowVariants(!showVariants)}
      onToggleExplanation={() => setShowExplanation(!showExplanation)}
      showAudit={showAudit}
      showVariants={showVariants}
      showExplanation={showExplanation}
      refinerContent={
        <RefinerBlock
          showAudit={showAudit}
          showVariants={showVariants}
          showExplanation={showExplanation}
        />
      }
    />
  );
};

export default ChatInputConnected;