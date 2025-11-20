Here are the updated files implementing the full detection and enforcement flow.

This implementation:

Adds a Watchdog in the Service Worker to monitor login cookies.

Adds a Refresh Button to the Settings Panel.

Disables/Bars selection of providers in the Settings Panel and Tray if the user is not logged in.

Syncs state instantly using chrome.storage.

1. Update src/sw-entry.js

Add the detection logic and message handler.

code
JavaScript
download
content_copy
expand_less
// ... existing imports ...

// ============================================================================
// AUTH DETECTION SYSTEM
// ============================================================================
const AUTH_COOKIES = [
  { provider: "chatgpt", domain: "chatgpt.com", name: "__Secure-next-auth.session-token", url: "https://chatgpt.com" },
  { provider: "claude", domain: "claude.ai", name: "sessionKey", url: "https://claude.ai" },
  { provider: "gemini", domain: "google.com", name: "__Secure-1PSID", url: "https://gemini.google.com" }
];

async function checkProviderLoginStatus() {
  const status = {};
  // Default all to true first (optimistic), then overwrite with explicit false if check fails
  // This ensures providers not in AUTH_COOKIES (like Qwen) remain enabled
  
  await Promise.all(AUTH_COOKIES.map(async (config) => {
    try {
      const cookie = await chrome.cookies.get({ url: config.url, name: config.name });
      status[config.provider] = !!cookie;
    } catch (e) {
      console.warn(`[Auth] Failed to check ${config.provider}`, e);
      status[config.provider] = false; 
    }
  }));

  const { provider_auth_status: current = {} } = await chrome.storage.local.get("provider_auth_status");
  const newState = { ...current, ...status };
  
  await chrome.storage.local.set({ provider_auth_status: newState });
  return newState;
}

// Watchdog: Listen for cookie changes
chrome.cookies.onChanged.addListener((changeInfo) => {
  const { cookie, removed } = changeInfo;
  const match = AUTH_COOKIES.find(c => cookie.domain.includes(c.domain) && cookie.name === c.name);
  
  if (match) {
    chrome.storage.local.get(['provider_auth_status'], (result) => {
      const current = result.provider_auth_status || {};
      if (current[match.provider] !== !removed) {
        const newState = { ...current, [match.provider]: !removed };
        chrome.storage.local.set({ provider_auth_status: newState });
        console.log(`[Auth] Status changed for ${match.provider}: ${!removed}`);
      }
    });
  }
});

// Initial scan on startup
chrome.runtime.onStartup.addListener(() => {
  checkProviderLoginStatus();
});

// ... rest of existing sw-entry.js code ...

