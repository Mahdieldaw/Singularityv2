import React, { useMemo, useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  isReducedMotionAtom,
  turnsMapAtom,
  currentSessionIdAtom,
  providerContextsAtom,
  turnStreamingStateFamily,
} from "../state/atoms";
import { ProviderKey, ProviderResponse } from "../types";
import ProviderResponseBlock from "./ProviderResponseBlock";
import { LLM_PROVIDERS_CONFIG } from "../constants";
import { getLatestResponse, normalizeResponseArray } from "../utils/turn-helpers";
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
  // Per-turn streaming state (only active turn sees changing values)
  const streamingState = useAtomValue(turnStreamingStateFamily(aiTurnId));
  const { isLoading, appStep: currentAppStep } = streamingState;

  // Other global state
  const turnsMap = useAtomValue(turnsMapAtom);
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

  
  // Build Copy All text: Synthesis, Mapping, All Options, then Batch Responses
  const copyAllText = useMemo(() => {
    if (!aiTurn) return "";
    const ORDER = ["gemini-exp", "claude", "gemini-pro", "qwen", "chatgpt", "gemini"];
    const nameMap = new Map(LLM_PROVIDERS_CONFIG.map((p) => [String(p.id), p.name]));

    function parseMappingResponse(response?: string | null) {
      if (!response) return { mapping: "", options: null as string | null };
      const separator = "===ALL_AVAILABLE_OPTIONS===";
      if (response.includes(separator)) {
        const [mainMapping, optionsSection] = response.split(separator);
        return { mapping: mainMapping.trim(), options: optionsSection.trim() };
      }
      const optionsPatterns = [
        /\*\*All Available Options:\*\*/i,
        /## All Available Options/i,
        /All Available Options:/i,
      ];
      for (const pattern of optionsPatterns) {
        const match = response.match(pattern);
        if (match && typeof (match as any).index === "number") {
          const idx = (match as any).index as number;
          return {
            mapping: response.substring(0, idx).trim(),
            options: response.substring(idx).trim(),
          };
        }
      }
      return { mapping: response, options: null };
    }

    const lines: string[] = [];

    // Synthesis
    ORDER.forEach((pid) => {
      const arr = aiTurn.synthesisResponses?.[pid] || [];
      const take = getLatestResponse(normalizeResponseArray(arr));
      const text = take?.text ? String(take.text) : "";
      if (text && text.trim().length > 0) {
        lines.push(`=== Synthesis • ${nameMap.get(pid) || pid} ===`);
        lines.push(text.trim());
        lines.push("\n---\n");
      }
    });

    // Mapping + Options
    ORDER.forEach((pid) => {
      const arr = aiTurn.mappingResponses?.[pid] || [];
      const take = getLatestResponse(normalizeResponseArray(arr));
      const raw = take?.text ? String(take.text) : "";
      if (raw && raw.trim().length > 0) {
        const { mapping, options } = parseMappingResponse(raw);
        if (mapping && mapping.trim().length > 0) {
          lines.push(`=== Mapping • ${nameMap.get(pid) || pid} ===`);
          lines.push(mapping.trim());
          lines.push("\n---\n");
        }
        if (options && options.trim().length > 0) {
          lines.push(`=== All Available Options • ${nameMap.get(pid) || pid} ===`);
          lines.push(options.trim());
          lines.push("\n---\n");
        }
      }
    });

    // Batch Responses
    ORDER.forEach((pid) => {
      const resp = aiTurn.batchResponses?.[pid];
      const text = resp?.text ? String(resp.text) : "";
      if (text && text.trim().length > 0) {
        lines.push(`=== Batch Responses • ${nameMap.get(pid) || pid} ===`);
        lines.push(text.trim());
        lines.push("\n---\n");
      }
    });

    return lines.join("\n");
  }, [aiTurn]);

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
      copyAllText={copyAllText}
    />
  );
}

export default React.memo(ProviderResponseBlockConnected);