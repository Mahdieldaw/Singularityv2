import React, { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  isLoadingAtom,
  currentAppStepAtom,
  isReducedMotionAtom,
  turnsMapAtom,
  currentSessionIdAtom,
} from "../state/atoms";
import { ProviderKey, ProviderResponse } from "../types";
import ProviderResponseBlock from "./ProviderResponseBlock";
import type { AiTurn } from "../types";

interface ProviderResponseBlockConnectedProps {
  aiTurnId: string;
  expectedProviders?: ProviderKey[];
}

function ProviderResponseBlockConnected({ 
  aiTurnId,
  expectedProviders 
}: ProviderResponseBlockConnectedProps) {
  // Global state
  const turnsMap = useAtomValue(turnsMapAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const currentAppStep = useAtomValue(currentAppStepAtom);
  const isReducedMotion = useAtomValue(isReducedMotionAtom);
  const sessionId = useAtomValue(currentSessionIdAtom);

  const aiTurn = turnsMap.get(aiTurnId) as AiTurn | undefined;

  // Pre-allocate responses only during loading and for expected providers
  const providerResponses = useMemo(() => {
    if (!aiTurn) return undefined;
    
    const base = { ...(aiTurn.batchResponses || {}) };
    
    if (expectedProviders?.length && isLoading) {
      const now = Date.now();
      expectedProviders.forEach((providerId) => {
        if (!base[providerId]) {
          base[providerId] = {
            providerId,
            text: "",
            status: "pending" as const,
            createdAt: now,
            updatedAt: now,
            meta: undefined
          };
        }
      });
    }
    
    return base;
  }, [aiTurn, expectedProviders, isLoading]);

  if (!aiTurn) return null;

  return (
    <ProviderResponseBlock
      providerResponses={providerResponses}
      isLoading={isLoading}
      currentAppStep={currentAppStep}
      isReducedMotion={isReducedMotion}
      aiTurnId={aiTurnId}
      sessionId={sessionId || undefined}
    />
  );
}

export default React.memo(ProviderResponseBlockConnected);