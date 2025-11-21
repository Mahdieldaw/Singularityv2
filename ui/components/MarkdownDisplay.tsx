import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownDisplayProps {
  content: string;
}

// --- 1. INTERNAL CODE BLOCK COMPONENT ---
const CodeBlock = ({ language, children }: { language: string; children: React.ReactNode }) => {
  const [isCopied, setIsCopied] = useState(false);
  const codeContent = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div className="code-block-wrapper" style={{ margin: "12px 0", borderRadius: "8px", overflow: "hidden", background: "#1e1e1e", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", background: "rgba(255, 255, 255, 0.05)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", fontSize: "12px", color: "#94a3b8" }}>
        <span style={{ textTransform: "uppercase", fontWeight: 600 }}>{language || "text"}</span>
        <button onClick={handleCopy} style={{ background: "transparent", border: "none", color: isCopied ? "#4ade80" : "#e2e8f0", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
          {isCopied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter language={language || "text"} style={vscDarkPlus} PreTag="div" customStyle={{ margin: 0, padding: "16px", background: "transparent", fontSize: "13px", lineHeight: "1.5" }} wrapLongLines={true}>
        {codeContent}
      </SyntaxHighlighter>
    </div>
  );
};

// --- 2. MAIN DISPLAY COMPONENT ---
const MarkdownDisplay: React.FC<MarkdownDisplayProps> = ({ content }) => {
  return (
    <div className="markdown-body" style={{ fontSize: "14px", lineHeight: "1.6", color: "#e2e8f0" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // A. Handle Code Blocks vs Inline
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            if (inline) {
              return (
                <code style={{ background: "rgba(99, 102, 241, 0.15)", color: "#e0e7ff", padding: "2px 5px", borderRadius: "4px", fontSize: "0.9em", fontFamily: "monospace" }} {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match ? match[1] : ""} {...props}>{children}</CodeBlock>;
          },

          // B. Handle Citations (Blue Pills) & Links
          a: (props: any) => {
            const href = props?.href || "";
            const isCitation = typeof href === "string" && href.startsWith("citation:");

            // Regular Link
            if (!isCitation) {
              return <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1", textDecoration: "none" }} />;
            }

            // Citation Pill Styling
            // We keep the href="citation:N" so your Global Hook can find it!
            const numMatch = String(href).match(/(\d+)/);
            const num = numMatch ? numMatch[1] : "?";

            return (
              <a
                {...props}
                href={href} // Keep this for your hook selector: a[href^="citation:"]
                onClick={(e) => e.preventDefault()} // Stop browser nav, let hook handle it
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0px 6px",
                  margin: "0 2px",
                  background: "rgba(30, 64, 175, 0.35)",
                  border: "1px solid #3b82f6",
                  borderRadius: "12px",
                  color: "#bfdbfe",
                  fontSize: "0.85em",
                  fontWeight: 600,
                  textDecoration: "none",
                  cursor: "pointer",
                  userSelect: "none",
                  verticalAlign: "middle"
                }}
              >
                {props.children}
              </a>
            );
          },

          // C. Safe Paragraphs
          p({ children }) {
            return <p style={{ marginBottom: "1em", marginTop: "0.5em" }}>{children}</p>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownDisplay;