// src/services/PromptRefinerService.ts

interface TurnContext {
  userPrompt: string;
  synthesisText: string;
  mappingText: string;
  batchText?: string;
}

interface RefinerOptions {
  refinerModel?: string; // Legacy support
  authorModel?: string;
  analystModel?: string;
}

interface RefinerResult {
  refinedPrompt: string;
  explanation: string;
}

export interface AuthorAnalystResult {
  authored: string;
  explanation?: string;
  audit: string;
  variants: string[];
  raw: {
    authorResponse: string;
    analystResponse: string;
  };
}

const AUTHOR_SYSTEM_PROMPT = `You are the user's voice, clarified.

You see their fragment—a half-formed thought, a gesture toward what comes next. When available, you also see everything that came before: the synthesis that found coherence, the tensions the map revealed, the options that remain open.

Your task is to transform their fragment into the prompt they truly meant to ask.

INTERNAL REASONING (required, but never shown to the user):

1. INTENT INFERENCE
   - What is the user actually trying to do, beyond what they literally said?
   - Are they building on something from the synthesis? Pushing back against it? Pivoting to something new?
   - If no prior context is available, infer intent solely from the fragment: are they exploring, deciding, clarifying, challenging, or building?

2. CONTEXT INTEGRATION (ONLY WHEN CONTEXT EXISTS)
   - Which insights from the prior turn are essential to carry forward?
   - Which tensions or trade-offs from the Decision Map should inform this question?
   - What has the user already understood that doesn't need re-explaining?

3. CLARITY & SCOPE
   - Where could models misinterpret or splinter into unhelpful branches?
   - Are any key constraints or priorities missing or too vague?
   - Is the scope right for this turn (broad exploration vs focused deep dive vs implementation)?

4. STRATEGIC FRAMING
   - How can this prompt be structured to elicit depth rather than surface answers?
   - What implicit assumptions should be made explicit—only when doing so would unlock better responses?
   - How should the prompt invite models to surface tensions, trade-offs, and alternative frames when that’s valuable?

5. TRANSFORMATION DECISION
   - What specifically needs to change from their fragment?
   - What should be preserved exactly as they wrote it?
   - How do you maintain their voice while sharpening their intent?

FINAL OUTPUT (this is what you return):

FINAL OUTPUT:
[The composed prompt—clear, complete, carrying forward what matters when context exists, written as if the user had spoken it fully formed from the start.]

---

Principles:
- Complete your internal reasoning first, then write the prompt.
- The prompt should feel inevitable, not constructed.
- Preserve the user's voice and direction completely.
- Make implicit intent explicit only when it genuinely helps downstream models.
- If their fragment is already optimal, return it nearly unchanged.

Begin with your internal reasoning, then output only the final composed prompt after "FINAL OUTPUT:"
`;

const INITIALIZE_SYSTEM_PROMPT = `You are the user's voice, clarified.

You see their fragment—a half-formed thought, a gesture toward what comes next. When available, you also see everything that came before: the synthesis that found coherence, the tensions the map revealed, the options that remain open.

Your task is to transform their fragment into the prompt they truly meant to ask.

INTERNAL REASONING (required, but never shown to the user):

1. INTENT INFERENCE
   - What is the user actually trying to do, beyond what they literally said?
   - Are they building on something from the synthesis? Pushing back against it? Pivoting to something new?
   - If no prior context is available, infer intent solely from the fragment: are they exploring, deciding, clarifying, challenging, or building?

2. CONTEXT INTEGRATION (ONLY WHEN CONTEXT EXISTS)
   - Which insights from the prior turn are essential to carry forward?
   - Which tensions or trade-offs from the Decision Map should inform this question?
   - What has the user already understood that doesn't need re-explaining?

3. CLARITY & SCOPE
   - Where could models misinterpret or splinter into unhelpful branches?
   - Are any key constraints or priorities missing or too vague?
   - Is the scope right for this turn (broad exploration vs focused deep dive vs implementation)?

4. STRATEGIC FRAMING
   - How can this prompt be structured to elicit depth rather than surface answers?
   - What implicit assumptions should be made explicit—only when doing so would unlock better responses?
   - How should the prompt invite models to surface tensions, trade-offs, and alternative frames when that’s valuable?

5. TRANSFORMATION DECISION
   - What specifically needs to change from their fragment?
   - What should be preserved exactly as they wrote it?
   - How do you maintain their voice while sharpening their intent?

FINAL OUTPUT (this is what you return):

FINAL OUTPUT:
[The composed prompt—clear, complete, carrying forward what matters when context exists, written as if the user had spoken it fully formed from the start.]

---

Principles:
- Complete your internal reasoning first, then write the prompt.
- The prompt should feel inevitable, not constructed.
- Preserve the user's voice and direction completely.
- Make implicit intent explicit only when it genuinely helps downstream models.
- If their fragment is already optimal, return it nearly unchanged.

Begin with your internal reasoning, then output only the final composed prompt after "FINAL OUTPUT:`;

