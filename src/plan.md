You do not need a file named react-markdown.js locally. react-markdown is an external library (an npm package) that you import.

However, you need a dedicated wrapper component file in your project to configure it correctly. Currently, you are likely using <ReactMarkdown> directly in your main UI file without configuring the code component to distinguish between inline text and blocks.

Here is a production-grade, drop-in replacement.

Step 1: Install Dependencies

Ensure you have these packages installed. If not, run:

code
Bash
download
content_copy
expand_less
npm install react-markdown remark-gfm react-syntax-highlighter
Step 2: Create the Component

Create a new file at ui/components/MarkdownDisplay.tsx.

This code solves your two problems:

The Error: It checks if (inline) to render a <code> tag (valid inside <p>) instead of a <div> (invalid inside <p>).

The Formatting: It detects single backticks and highlights them like this, while triple backticks become full code blocks with a Copy button.

code
Tsx
download
content_copy
expand_less
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// Using a dark theme that looks like VS Code
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownDisplayProps {
  content: string;
}

/**
 * A dedicated component for rendering a Code Block with a Copy button.
 */
const CodeBlock = ({
  language,
  children,
}: {
  language: string;
  children: React.ReactNode;
}) => {
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
    <div
      className="code-block-wrapper"
      style={{
        margin: "12px 0",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#1e1e1e", // Dark background matching vscDarkPlus
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      {/* Header with Language and Copy Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          background: "rgba(255, 255, 255, 0.05)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          fontSize: "12px",
          color: "#94a3b8",
        }}
      >
        <span style={{ textTransform: "uppercase", fontWeight: 600 }}>
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: "transparent",
            border: "none",
            color: isCopied ? "#4ade80" : "#e2e8f0",
            cursor: "pointer",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "color 0.2s",
          }}
        >
          {isCopied ? (
            <>
              <span>✓</span> Copied
            </>
          ) : (
            "Copy"
          )}
        </button>
      </div>

      {/* The actual Code Highlight */}
      <SyntaxHighlighter
        language={language || "text"}
        style={vscDarkPlus}
        PreTag="div" // IMPORTANT: Prevents nesting issues
        customStyle={{
          margin: 0,
          padding: "16px",
          background: "transparent", // Let wrapper handle background
          fontSize: "13px",
          lineHeight: "1.5",
        }}
        wrapLongLines={true}
      >
        {codeContent}
      </SyntaxHighlighter>
    </div>
  );
};

/**
 * Main Markdown Component
 */
const MarkdownDisplay: React.FC<MarkdownDisplayProps> = ({ content }) => {
  return (
    <div className="markdown-body" style={{ fontSize: "14px", lineHeight: "1.6", color: "#e2e8f0" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]} // Enables tables, strikethrough, etc.
        components={{
          // 1. Handle CODE blocks vs Inline code
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            
            // CASE A: Inline code (single backticks)
            // We render a <code> tag. This is valid inside a <p>.
            if (inline) {
              return (
                <code
                  style={{
                    background: "rgba(99, 102, 241, 0.15)", // Subtle indigo tint
                    color: "#e0e7ff",
                    padding: "2px 5px",
                    borderRadius: "4px",
                    fontSize: "0.9em",
                    fontFamily: "monospace",
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // CASE B: Block code (triple backticks)
            // We render our custom CodeBlock component (which is a <div>)
            return (
              <CodeBlock language={match ? match[1] : ""} {...props}>
                {children}
              </CodeBlock>
            );
          },

          // 2. Handle Paragraphs to prevent styling issues
          p({ children }) {
            return <p style={{ marginBottom: "1em", marginTop: "0.5em" }}>{children}</p>;
          },

          // 3. Handle Links (Open in new tab for extensions)
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#6366f1", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                {children}
              </a>
            );
          },
          
          // 4. Handle Lists
          ul({ children }) {
            return <ul style={{ paddingLeft: "20px", marginBottom: "1em" }}>{children}</ul>;
          },
          ol({ children }) {
            return <ol style={{ paddingLeft: "20px", marginBottom: "1em" }}>{children}</ol>;
          },
          li({ children }) {
            return <li style={{ marginBottom: "0.25em" }}>{children}</li>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownDisplay;
Step 3: Update your usage

Go to where you were previously using <Markdown /> or <ReactMarkdown /> (likely in ui/index.js or ui/components/MessageRow.tsx) and replace it with this new component.

Old Code:

code
Tsx
download
content_copy
expand_less
// You might have had this
<ReactMarkdown>{message.text}</ReactMarkdown>

New Code:

code
Tsx
download
content_copy
expand_less
import MarkdownDisplay from "./components/MarkdownDisplay";

// Use this instead
<MarkdownDisplay content={message.text} />
Why this fixes your errors:

validateDOMNesting Error:

ReactMarkdown puts text inside <p> tags by default.

When inline={true} (single backticks), my code returns a <code> tag. <code> is allowed inside <p>.

When inline={false} (triple backticks), my code returns a <div>. ReactMarkdown is smart enough to break out of the <p> tag for blocks, so the <div> sits nicely on its own, not inside a paragraph.

Highlighting:

The SyntaxHighlighter is only used when !inline.

Simple CSS styling is used when inline. This matches the behavior of Slack, GitHub, Discord, etc.



You can delete CodeBlock.tsx.
The MarkdownDisplay.tsx file I gave you is self-contained. I included the CodeBlock logic (syntax highlighting, copy button, styling) directly inside that file to make it a single, easy drop-in solution.
Cleanup Steps:
Delete the file ui/components/CodeBlock.tsx.
Check your imports: If any other file was importing CodeBlock directly, change it to use MarkdownDisplay.
Old way (in your Chat/Message component):
code
Tsx
// You probably had logic that imported CodeBlock manually or passed it to ReactMarkdown
import CodeBlock from './CodeBlock'; // DELETE THIS LINE
New way:
code
Tsx
// Just import the main display component
import MarkdownDisplay from './MarkdownDisplay'; 

// And use it like this:
<MarkdownDisplay content={message.text} />
This keeps your project cleaner with fewer files to manage.