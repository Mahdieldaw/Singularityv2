// ui/components/AiTurnBlockConnected.tsx
import React, { useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import AiTurnBlock from "./AiTurnBlock";
import ProviderResponseBlockConnected from "./ProviderResponseBlockConnected";

import {
  isReducedMotionAtom,
  showSourceOutputsFamily,
  activeClipsAtom,
  activeRecomputeStateAtom,
  aiTurnSynthesisExpandedFamily,
  aiTurnMappingExpandedFamily,
  aiTurnSynthExpandedFamily,
  aiTurnMapExpandedFamily,
  aiTurnMappingTabFamily,
  turnStreamingStateFamily,
} from "../state/atoms";
import { useClipActions } from "../hooks/useClipActions";
import { useEligibility } from "../hooks/useEligibility";
import type { AiTurn } from "../types";

interface AiTurnBlockConnectedProps {
  aiTurn: AiTurn;
}

export default function AiTurnBlockConnected({
  aiTurn,
}: AiTurnBlockConnectedProps) {
  // Per-turn streaming state (only active turn sees changing values)
  const streamingState = useAtomValue(turnStreamingStateFamily(aiTurn.id));
  const { isLoading, appStep: currentAppStep } = streamingState;

  const [isReducedMotion] = useAtom(isReducedMotionAtom);
  const [showSourceOutputs, setShowSourceOutputs] = useAtom(
    showSourceOutputsFamily(aiTurn.id),
  );
  const [activeClips] = useAtom(activeClipsAtom);
  const { handleClipClick } = useClipActions();
  const { eligibilityMaps } = useEligibility();
  const [activeRecomputeState] = useAtom(activeRecomputeStateAtom);
  const [isSynthesisExpanded, setIsSynthesisExpanded] = useAtom(
    aiTurnSynthesisExpandedFamily(aiTurn.id),
  );
  const [isMappingExpanded, setIsMappingExpanded] = useAtom(
    aiTurnMappingExpandedFamily(aiTurn.id),
  );
  const [synthExpanded, setSynthExpanded] = useAtom(
    aiTurnSynthExpandedFamily(aiTurn.id),
  );
  const [mapExpanded, setMapExpanded] = useAtom(
    aiTurnMapExpandedFamily(aiTurn.id),
  );
  const [mappingTab, setMappingTab] = useAtom(aiTurnMappingTabFamily(aiTurn.id));

  // Determine if this turn is currently streaming (for isLive prop)
  const isLive = isLoading && currentAppStep !== "initial";

  const turnClips = activeClips[aiTurn.id] || {};

  // Use user-selected clip, or fall back to the provider used for generation
  // This fixes the issue where "stale" providers are shown if the user changes selection
  // but hasn't clicked a clip yet for the new turn.
  const activeSynthesisClipProviderId =
    turnClips.synthesis || aiTurn.meta?.synthesizer;
  const activeMappingClipProviderId = turnClips.mapping || aiTurn.meta?.mapper;

  return (
    <AiTurnBlock
      aiTurn={aiTurn}
      isLive={isLive}
      isReducedMotion={isReducedMotion}
      isLoading={isLoading}
      activeRecomputeState={activeRecomputeState}
      currentAppStep={currentAppStep}
      showSourceOutputs={showSourceOutputs}
      onToggleSourceOutputs={useCallback(
        () => setShowSourceOutputs((prev) => !prev),
        [setShowSourceOutputs],
      )}
      isSynthesisExpanded={isSynthesisExpanded}
      onToggleSynthesisExpanded={useCallback(
        () => setIsSynthesisExpanded((prev) => !prev),
        [setIsSynthesisExpanded],
      )}
      isMappingExpanded={isMappingExpanded}
      onToggleMappingExpanded={useCallback(
        () => setIsMappingExpanded((prev) => !prev),
        [setIsMappingExpanded],
      )}
      synthExpanded={synthExpanded}
      onSetSynthExpanded={useCallback(
        (v: boolean) => setSynthExpanded(v),
        [setSynthExpanded],
      )}
      mapExpanded={mapExpanded}
      onSetMapExpanded={useCallback(
        (v: boolean) => setMapExpanded(v),
        [setMapExpanded],
      )}
      mappingTab={mappingTab}
      onSetMappingTab={useCallback(
        (t: "map" | "options") => setMappingTab(t),
        [setMappingTab],
      )}
      activeSynthesisClipProviderId={activeSynthesisClipProviderId}
      activeMappingClipProviderId={activeMappingClipProviderId}
      onClipClick={useCallback(
        (type: "synthesis" | "mapping", pid: string) => {
          void handleClipClick(aiTurn.id, type, pid);
        },
        [handleClipClick, aiTurn.id],
      )}
    >
      <ProviderResponseBlockConnected aiTurnId={aiTurn.id}
        expectedProviders={aiTurn.meta?.expectedProviders} // ✅ Pass metadata
      />
    </AiTurnBlock>
  );
}