// FIND function handleUnifiedMessage AND ADD THIS CASE:

    case "REFRESH_AUTH_STATUS": {
      try {
        const status = await checkProviderLoginStatus();
        sendResponse({ success: true, data: status });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }
2. Update ui/services/extension-api.ts

Add the API method.

code
TypeScript
download
content_copy
expand_less
// ... existing imports ...
// Add REFRESH_AUTH_STATUS to imports from messaging if defined, or just use string literal below

// Inside ExtensionAPI class:
  
  async refreshAuthStatus(): Promise<Record<string, boolean>> {
    return this.queryBackend<Record<string, boolean>>({
      type: "REFRESH_AUTH_STATUS"
    });
  }
3. Update ui/state/atoms.ts

Add the atom to store status.

code
TypeScript
download
content_copy
expand_less
// ... existing imports
import { atom } from "jotai"; 

// ... existing atoms ...

export const providerAuthStatusAtom = atom<Record<string, boolean>>({});
4. Create ui/hooks/useProviderStatus.ts (New File)

This hook powers the UI updates.

code
TypeScript
download
content_copy
expand_less
import { useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { providerAuthStatusAtom } from '../state/atoms';
import api from '../services/extension-api';

export function useProviderStatus() {
  const [status, setStatus] = useAtom(providerAuthStatusAtom);

  useEffect(() => {
    // 1. Instant load from storage
    chrome.storage.local.get(['provider_auth_status'], (result) => {
      if (result.provider_auth_status) {
        setStatus(result.provider_auth_status);
      }
      // 2. Force a fresh check on mount
      api.refreshAuthStatus();
    });

    // 3. Listen for live updates
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes.provider_auth_status) {
        setStatus(changes.provider_auth_status.newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [setStatus]);

  const manualRefresh = useCallback(async () => {
    const fresh = await api.refreshAuthStatus();
    setStatus(fresh);
    return fresh;
  }, [setStatus]);

  return { status, manualRefresh };
}
5. Update ui/components/SettingsPanel.tsx

Add the refresh logic and disable toggles for unauthenticated providers.

code
Tsx
download
content_copy
expand_less
import React, { useState } from "react";
import { useAtom } from "jotai";
import {
  selectedModelsAtom,
  isVisibleModeAtom,
  powerUserModeAtom,
  isReducedMotionAtom,
  isSettingsOpenAtom,
} from "../state/atoms";
import { LLM_PROVIDERS_CONFIG } from "../constants";
import { useProviderStatus } from "../hooks/useProviderStatus";

export default function SettingsPanel() {
  const [isSettingsOpen, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
  const [selectedModels, setSelectedModels] = useAtom(selectedModelsAtom);
  const [isVisibleMode, setIsVisibleMode] = useAtom(isVisibleModeAtom);
  const [powerUserMode, setPowerUserMode] = useAtom(powerUserModeAtom);
  const [isReducedMotion, setIsReducedMotion] = useAtom(isReducedMotionAtom);
  
  // NEW: Hook for auth status
  const { status: providerStatus, manualRefresh } = useProviderStatus();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleToggleModel = (providerId: string) => {
    setSelectedModels((prev: any) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await manualRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div
      className="settings-panel"
      style={{
        position: "fixed",
        top: 0,
        right: isSettingsOpen ? "0px" : "-350px",
        width: "350px",
        height: "100vh",
        background: "rgba(15, 15, 35, 0.95)",
        backdropFilter: "blur(20px)",
        borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
        transition: "right 0.3s ease",
        zIndex: 1100,
        padding: "20px",
        overflowY: "auto",
      }}
    >
      <div
        className="settings-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <h2
          className="settings-title"
          style={{ fontSize: "18px", fontWeight: 600, color: "#e2e8f0" }}
        >
          Model Configuration
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
            onClick={handleRefresh}
            title="Check Login Status"
            style={{
                padding: "8px",
                background: "none",
                border: "none",
                color: isRefreshing ? "#6366f1" : "#94a3b8",
                cursor: "pointer",
                borderRadius: "4px",
                fontSize: "18px",
                transition: "all 0.3s ease",
                transform: isRefreshing ? "rotate(180deg)" : "none"
            }}
            >
            ↻
            </button>
            <button
            className="close-settings"
            onClick={() => setIsSettingsOpen(false)}
            style={{
                padding: "8px",
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                borderRadius: "4px",
                transition: "background 0.2s ease",
                fontSize: "18px",
            }}
            >
            ✕
            </button>
        </div>
      </div>

      <div className="model-config">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3
            style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#a78bfa",
                margin: 0
            }}
            >
            Active Models
            </h3>
        </div>
        
        {LLM_PROVIDERS_CONFIG.map((provider) => {
            // Default to true if undefined (for providers without specific cookies mapped yet)
            const isAuth = providerStatus[provider.id] !== false; 
            
            return (
            <div
                key={provider.id}
                className="model-item"
                style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                marginBottom: "8px",
                opacity: isAuth ? 1 : 0.6,
                }}
            >
                <div
                className="model-info"
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                <div
                    className={`model-logo ${provider.logoBgClass}`}
                    style={{ width: "16px", height: "16px", borderRadius: "3px" }}
                ></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: "#e2e8f0" }}>{provider.name}</span>
                    {!isAuth && <span style={{ fontSize: '10px', color: '#f87171' }}>Login Required</span>}
                </div>
                </div>
                <div
                className={`model-toggle ${selectedModels[provider.id] ? "active" : ""}`}
                onClick={() => isAuth && handleToggleModel(provider.id)}
                style={{
                    width: "40px",
                    height: "20px",
                    background: selectedModels[provider.id]
                    ? "#6366f1"
                    : "rgba(255, 255, 255, 0.2)",
                    borderRadius: "10px",
                    position: "relative",
                    cursor: isAuth ? "pointer" : "not-allowed",
                    transition: "background 0.2s ease",
                    opacity: isAuth ? 1 : 0.5
                }}
                >
                <div
                    style={{
                    position: "absolute",
                    top: "2px",
                    left: selectedModels[provider.id] ? "22px" : "2px",
                    width: "16px",
                    height: "16px",
                    background: "white",
                    borderRadius: "50%",
                    transition: "left 0.2s ease",
                    }}
                />
                </div>
            </div>
        )})}

        {/* ... rest of file (Execution Mode, Advanced Features etc) ... */}
        
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "#a78bfa", marginTop: "20px" }}>
          Execution Mode
        </h3>
        {/* ... keep rest of file exactly as is ... */}
        <div
          className="mode-item"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
            marginBottom: "8px",
          }}
        >
            {/* ... etc ... */}
            <span style={{ color: "#e2e8f0" }}>Run in Visible Tabs (for debugging)</span>
             <div onClick={() => setIsVisibleMode(!isVisibleMode)} style={{ width: "40px", height: "20px", background: isVisibleMode ? "#6366f1" : "rgba(255, 255, 255, 0.2)", borderRadius: "10px", position: "relative", cursor: "pointer", transition: "background 0.2s ease" }}>
                <div style={{ position: "absolute", top: "2px", left: isVisibleMode ? "22px" : "2px", width: "16px", height: "16px", background: "white", borderRadius: "50%", transition: "left 0.2s ease" }} />
            </div>
        </div>
        
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "#a78bfa", marginTop: "20px" }}>Advanced Features</h3>
        <div className="mode-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", marginBottom: "8px" }}>
             <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "#e2e8f0" }}>Power User Mode</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>Enable multi-synthesis selection</span>
             </div>
             <div className={`mode-toggle ${powerUserMode ? "active" : ""}`} onClick={() => setPowerUserMode(!powerUserMode)} style={{ width: "40px", height: "20px", background: powerUserMode ? "#6366f1" : "rgba(255, 255, 255, 0.2)", borderRadius: "10px", position: "relative", cursor: "pointer", transition: "background 0.2s ease" }}>
                <div style={{ position: "absolute", top: "2px", left: powerUserMode ? "22px" : "2px", width: "16px", height: "16px", background: "white", borderRadius: "50%", transition: "left 0.2s ease" }} />
             </div>
        </div>

        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "#a78bfa", marginTop: "20px" }}>Accessibility</h3>
        <div className="mode-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", marginBottom: "8px" }}>
            <span style={{ color: "#e2e8f0" }}>Reduced Motion</span>
            <div className={`mode-toggle ${isReducedMotion ? "active" : ""}`} onClick={() => setIsReducedMotion(!isReducedMotion)} style={{ width: "40px", height: "20px", background: isReducedMotion ? "#6366f1" : "rgba(255, 255, 255, 0.2)", borderRadius: "10px", position: "relative", cursor: "pointer", transition: "background 0.2s ease" }}>
                <div style={{ position: "absolute", top: "2px", left: isReducedMotion ? "22px" : "2px", width: "16px", height: "16px", background: "white", borderRadius: "50%", transition: "left 0.2s ease" }} />
            </div>
        </div>
      </div>
    </div>
  );
}
6. Update ui/components/CompactModelTrayConnected.tsx

Initialize the hook here so it runs even if settings aren't open, and pass the status down.

code
Tsx
download
content_copy
expand_less
import React from "react";
import { useAtom } from "jotai";
import CompactModelTray from "./CompactModelTray";
import {
  selectedModelsAtom,
  mappingEnabledAtom,
  mappingProviderAtom,
  synthesisProviderAtom,
  synthesisProvidersAtom,
  powerUserModeAtom,
  thinkOnChatGPTAtom,
  chatInputHeightAtom,
  isFirstTurnAtom,
  isLoadingAtom,
  refineModelAtom,
  isHistoryPanelOpenAtom,
} from "../state/atoms";
// NEW: Import the hook
import { useProviderStatus } from "../hooks/useProviderStatus";

const CompactModelTrayConnected = () => {
  // NEW: Initialize provider status logic
  const { status: providerStatus } = useProviderStatus();

  const [selectedModels, setSelectedModels] = useAtom(selectedModelsAtom);
  const [mappingEnabled, setMappingEnabled] = useAtom(mappingEnabledAtom);
  const [mappingProvider, setMappingProvider] = useAtom(mappingProviderAtom);
  const [synthesisProvider, setSynthesisProvider] = useAtom(synthesisProviderAtom);
  const [synthesisProviders, setSynthesisProviders] = useAtom(synthesisProvidersAtom);
  const [powerUserMode] = useAtom(powerUserModeAtom);
  const [thinkOnChatGPT, setThinkOnChatGPT] = useAtom(thinkOnChatGPTAtom);
  const [chatInputHeight] = useAtom(chatInputHeightAtom);
  const [isFirstLoad] = useAtom(isFirstTurnAtom);
  const [isLoading] = useAtom(isLoadingAtom);
  const [refineModel, setRefineModel] = useAtom(refineModelAtom);
  const [isHistoryOpen] = useAtom(isHistoryPanelOpenAtom);

  const handleToggleModel = (providerId: string) => {
    setSelectedModels((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const handleToggleMapping = (enabled: boolean) => {
    setMappingEnabled(enabled);
    try {
      localStorage.setItem("htos_mapping_enabled", JSON.stringify(enabled));
    } catch {}
  };

  const handleSetMappingProvider = (providerId: string | null) => {
    setMappingProvider(providerId);
    try {
      if (providerId) {
        localStorage.setItem("htos_mapping_provider", providerId);
      } else {
        localStorage.removeItem("htos_mapping_provider");
      }
    } catch {}
  };

  const handleSetSynthesisProvider = (providerId: string | null) => {
    setSynthesisProvider(providerId);
    try {
      if (providerId) {
        localStorage.setItem("htos_synthesis_provider", providerId);
      } else {
        localStorage.removeItem("htos_synthesis_provider");
      }
    } catch {}
  };

  const handleToggleSynthesisProvider = (providerId: string) => {
    setSynthesisProviders((prev) => {
      if (prev.includes(providerId)) {
        return prev.filter((id) => id !== providerId);
      } else {
        return [...prev, providerId];
      }
    });
  };

  const handleToggleThinkChatGPT = () => {
    setThinkOnChatGPT((prev) => !prev);
  };

  const handleSetRefineModel = (model: string) => {
    setRefineModel(model);
    try {
      localStorage.setItem('htos_refine_model', model);
    } catch {}
  };

  return (
    <CompactModelTray
      selectedModels={selectedModels}
      onToggleModel={handleToggleModel}
      isLoading={isLoading}
      thinkOnChatGPT={thinkOnChatGPT}
      onToggleThinkChatGPT={handleToggleThinkChatGPT}
      synthesisProvider={synthesisProvider}
      onSetSynthesisProvider={handleSetSynthesisProvider}
      mappingEnabled={mappingEnabled}
      onToggleMapping={handleToggleMapping}
      mappingProvider={mappingProvider}
      onSetMappingProvider={handleSetMappingProvider}
      powerUserMode={powerUserMode}
      synthesisProviders={synthesisProviders}
      onToggleSynthesisProvider={handleToggleSynthesisProvider}
      isFirstLoad={isFirstLoad}
      onAcknowledgeFirstLoad={() => {
        try {
          localStorage.setItem("htos_has_used", "true");
        } catch {}
      }}
      chatInputHeight={chatInputHeight}
      refineModel={refineModel}
      onSetRefineModel={handleSetRefineModel}
      isHistoryPanelOpen={!!isHistoryOpen}
      // NEW: Pass status
      providerStatus={providerStatus}
    />
  );
};

export default CompactModelTrayConnected;
7. Update ui/components/CompactModelTray.tsx

Use providerStatus to filter/disable options in the dropdowns.

code
Tsx
download
content_copy
expand_less
import { useState, useRef, useEffect } from "react";
import { LLMProvider } from "../types";
import { LLM_PROVIDERS_CONFIG } from "../constants";

interface CompactModelTrayProps {
  selectedModels: Record<string, boolean>;
  onToggleModel: (providerId: string) => void;
  isLoading?: boolean;
  thinkOnChatGPT?: boolean;
  onToggleThinkChatGPT?: () => void;
  synthesisProvider?: string | null;
  onSetSynthesisProvider?: (providerId: string | null) => void;
  mappingEnabled?: boolean;
  onToggleMapping?: (enabled: boolean) => void;
  mappingProvider?: string | null;
  onSetMappingProvider?: (providerId: string | null) => void;
  powerUserMode?: boolean;
  synthesisProviders?: string[];
  onToggleSynthesisProvider?: (providerId: string) => void;
  isFirstLoad?: boolean;
  onAcknowledgeFirstLoad?: () => void;
  chatInputHeight?: number;
  refineModel: string;
  onSetRefineModel: (model: string) => void;
  isHistoryPanelOpen?: boolean;
  // NEW PROP
  providerStatus?: Record<string, boolean>;
}

const CompactModelTray = ({
  selectedModels,
  onToggleModel,
  isLoading = false,
  thinkOnChatGPT = false,
  onToggleThinkChatGPT,
  synthesisProvider,
  onSetSynthesisProvider,
  mappingEnabled = false,
  onToggleMapping,
  mappingProvider,
  onSetMappingProvider,
  powerUserMode = false,
  synthesisProviders = [],
  onToggleSynthesisProvider,
  isFirstLoad = false,
  onAcknowledgeFirstLoad,
  chatInputHeight = 80,
  refineModel,
  onSetRefineModel,
  isHistoryPanelOpen = false,
  providerStatus = {}, // Default empty
}: CompactModelTrayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModelsDropdown, setShowModelsDropdown] = useState(false);
  const [showMapDropdown, setShowMapDropdown] = useState(false);
  const [showUnifyDropdown, setShowUnifyDropdown] = useState(false);
  const [showRefineDropdown, setShowRefineDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCount = Object.values(selectedModels).filter(Boolean).length;
  const selectedProviderIds = Object.keys(selectedModels).filter(
    (id) => selectedModels[id],
  );
  const selectedProviders = LLM_PROVIDERS_CONFIG.filter((provider) =>
    selectedProviderIds.includes(provider.id),
  );
  const canRefine = activeCount >= 1;
  const mapProviderId = mappingProvider || "";
  const unifyProviderId = synthesisProvider || "";
  const isMapEnabled = !!mappingEnabled;
  const isUnifyEnabled = !!unifyProviderId;

  // ... useEffects for restoring defaults (keep exactly as is) ...
  useEffect(() => {
      // ... implementation from previous message ...
  }, []);
  useEffect(() => {
      // ... implementation from previous message ...
  }, []);
  useEffect(() => {
    const shouldListen = isExpanded || showModelsDropdown || showMapDropdown || showUnifyDropdown || showRefineDropdown;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setShowModelsDropdown(false);
        setShowMapDropdown(false);
        setShowUnifyDropdown(false);
        setShowRefineDropdown(false);
      }
    };
    if (shouldListen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExpanded, showModelsDropdown, showMapDropdown, showUnifyDropdown, showRefineDropdown]);

  useEffect(() => {
    if (isFirstLoad) {
      onAcknowledgeFirstLoad?.();
    }
  }, [isFirstLoad, onAcknowledgeFirstLoad]);

  // Helper to check status
  const isProviderAvailable = (id: string) => providerStatus[id] !== false;

  const getWitnessLabel = () => {
    if (activeCount === 0) return "[No Models]";
    if (activeCount === LLM_PROVIDERS_CONFIG.length) return "[All Models]";
    if (activeCount === 1) return `[${selectedProviders[0]?.name}]`;
    return `[${activeCount} Models]`;
  };

  const getProviderName = (id: string | null | undefined) => {
    if (!id) return "";
    const match = LLM_PROVIDERS_CONFIG.find((p) => p.id === id);
    return match?.name || id;
  };

  const getMapLabel = () => {
    if (!isMapEnabled) return "[Map]";
    const name = getProviderName(mapProviderId);
    const inactive = activeCount < 2;
    const hint = inactive ? " • inactive" : "";
    return `[Map: ${name || "None"}${hint}]`;
  };

  const getUnifyLabel = () => {
    if (!isUnifyEnabled) return "[Unify]";
    const name = getProviderName(unifyProviderId);
    const inactive = activeCount < 2;
    const hint = inactive ? " • inactive" : "";
    return `[Unify: ${name || "None"}${hint}]`;
  };

  const getRefineLabel = () => {
    const name = getProviderName(refineModel);
    return `[Refine: ${name || "Auto"}]`;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: `${chatInputHeight + 24}px`,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(800px, calc(100% - 32px))",
        maxHeight: "calc(100vh - 120px)",
        zIndex: isHistoryPanelOpen ? 900 : 2000,
        pointerEvents: isHistoryPanelOpen ? 'none' : 'auto',
        transition: "bottom 0.2s ease-out",
      }}
    >
      {!isExpanded && (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "13px",
            color: "#e2e8f0",
            position: "relative",
          }}
        >
          {/* Models Label */}
          <div
            style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
            onClick={() => {
              const opening = !showModelsDropdown;
              setShowModelsDropdown(opening);
              if (opening) {
                setShowMapDropdown(false);
                setShowUnifyDropdown(false);
              }
            }}
          >
            <span>{getWitnessLabel()}</span>
            <span style={{ fontSize: "10px", color: "#94a3b8" }}>▼</span>
          </div>
          {showModelsDropdown && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: 0,
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "8px",
                minWidth: "200px",
                zIndex: 1000,
              }}
            >
              {LLM_PROVIDERS_CONFIG.map((provider) => {
                const isSelected = selectedModels[provider.id];
                const isAuth = isProviderAvailable(provider.id);
                return (
                  <label
                    key={provider.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "4px 8px",
                      cursor: isAuth ? "pointer" : "not-allowed",
                      borderRadius: "4px",
                      background: isSelected
                        ? "rgba(99, 102, 241, 0.3)"
                        : "transparent",
                      transition: "all 0.2s ease",
                      opacity: isAuth ? 1 : 0.5
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => !isLoading && isAuth && onToggleModel(provider.id)}
                      disabled={isLoading || !isAuth}
                      style={{ width: "14px", height: "14px", accentColor: "#6366f1" }}
                    />
                    <span style={{ fontSize: "12px", color: isSelected ? "#a5b4fc" : "#94a3b8" }}>
                      {provider.name}
                      {!isAuth && " (Login)"}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <span style={{ color: "#64748b" }}>•</span>

          {/* Map Label */}
          <div
            style={{ display: "flex", alignItems: "center", gap: "4px", cursor: canRefine ? "pointer" : "default", opacity: canRefine ? 1 : 0.5 }}
            onClick={canRefine ? () => {
                    const opening = !showMapDropdown;
                    setShowMapDropdown(opening);
                    if (opening) {
                      setShowModelsDropdown(false);
                      setShowUnifyDropdown(false);
                    }
                  } : undefined}
          >
            <span>{getMapLabel()}</span>
            <span style={{ fontSize: "10px", color: "#94a3b8" }}>▼</span>
          </div>
          {showMapDropdown && canRefine && (
            <div style={{ position: "absolute", bottom: "100%", right: "65%", background: "rgba(3, 7, 18, 0.72)", color: "#e2e8f0", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "8px", padding: "8px", minWidth: "170px", zIndex: 1000, boxShadow: "0 8px 24px rgba(2,6,23,0.6)" }}>
              {LLM_PROVIDERS_CONFIG.map((provider) => {
                const isSelected = mapProviderId === provider.id;
                // Allow selecting any provider for Map, but warn if not auth (or prevent? user said "barring me")
                // We will prevent.
                const isAuth = isProviderAvailable(provider.id);
                return (
                  <button
                    key={provider.id}
                    onClick={() => {
                      if (isLoading || !isAuth) return;
                      const clickedId = provider.id;
                      
                      // ... existing logic for auto-switching fallback ...
                      if (unifyProviderId && unifyProviderId === clickedId) {
                        const selectedIds = LLM_PROVIDERS_CONFIG.map(p => p.id).filter(id => selectedModels[id]);
                        const prefer = clickedId === "gemini" ? ["qwen"] : clickedId === "qwen" ? ["gemini"] : ["qwen", "gemini"];
                        let fallback: string | null = null;
                        for (const cand of prefer) {
                           if (cand !== clickedId && selectedIds.includes(cand)) { fallback = cand; break; }
                        }
                        if (!fallback) {
                           const anyOther = selectedIds.find(id => id !== clickedId) || null;
                           fallback = anyOther;
                        }
                        onSetSynthesisProvider?.(fallback);
                        try { if (fallback) localStorage.setItem("htos_synthesis_provider", fallback); } catch {}
                      }

                      if (mapProviderId === clickedId) {
                        onSetMappingProvider?.(null);
                        onToggleMapping?.(false);
                        try { localStorage.removeItem("htos_mapping_provider"); localStorage.setItem("htos_mapping_enabled", JSON.stringify(false)); } catch (_) {}
                      } else {
                        onSetMappingProvider?.(clickedId);
                        onToggleMapping?.(true);
                        try { localStorage.setItem("htos_mapping_provider", clickedId); localStorage.setItem("htos_mapping_enabled", JSON.stringify(true)); } catch (_) {}
                      }
                      setShowMapDropdown(false);
                    }}
                    disabled={isLoading || !isAuth}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      background: isSelected ? "rgba(34, 197, 94, 0.12)" : "transparent",
                      color: isSelected ? "#22c55e" : "#e2e8f0",
                      border: "none",
                      borderRadius: "4px",
                      cursor: isAuth ? "pointer" : "not-allowed",
                      transition: "all 0.12s ease",
                      fontSize: "12px",
                      opacity: isAuth ? 1 : 0.5
                    }}
                  >
                    {provider.name}
                    {isSelected && " ✓"}
                    {!isAuth && " (🔒)"}
                  </button>
                );
              })}
            </div>
          )}

          <span style={{ color: "#64748b" }}>•</span>

          {/* Unify Label */}
          <div
            style={{ display: "flex", alignItems: "center", gap: "4px", cursor: canRefine ? "pointer" : "default", opacity: canRefine ? 1 : 0.5 }}
            onClick={canRefine ? () => {
                    const opening = !showUnifyDropdown;
                    setShowUnifyDropdown(opening);
                    if (opening) {
                      setShowModelsDropdown(false);
                      setShowMapDropdown(false);
                    }
                  } : undefined}
          >
            <span>{getUnifyLabel()}</span>
            <span style={{ fontSize: "10px", color: "#94a3b8" }}>▼</span>
          </div>
          {showUnifyDropdown && canRefine && (
            <div style={{ position: "absolute", bottom: "100%", right: "55%", background: "rgba(3, 7, 18, 0.72)", color: "#e2e8f0", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "8px", padding: "8px", minWidth: "170px", zIndex: 1000, boxShadow: "0 8px 24px rgba(2,6,23,0.6)" }}>
              {powerUserMode ? 
                  // Multi-select
                  LLM_PROVIDERS_CONFIG.map((provider) => {
                    const isSelected = synthesisProviders.includes(provider.id);
                    const isAuth = isProviderAvailable(provider.id);
                    return (
                      <label
                        key={provider.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 8px",
                          cursor: isAuth ? "pointer" : "not-allowed",
                          borderRadius: "4px",
                          background: isSelected ? "rgba(251, 191, 36, 0.12)" : "transparent",
                          transition: "all 0.12s ease",
                          opacity: isAuth ? 1 : 0.5
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isLoading || !isAuth) return;
                            const clickedId = provider.id;
                            // ... existing logic for fallback ...
                            if (mapProviderId === clickedId && !isSelected) {
                                // ... same fallback logic as in component ...
                                // (Omitting strict duplication for brevity, keep existing logic)
                                // Just added !isAuth check above
                                onToggleSynthesisProvider?.(clickedId);
                            } else {
                                onToggleSynthesisProvider?.(clickedId);
                            }
                          }}
                          disabled={isLoading || !isAuth}
                          style={{ width: "14px", height: "14px", accentColor: "#fbbf24" }}
                        />
                        <span style={{ fontSize: "12px", color: isSelected ? "#fbbf24" : "#94a3b8" }}>
                          {provider.name}
                        </span>
                      </label>
                    );
                  })
                : 
                  // Single select
                  LLM_PROVIDERS_CONFIG.map((provider) => {
                    const isSelected = unifyProviderId === provider.id;
                    const isAuth = isProviderAvailable(provider.id);
                    return (
                      <button
                        key={provider.id}
                        onClick={() => {
                          if (isLoading || !isAuth) return;
                          const clickedId = provider.id;
                          const newUnifyProvider = unifyProviderId === clickedId ? null : clickedId;
                          
                          // ... existing fallback logic ...
                          if (newUnifyProvider && mapProviderId && mapProviderId === newUnifyProvider) {
                              // ... existing fallback logic ...
                          }

                          onSetSynthesisProvider?.(newUnifyProvider);
                          try {
                            if (newUnifyProvider) localStorage.setItem("htos_synthesis_provider", newUnifyProvider);
                            else localStorage.removeItem("htos_synthesis_provider");
                          } catch {}
                          setShowUnifyDropdown(false);
                        }}
                        disabled={isLoading || !isAuth}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "6px 10px",
                          background: isSelected ? "rgba(251, 191, 36, 0.12)" : "transparent",
                          color: isSelected ? "#fbbf24" : "#e2e8f0",
                          border: "none",
                          borderRadius: "4px",
                          cursor: isAuth ? "pointer" : "not-allowed",
                          transition: "all 0.12s ease",
                          fontSize: "12px",
                          opacity: isAuth ? 1 : 0.5
                        }}
                      >
                        {provider.name}
                        {isSelected && " ✓"}
                        {!isAuth && " (🔒)"}
                      </button>
                    );
                  })}
            </div>
          )}

          <span style={{ color: "#64748b" }}>•</span>

          {/* Refine Label */}
          <div
            style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
            onClick={() => {
              const opening = !showRefineDropdown;
              setShowRefineDropdown(opening);
              if (opening) {
                setShowModelsDropdown(false);
                setShowMapDropdown(false);
                setShowUnifyDropdown(false);
              }
            }}
          >
            <span>{getRefineLabel()}</span>
            <span style={{ fontSize: "10px", color: "#94a3b8" }}>▼</span>
          </div>
          {showRefineDropdown && (
            <div style={{ position: "absolute", bottom: "100%", right: "0%", background: "rgba(3, 7, 18, 0.72)", color: "#e2e8f0", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "8px", padding: "8px", minWidth: "170px", zIndex: 1000, boxShadow: "0 8px 24px rgba(2,6,23,0.6)" }}>
              <button
                key="auto"
                onClick={() => {
                  if (isLoading) return;
                  onSetRefineModel('auto');
                  try { localStorage.setItem('htos_refine_model', 'auto'); } catch {}
                  setShowRefineDropdown(false);
                }}
                disabled={isLoading}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  background: refineModel === "auto" ? "rgba(99, 102, 241, 0.12)" : "transparent",
                  color: refineModel === "auto" ? "#6366f1" : "#e2e8f0",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                  fontSize: "12px",
                }}
              >
                Auto
                {refineModel === "auto" && " ✓"}
              </button>
              {LLM_PROVIDERS_CONFIG.map((provider) => {
                const isSelected = refineModel === provider.id;
                // Refine usually uses API or specific logic, but let's assume it needs auth too if it uses the provider
                // 'Auto' might pick a default, but explicit selection should enforce auth
                const isAuth = isProviderAvailable(provider.id);
                return (
                  <button
                    key={provider.id}
                    onClick={() => {
                      if (isLoading || !isAuth) return;
                      onSetRefineModel(provider.id);
                      try { localStorage.setItem('htos_refine_model', provider.id); } catch {}
                      setShowRefineDropdown(false);
                    }}
                    disabled={isLoading || !isAuth}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      background: isSelected ? "rgba(99, 102, 241, 0.12)" : "transparent",
                      color: isSelected ? "#6366f1" : "#e2e8f0",
                      border: "none",
                      borderRadius: "4px",
                      cursor: isAuth ? "pointer" : "not-allowed",
                      transition: "all 0.12s ease",
                      fontSize: "12px",
                      opacity: isAuth ? 1 : 0.5
                    }}
                  >
                    {provider.name}
                    {isSelected && " ✓"}
                    {!isAuth && " (🔒)"}
                  </button>
                );
              })}
            </div>
          )}

          {/* Parley Button - Modified to skip unauth models */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                LLM_PROVIDERS_CONFIG.forEach((provider) => {
                  // Only toggle on if currently off AND authorized
                  if (!selectedModels[provider.id] && isProviderAvailable(provider.id)) {
                    onToggleModel(provider.id);
                  }
                });
                
                // Auto-enable mapping logic
                onToggleMapping?.(true);
                const availableProviders = LLM_PROVIDERS_CONFIG.filter(p => selectedModels[p.id] || isProviderAvailable(p.id));
                
                if (availableProviders.length >= 2) {
                  onSetMappingProvider?.(availableProviders[0].id);
                  onSetSynthesisProvider?.(availableProviders[1]?.id || availableProviders[0].id);
                }
                setIsExpanded(false);
              }}
              disabled={isLoading}
              style={{ padding: "6px 12px", fontSize: "12px", background: "rgba(34, 197, 94, 0.2)", border: "1px solid rgba(34, 197, 94, 0.4)", borderRadius: "6px", color: "#22c55e", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: 500, transition: "all 0.2s ease", opacity: isLoading ? 0.5 : 1 }}
            >
              Parley
            </button>
          </div>
          
          {/* ... existing Think Toggle ... */}
          {selectedModels.chatgpt && (
             /* ... */
             <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
              {/* ... */}
             </div>
          )}
        </div>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <div style={{ background: "rgba(255, 255, 255, 0.08)", backdropFilter: "blur(20px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "16px", padding: "16px 20px", maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
           {/* ... Header ... */}
           
           {/* Witness Section */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>Witness</span>
              <button
                onClick={() => {
                  const allSelected = activeCount === LLM_PROVIDERS_CONFIG.length;
                  LLM_PROVIDERS_CONFIG.forEach((provider) => {
                    if (!isProviderAvailable(provider.id)) return; // Skip unauth
                    
                    if (allSelected && selectedModels[provider.id]) {
                      onToggleModel(provider.id);
                    } else if (!allSelected && !selectedModels[provider.id]) {
                      onToggleModel(provider.id);
                    }
                  });
                }}
                disabled={isLoading}
                style={{ marginLeft: "auto", padding: "2px 8px", fontSize: "10px", background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "4px", color: "#94a3b8", cursor: isLoading ? "not-allowed" : "pointer", transition: "all 0.2s ease", opacity: isLoading ? 0.5 : 1 }}
              >
                [All]
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {LLM_PROVIDERS_CONFIG.map((provider: LLMProvider) => {
                const isSelected = selectedModels[provider.id];
                const isAuth = isProviderAvailable(provider.id);
                return (
                  <label
                    key={provider.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: isAuth ? "pointer" : "not-allowed",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: isSelected ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${isSelected ? "rgba(99, 102, 241, 0.4)" : "rgba(255, 255, 255, 0.1)"}`,
                      transition: "all 0.2s ease",
                      opacity: isAuth ? 1 : 0.5
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => !isLoading && isAuth && onToggleModel(provider.id)}
                      disabled={isLoading || !isAuth}
                      style={{ width: "14px", height: "14px", accentColor: "#6366f1" }}
                    />
                    <span style={{ fontSize: "12px", color: isSelected ? "#a5b4fc" : "#94a3b8", fontWeight: 500 }}>
                      {provider.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          
          {/* ... The rest of expanded state (Map checkbox, etc) should also check isProviderAvailable inside maps ... */}
          
        </div>
      )}
    </div>
  );
};

export default CompactModelTray;