import React, { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// --- 1. HELPER: Language Extractor ---
const ListContext = React.createContext(false);

function getLanguageFromClass(className: string): string {
  const match = /language-([a-zA-Z0-9+#]+)/.exec(String(className || ""));
  return match ? match[1] : "";
}

function languageToExt(lang: string): string {
  switch (String(lang).toLowerCase()) {
    case "js": case "javascript": return "js";
    case "ts": case "typescript": return "ts";
    case "tsx": return "tsx";
    case "jsx": return "jsx";
    case "py": case "python": return "py";
    case "json": return "json";
    case "go": case "golang": return "go";
    case "java": return "java";
    case "ruby": case "rb": return "rb";
    case "bash": case "sh": return "sh";
    case "markdown": case "md": return "md";
    case "yaml": case "yml": return "yml";
    case "html": return "html";
    case "css": return "css";
    case "scss": return "scss";
    case "c": return "c";
    case "cpp": case "c++": return "cpp";
    case "csharp": case "cs": return "cs";
    case "php": return "php";
    case "rust": case "rs": return "rs";
    case "kotlin": case "kt": return "kt";
    case "swift": return "swift";
    default: return "txt";
  }
}

// --- 2. PRE BLOCK (The Container / Card) ---
// Only Triple-Backtick code blocks get wrapped in <pre>.
// This ensures inline code NEVER gets the buttons or box style.
const PreBlock = ({ children }: any) => {
  // Extract the code text and language from the inner <code> element
  const codeElement = React.Children.toArray(children).find(
    (child: any) => child.props && child.props.className
  ) as React.ReactElement | undefined;

  const className = codeElement?.props?.className || "";
  const codeText = String(codeElement?.props?.children || "").replace(/\n$/, "");
  const language = getLanguageFromClass(className);

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  }, [codeText]);

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([codeText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snippet.${languageToExt(language)}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); try { document.body.removeChild(a); } catch { } }, 0);
    } catch { }
  }, [codeText, language]);

  return (
    <div style={{ position: "relative", background: "#0b1220", border: "1px solid #334155", borderRadius: 8, margin: "12px 0", overflow: 'hidden' }}>
      {/* Header / Language Label */}
      {language && (
        <div style={{ position: "absolute", top: 0, left: 0, padding: "2px 8px", fontSize: "10px", textTransform: "uppercase", color: "#94a3b8", background: "rgba(30, 41, 59, 0.5)", borderBottomRightRadius: "4px", pointerEvents: "none", zIndex: 1 }}>
          {language}
        </div>
      )}

      {/* Code Content */}
      <div style={{ margin: 0, overflowX: "auto", padding: "28px 12px 12px 12px" }}>
        {/* We render children (the <code> tag) directly here */}
        <pre style={{ margin: 0, fontFamily: 'inherit', background: 'transparent' }}>
          {children}
        </pre>
      </div>

      {/* Action Buttons */}
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 6, zIndex: 2 }}>
        <button onClick={handleCopy} title="Copy" style={{ background: "#334155", border: "1px solid #475569", borderRadius: 6, padding: "4px 8px", color: copied ? "#4ade80" : "#94a3b8", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}>
          {copied ? "✓" : "📋"}
        </button>
        <button onClick={handleDownload} title="Download" style={{ background: "#334155", border: "1px solid #475569", borderRadius: 6, padding: "4px 8px", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
          ⬇️
        </button>
      </div>
    </div>
  );
};

// --- 3. CODE COMPONENT (The Text Style) ---
const CodeText = ({ inline, className, children, ...props }: any) => {
  // IF INLINE (Single Backtick): Render the small bubble style
  if (inline) {
    return (
      <code
        className={className}
        style={{
          background: "rgba(30, 41, 59, 0.6)",
          color: "#e2e8f0",
          borderRadius: "4px",
          padding: "2px 5px",
          fontFamily: "monospace",
          fontSize: "0.9em",
          border: "1px solid rgba(71, 85, 105, 0.4)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          display: "inline", // Force inline display
        }}
        {...props}
      >
        {children}
      </code>
    );
  }

  // IF BLOCK (Inside Pre): Just render clean text logic, parent <PreBlock> handles the box
  return (
    <code
      className={className}
      style={{ fontSize: 13, lineHeight: '1.5', display: 'block', fontFamily: 'monospace', whiteSpace: 'pre' }}
      {...props}
    >
      {children}
    </code>
  );
};

// --- 4. MAIN EXPORT ---
interface MarkdownDisplayProps {
  content: string;
  components?: Record<string, React.ElementType>;
}

const MarkdownDisplay: React.FC<MarkdownDisplayProps> = ({ content, components = {} }) => {
  return (
    <div className="markdown-body" style={{ fontSize: "14px", lineHeight: "1.6", color: "#e2e8f0" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Separate Block vs Inline logic explicitly
          pre: PreBlock,
          code: CodeText,

          // Crash Fix: Map paragraphs to divs (or spans in lists)
          p: ({ children }) => {
            const inList = React.useContext(ListContext);
            if (inList) {
              // Force inline rendering for list items to prevent vertical stacking
              return (
                <span style={{ display: 'inline', margin: 0 }}>
                  {children}
                  <span style={{ display: 'inline-block', width: '0.3em' }}></span>
                </span>
              );
            }
            return (
              <div style={{ marginBottom: "1em", marginTop: "0.5em" }}>
                {children}
              </div>
            );
          },
          ul: ({ children }) => <ul style={{ paddingLeft: "20px", marginBottom: "1em", listStyleType: "disc" }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: "20px", marginBottom: "1em", listStyleType: "decimal" }}>{children}</ol>,
          li: ({ children }) => (
            <ListContext.Provider value={true}>
              <li style={{ marginBottom: "0.25em" }}>{children}</li>
            </ListContext.Provider>
          ),
          h1: ({ children }) => <h1 style={{ fontSize: '1.5em', fontWeight: 'bold', marginTop: '0.5em', marginBottom: '0.5em', color: '#f1f5f9' }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: '1.3em', fontWeight: 'bold', marginTop: '0.5em', marginBottom: '0.5em', color: '#f1f5f9' }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '1.1em', fontWeight: 'bold', marginTop: '0.5em', marginBottom: '0.5em', color: '#f1f5f9' }}>{children}</h3>,
          blockquote: ({ children }) => <blockquote style={{ borderLeft: "4px solid #475569", paddingLeft: "1em", marginLeft: 0, color: "#94a3b8", fontStyle: "italic" }}>{children}</blockquote>,

          // --- TABLE STYLING (Restored) ---
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '1em 0' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead style={{ background: 'rgba(255,255,255,0.05)' }}>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{children}</tr>,
          th: ({ children }) => (
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#f1f5f9' }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>
              {children}
            </td>
          ),
          ...components,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownDisplay;