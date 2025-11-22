import React, { useMemo, useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  isLoadingAtom,
  currentAppStepAtom,
  isReducedMotionAtom,
  turnsMapAtom,
  currentSessionIdAtom,
  providerContextsAtom,
} from "../state/atoms";
import { ProviderKey, ProviderResponse } from "../types";
import ProviderResponseBlock from "./ProviderResponseBlock";
import type { AiTurn } from "../types";
import { normalizeProviderId } from "../utils/provider-id-mapper";
import api from "../services/extension-api";
import type { PrimitiveWorkflowRequest } from "../../shared/contract";

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
  const providerContexts = useAtomValue(providerContextsAtom);

  const aiTurn = turnsMap.get(aiTurnId) as AiTurn | undefined;

  // Pre-allocate responses only during loading and for expected providers
  const providerResponses = useMemo(() => {
    if (!aiTurn) return undefined;

    const base = { ...(aiTurn.batchResponses || {}) };

    if (expectedProviders?.length && isLoading) {
      const now = Date.now();
      // Normalize expected provider IDs to canonical form
      expectedProviders.forEach((providerId) => {
        const normId = normalizeProviderId(providerId);
        if (!base[normId]) {
          base[normId] = {
            providerId: normId,
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

  // Retry handler for failed providers
  const handleRetryProvider = useCallback(async (providerId: string) => {
    if (!sessionId || !aiTurn) {
      console.warn("[ProviderResponseBlock] Cannot retry: missing session or turn data");
      return;
    }

    const userTurnId = aiTurn.userTurnId;
    if (!userTurnId) {
      console.warn("[ProviderResponseBlock] Cannot retry: no userTurnId found");
      return;
    }

    // Get user turn to retrieve original message
    const userTurn = turnsMap.get(userTurnId);
    if (!userTurn || userTurn.type !== "user") {
      console.warn("[ProviderResponseBlock] Cannot retry: user turn not found");
      return;
    }

    // Get provider context to preserve conversation state
    const context = providerContexts[providerId];

    console.log(`[ProviderResponseBlock] Retrying provider: ${providerId}`, {
      aiTurnId,
      userTurnId,
      hasContext: !!context,
    });

    // Create extend primitive to retry just this provider with context
    const primitive: PrimitiveWorkflowRequest = {
      type: "extend",
      sessionId,
      clientUserTurnId: userTurnId,
      userMessage: userTurn.text,
      providers: [providerId as ProviderKey],
      providerMeta: context ? { [providerId]: context } : {},
      includeSynthesis: false,
      includeMapping: false,
    };

    try {
      await api.executeWorkflow(primitive);
    } catch (error) {
      console.error("[ProviderResponseBlock] Retry failed:", error);
    }
  }, [sessionId, aiTurn, turnsMap, providerContexts]);

  if (!aiTurn) return null;

  return (
    <ProviderResponseBlock
      providerResponses={providerResponses}
      isLoading={isLoading}
      currentAppStep={currentAppStep}
      isReducedMotion={isReducedMotion}
      aiTurnId={aiTurnId}
      sessionId={sessionId || undefined}
      onRetryProvider={handleRetryProvider}
      userTurnId={aiTurn.userTurnId}
    />
  );
}

export default React.memo(ProviderResponseBlockConnected);