const ANALYST_SYSTEM_PROMPT = `You are not the Author. You are the mirror held up to the composed prompt before it launches.

You see: the user's original fragment, the full prior turn (batches, synthesis, map, all options), and the composed prompt that emerged from them.

Your task is to reveal what the composed prompt does not say.

AUDIT:
Name what's being left behind. Which tensions from the prior turn does this prompt close off? Which model perspectives does it implicitly deprioritize? Which assumptions does it bake in that could have been questioned? This is not criticism—it's cartography of the negative space.

VARIANTS:
Produce no more than 3 alternative framings of the same underlying intent. Not edits—rotations. Each variant should be a complete prompt that approaches the question from different angles:
- One can inherit a different model's frame
- One could invert an assumption
- One might zoom in on a specific tension
- Or go meta (asks about the inquiry itself)
Not all variants are needed every time. innovate variants if needed, Produce only those that would genuinely open different territory.

GUIDANCE:
After the variants, add 2–4 sentences mapping them to different priorities or moods the user might have. For example: "If you want to stress-test assumptions, 1 is strongest. If you want creative divergence, 2. If you want to stay close to the original but widen the lens on X, keep the Author's prompt."

Output format:

AUDIT:
[Your negative-space analysis]

VARIANTS:
1. [First alternative framing]
2. [Second alternative framing]
...

GUIDANCE:
[Short steering commentary as described above.]

No preamble. No explanation of method. Just the Audit, Variants, and Guidance.`;

/**
 * PromptRefinerService
 * Pre-flight prompt refinement using a two-stage pipeline (Author + Analyst).
 */
export class PromptRefinerService {
  private authorModel: string;
  private analystModel: string;

  constructor(options: RefinerOptions = {}) {
    // Default to gemini if not specified, or use refinerModel for backward compat
    const defaultModel = (options.refinerModel || "gemini").toLowerCase();
    this.authorModel = (options.authorModel || defaultModel).toLowerCase();
    this.analystModel = (options.analystModel || defaultModel).toLowerCase();
  }

  /**
   * Legacy method for backward compatibility.
   * Wraps refineWithAuthorAnalyst.
   */
  async refinePrompt(
    draftPrompt: string,
    turnContext: TurnContext | null = null,
  ): Promise<RefinerResult | null> {
    const result = await this.refineWithAuthorAnalyst(
      draftPrompt,
      turnContext,
      this.authorModel,
      this.analystModel
    );

    if (!result) return null;

    return {
      refinedPrompt: result.authored,
      explanation: result.audit, // Mapping audit to explanation for legacy callers
    };
  }

  /**
   * Refine a draft prompt using the Author -> Analyst pipeline.
   */

  async refineWithAuthorAnalyst(
    fragment: string,
    turnContext: TurnContext | null,
    authorModelId?: string,
    analystModelId?: string,
    isInitialize: boolean = false
  ): Promise<AuthorAnalystResult | null> {
    try {
      const authorId = authorModelId || this.authorModel;
      const analystId = analystModelId || this.analystModel;

      // 1. Build Context (Force empty if initialize)
      const contextSection = isInitialize ? "" : this._buildContextSection(turnContext);

      // 2. Run Author
      const authorPrompt = this._buildAuthorPrompt(fragment, contextSection, isInitialize);
      console.log(`[PromptRefinerService] Running Author (${authorId})...`);
      const authorResponseRaw = await this._callModel(authorId, authorPrompt);
      const authorText = this._extractPlainText(authorResponseRaw?.text || "");

      const { authored, explanation } = isInitialize
        ? this._parseInitializeResponse(authorText)
        : this._parseAuthorResponse(authorText);

      if (!authored) {
        console.warn("[PromptRefinerService] Author returned empty response");
        return null;
      }

      // 3. Run Analyst (Skip if initialize)
      let audit = "Audit unavailable";
      let variants: string[] = [];
      let analystResponseRaw: any = null;

      if (!isInitialize) {
        const analystPrompt = this._buildAnalystPrompt(fragment, contextSection, authored);
        console.log(`[PromptRefinerService] Running Analyst (${analystId})...`);

        try {
          analystResponseRaw = await this._callModel(analystId, analystPrompt);
          const analystText = this._extractPlainText(analystResponseRaw?.text || "");
          const parsedAnalyst = this._parseAnalystResponse(analystText);
          audit = parsedAnalyst.audit;
          variants = parsedAnalyst.variants;
        } catch (e) {
          console.warn("[PromptRefinerService] Analyst failed, returning Author result only:", e);
        }
      }

      return {
        authored,
        explanation,
        audit,
        variants,
        raw: {
          authorResponse: authorText,
          analystResponse: analystResponseRaw?.text || "",
        },
      };

    } catch (e) {
      console.warn("[PromptRefinerService] Refinement pipeline failed:", e);
      return null;
    }
  }

