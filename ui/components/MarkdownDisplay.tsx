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
    <div className="relative bg-surface-code border border-border-subtle rounded-lg my-3 overflow-hidden">
      {/* Header / Language Label */}
      {language && (
        <div className="absolute top-0 left-0 px-2 py-0.5 text-[10px] uppercase text-text-muted bg-surface-modal/50 rounded-br pointer-events-none z-[1]">
          {language}
        </div>
      )}

      {/* Code Content */}
      <div className="m-0 overflow-x-auto pt-7 px-3 pb-3">
        {/* We render children (the <code> tag) directly here */}
        <pre className="m-0 font-[inherit] bg-transparent">
          {children}
        </pre>
      </div>

      {/* Action Buttons */}
      <div className="absolute top-1.5 right-1.5 flex gap-1.5 z-[2]">
        <button
          onClick={handleCopy}
          title="Copy"
          className={`inline-flex items-center gap-1 px-1.5 mx-0.5 bg-chip-active border border-border-brand rounded-pill text-text-primary text-sm font-bold leading-snug cursor-pointer no-underline transition-all
                      ${copied ? 'text-intent-success' : 'text-text-muted'}`}
        >
          {copied ? "✓" : "📋"}
        </button>
        <button
          onClick={handleDownload}
          title="Download"
          className="bg-border-subtle border border-border-subtle rounded-md px-2 py-1
                     text-text-muted text-xs cursor-pointer"
        >
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
        className="bg-chip-soft text-text-primary rounded border border-border-subtle
                   px-1 py-0.5 font-mono font-medium whitespace-pre-wrap break-words inline"
        {...props}
      >
        {children}
      </code>
    );
  }

  // IF BLOCK (Inside Pre): Just render clean text logic, parent <PreBlock> handles the box
  return (
    <code
      className="text-sm leading-relaxed block font-mono whitespace-pre"
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

const MarkdownDisplay: React.FC<MarkdownDisplayProps> = React.memo(
  ({ content, components = {} }) => {
    return (
      <div className="markdown-body text-[16px] leading-relaxed text-text-primary">
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
                  <span className="inline m-0">
                    {children}
                    <span className="inline-block w-[0.3em]"></span>
                  </span>
                );
              }
              return (
                <div className="mb-4 mt-2">
                  {children}
                </div>
              );
            },
            ul: ({ children }) => <ul className="pl-5 mb-4 list-disc">{children}</ul>,
            ol: ({ children }) => <ol className="pl-5 mb-4 list-decimal">{children}</ol>,
            li: ({ children }) => (
              <ListContext.Provider value={true}>
                <li className="mb-1">{children}</li>
              </ListContext.Provider>
            ),
            h1: ({ children }) => <h1 className="text-xl font-semibold mt-2 mb-2 text-text-primary">{children}</h1>,
            h2: ({ children }) => <h2 className="text-[17px] font-semibold mt-2 mb-2 text-text-primary">{children}</h2>,
            h3: ({ children }) => <h3 className="text-[16px] font-semibold mt-2 mb-2 text-text-primary">{children}</h3>,
            blockquote: ({ children }) => <blockquote className="border-l-4 border-border-subtle pl-4 ml-0 text-text-muted italic">{children}</blockquote>,

            // --- TABLE STYLING (Restored) ---
            table: ({ children }) => (
              <div className="overflow-x-auto my-4">
                <table className="w-full border-collapse text-[16px] text-text-primary">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-chip-soft">{children}</thead>,
            tbody: ({ children }) => <tbody>{children}</tbody>,
            tr: ({ children }) => <tr className="border-b border-border-subtle">{children}</tr>,
            th: ({ children }) => (
              <th className="px-3 py-2 text-left font-semibold text-text-secondary border-b border-border-subtle">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 align-top text-text-primary border-b border-border-subtle">
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
  },
  (prev, next) => prev.content === next.content
);

export default MarkdownDisplay;