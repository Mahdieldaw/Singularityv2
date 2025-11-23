import React, { useState } from "react";
import { useAtom } from "jotai";
import { refinerDataAtom, isRefinerOpenAtom, chatInputValueAtom } from "../state/atoms";
import { useChat } from "../hooks/useChat";

interface RefinerBlockProps {
    showAudit?: boolean;
    showVariants?: boolean;
    showExplanation?: boolean;
}

export default function RefinerBlock({ showAudit = false, showVariants = false, showExplanation = false }: RefinerBlockProps) {
    const [refinerData, setRefinerData] = useAtom(refinerDataAtom);
    const [isOpen, setIsOpen] = useAtom(isRefinerOpenAtom);
    const [, setChatInputValue] = useAtom(chatInputValueAtom);
    const { sendMessage } = useChat();

    if (!isOpen || !refinerData) {
        return null;
    }

    const handleVariantClick = (variant: string) => {
        // Use variant as the prompt
        sendMessage(variant, "new");
        setIsOpen(false);
        setRefinerData(null);
        setChatInputValue("");
    };

    return (
        <div
            style={{
                width: "100%",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                animation: "slideUp 0.3s ease-out",
            }}
        >
            {/* Collapsible Sections */}
            {(showAudit || showVariants || showExplanation) && (
                <div
                    style={{
                        backgroundColor: "rgba(15, 17, 23, 0.6)", // Darker background for contrast
                        padding: "16px 20px",
                        fontSize: "14px",
                    }}
                >
                    {showExplanation && refinerData.explanation && (
                        <div style={{ marginBottom: (showAudit || showVariants) ? "16px" : "0" }}>
                            <div
                                style={{
                                    color: "#3b82f6",
                                    fontWeight: 600,
                                    marginBottom: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                }}
                            >
                                <span>🧠</span> Explanation
                            </div>
                            <div style={{ color: "#cbd5e1", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                                {refinerData.explanation}
                            </div>
                        </div>
                    )}

                    {showAudit && refinerData.audit && (
                        <div style={{ marginBottom: showVariants ? "16px" : "0" }}>
                            <div
                                style={{
                                    color: "#f59e0b",
                                    fontWeight: 600,
                                    marginBottom: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                }}
                            >
                                <span>🧐</span> Audit
                            </div>
                            <div style={{ color: "#cbd5e1", lineHeight: "1.5" }}>
                                {refinerData.audit}
                            </div>
                        </div>
                    )}

                    {showVariants && refinerData.variants && refinerData.variants.length > 0 && (
                        <div>
                            <div
                                style={{
                                    color: "#8b5cf6",
                                    fontWeight: 600,
                                    marginBottom: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                }}
                            >
                                <span>🔀</span> Variants
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {refinerData.variants.map((variant, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleVariantClick(variant)}
                                        style={{
                                            textAlign: "left",
                                            padding: "10px 12px",
                                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                                            border: "1px solid rgba(255, 255, 255, 0.1)",
                                            borderRadius: "8px",
                                            color: "#e2e8f0",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            lineHeight: "1.4",
                                            transition: "all 0.2s",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                                            e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.4)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                                            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                                        }}
                                    >
                                        {variant}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
