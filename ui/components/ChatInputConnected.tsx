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
  isRefinerOpenAtom,
  refinerDataAtom,
  chatInputValueAtom,
  hasRejectedRefinementAtom,
} from "../state/atoms";
import ChatInput from "./ChatInput";
import RefinerBlock from "./RefinerBlock";

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
  const [hasRejectedRefinement, setHasRejectedRefinement] = useAtom(hasRejectedRefinementAtom);

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
      } else if (hasRejectedRefinement) {
        // If user rejected refinement, launch immediately
        sendMessage(prompt, "new");
      } else {
        // Otherwise, we are Draft-ing (refining)
        void refinePrompt(prompt);
      }
    },
    [refinePrompt, isRefinerOpen, refinerData, sendMessage, setIsRefinerOpen, setRefinerData, setChatInputValue, hasRejectedRefinement],
  );

  const handleCont = useCallback(
    (prompt: string) => {
      if (isRefinerOpen && refinerData) {
        sendMessage(prompt, "continuation");
        setIsRefinerOpen(false);
        setRefinerData(null);
        setChatInputValue("");
        setShowAudit(false);
        setShowVariants(false);
        setShowExplanation(false);
      } else if (hasRejectedRefinement) {
        sendMessage(prompt, "continuation");
      } else {
        void refinePrompt(prompt);
      }
    },
    [refinePrompt, isRefinerOpen, refinerData, sendMessage, setIsRefinerOpen, setRefinerData, setChatInputValue, hasRejectedRefinement],
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
    setHasRejectedRefinement(true);
  }, [refinerData, setChatInputValue, setIsRefinerOpen, setRefinerData, setHasRejectedRefinement]);

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
      hasRejectedRefinement={hasRejectedRefinement}
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