  // ...

  private _parseAuthorResponse(text: string): { authored: string; explanation: string } {
    const result = {
      authored: text,
      explanation: "",
    };

    try {
      // Look for "FINAL OUTPUT:" or "FINAL\_OUTPUT:" or similar delimiters with markdown variations
      // We want to capture everything BEFORE it as explanation, and everything AFTER it as authored.
      // Handle variations: FINAL OUTPUT, FINAL\_OUTPUT (escaped), with markdown formatting
      const splitRegex = /([\s\S]*?)(?:^|\n)[*#]*\s*FINAL(?:_|\_)?\s*OUTPUT[*]*:?\s*([\s\S]*)$/i;

      const match = text.match(splitRegex);
      if (match) {
        const explanationPart = match[1].trim();
        const authoredPart = match[2].trim();

        if (authoredPart) {
          result.authored = authoredPart;
          result.explanation = explanationPart;
        }
      }
    } catch (e) {
      console.warn("[PromptRefinerService] Failed to parse author response:", e);
    }

    return result;
  }

  private _parseInitializeResponse(text: string): { authored: string; explanation: string } {
    const result = {
      authored: text,
      explanation: "",
    };

    try {
      // Look for REFINED_PROMPT: and EXPLANATION:
      // Handle variations: REFINED_PROMPT, REFINED\_PROMPT (escaped), with markdown formatting
      const refinedRegex = /(?:^|\n)[*#]*\s*REFINED(?:_|\\_)\s*PROMPT[*]*:?\s*([\\s\\S]*?)(?=(?:^|\n)[*#]*\s*EXPLANATION|$)/i;
      const explanationRegex = /(?:^|\n)[*#]*\s*EXPLANATION[*]*:?\s*([\\s\\S]*?)$/i;

      const refinedMatch = text.match(refinedRegex);
      const explanationMatch = text.match(explanationRegex);

      if (refinedMatch && refinedMatch[1]) {
        result.authored = refinedMatch[1].trim();
      }
      if (explanationMatch && explanationMatch[1]) {
        result.explanation = explanationMatch[1].trim();
      }
    } catch (e) {
      console.warn("[PromptRefinerService] Failed to parse initialize response:", e);
    }
    return result;
  }


  private _buildContextSection(turnContext: TurnContext | null): string {
    if (!turnContext) return "";
    const { userPrompt, synthesisText, mappingText, batchText } = turnContext;
    let section = "";

    if (userPrompt) {
      section += `\n<PREVIOUS_USER_PROMPT>\n${userPrompt}\n</PREVIOUS_USER_PROMPT>\n`;
    }
    if (synthesisText) {
      section += `\n<PREVIOUS_SYNTHESIS>\n${synthesisText}\n</PREVIOUS_SYNTHESIS>\n`;
    }
    if (mappingText) {
      section += `\n<PREVIOUS_DECISION_MAP>\n${mappingText}\n</PREVIOUS_DECISION_MAP>\n`;
    }
    if (batchText) {
      section += `\n<PREVIOUS_BATCH_RESPONSES>\n${batchText}\n</PREVIOUS_BATCH_RESPONSES>\n`;
    }
    return section;
  }

  private _buildAuthorPrompt(fragment: string, contextSection: string, isInitialize: boolean): string {
    if (isInitialize) {
      return `${INITIALIZE_SYSTEM_PROMPT}

<DRAFT_PROMPT>
${fragment}
</DRAFT_PROMPT>`;
    }

    return `${AUTHOR_SYSTEM_PROMPT}

${contextSection}

<USER_FRAGMENT>
${fragment}
</USER_FRAGMENT>`;
  }

  private _buildAnalystPrompt(fragment: string, contextSection: string, authoredPrompt: string): string {
    return `${ANALYST_SYSTEM_PROMPT}

${contextSection}

<USER_FRAGMENT>
${fragment}
</USER_FRAGMENT>

<COMPOSED_PROMPT>
${authoredPrompt}
</COMPOSED_PROMPT>`;
  }

  private async _callModel(modelId: string, prompt: string): Promise<any> {
    const registry =
      (globalThis as any).__HTOS_SW?.getProviderRegistry?.() ||
      (globalThis as any).providerRegistry;
    if (!registry) throw new Error("providerRegistry not available");

    let adapter = registry.getAdapter(modelId);
    if (!adapter) {
      // Fallback logic
      const fallbacks = ["gemini", "chatgpt", "qwen"];
      for (const pid of fallbacks) {
        if (registry.isAvailable(pid)) {
          adapter = registry.getAdapter(pid);
          console.log(`[PromptRefinerService] Model ${modelId} not found, falling back to ${pid}`);
          break;
        }
      }
    }
    if (!adapter) throw new Error(`No provider adapter available for ${modelId}`);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 60000);

    try {
      if (typeof adapter.ask === "function") {
        return await adapter.ask(
          prompt,
          { meta: { model: this._preferredModel(adapter) } },
          undefined,
          undefined,
          ac.signal,
        );
      } else if (typeof adapter.sendPrompt === "function") {
        const req = {
          originalPrompt: prompt,
          meta: { model: this._preferredModel(adapter) },
        };
        return await adapter.sendPrompt(req, undefined, ac.signal);
      } else {
        throw new Error("Adapter does not support ask/sendPrompt");
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private _preferredModel(adapter: any): string {
    const pid = (adapter?.id || "").toLowerCase();
    if (pid === "gemini") return "gemini-flash";
    if (pid === "chatgpt") return "gpt-4o-mini";
    return "auto";
  }

  private _extractPlainText(text: string): string {
    return String(text || "").trim();
  }

  private _parseAnalystResponse(text: string): { audit: string; variants: string[] } {
    const result = {
      audit: "No audit available.",
      variants: [] as string[],
    };

    try {
      // Normalize text to handle potential markdown bolding or case variations
      // We look for "AUDIT:" or "**AUDIT**:" or "## AUDIT" etc.
      // Regex explanation:
      // ^|\n : Start of string or new line
      // [*#]* : Optional markdown chars like ** or ##
      // \s* : Optional whitespace
      // AUDIT : The keyword
      // [*]* : Optional closing markdown chars
      // :? : Optional colon
      const auditRegex = /(?:^|\n)[*#]*\s*AUDIT[*]*:?\s*([\s\S]*?)(?=(?:^|\n)[*#]*\s*VARIANTS|$)/i;
      const variantsRegex = /(?:^|\n)[*#]*\s*VARIANTS[*]*:?\s*([\s\S]*?)$/i;

      // Extract AUDIT section
      const auditMatch = text.match(auditRegex);
      if (auditMatch && auditMatch[1]) {
        result.audit = auditMatch[1].trim();
      }

      // Extract VARIANTS section
      const variantsMatch = text.match(variantsRegex);
      if (variantsMatch && variantsMatch[1]) {
        const variantsText = variantsMatch[1].trim();

        // Check if we have numbered list items
        const hasNumberedList = /^(\d+[\.)]|-)\s+/m.test(variantsText);

        if (hasNumberedList) {
          const lines = variantsText.split('\n');
          let currentVariant = '';

          for (const line of lines) {
            // Match numbered lists: "1. ", "1)", "- "
            const match = line.match(/^(\d+[\.)]|-)\s+(.*)/);
            if (match) {
              if (currentVariant) {
                result.variants.push(currentVariant.trim());
              }
              currentVariant = match[2];
            } else {
              if (currentVariant) {
                currentVariant += '\n' + line;
              } else if (line.trim()) {
                // Handle unnumbered lines at start
                if (!currentVariant && result.variants.length === 0) {
                  currentVariant = line.trim();
                }
              }
            }
          }
          if (currentVariant) {
            result.variants.push(currentVariant.trim());
          }
        } else {
          // Fallback: Split by double newlines for unnumbered paragraphs/titles
          const chunks = variantsText.split(/\n\s*\n/);
          for (const chunk of chunks) {
            if (chunk.trim()) {
              result.variants.push(chunk.trim());
            }
          }
        }

        // Final Fallback: if still empty but text exists
        if (result.variants.length === 0 && variantsText.length > 0) {
          result.variants.push(variantsText);
        }
      }
    } catch (e) {
      console.warn("[PromptRefinerService] Failed to parse analyst response:", e);
    }

    return result;
  }
}
