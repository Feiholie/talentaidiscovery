/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ============================================================================
 * CENTRALIZED, VALIDATED GEMINI CLIENT
 * ============================================================================
 * Two important, non-obvious findings baked into this file:
 *
 * 1. DETERMINISM STRATEGY FOR gemini-3.5-flash
 *    The intuitive fix for "inconsistent AI output" is to set temperature: 0.
 *    For Gemini 3.x models (including gemini-3.5-flash, which this app uses),
 *    Google explicitly recommends AGAINST setting temperature/topP/topK at
 *    all — these are reasoning models tuned for their default sampling
 *    settings, and forcing temperature=0 does not reliably make them
 *    deterministic (they still have internal "thinking" tokens that vary).
 *    So we deliberately do NOT set temperature here.
 *
 *    Instead, determinism is achieved architecturally: the LLM is only ever
 *    asked to EXTRACT factual, verifiable information (Phase A/B). The
 *    actual 0-100 score is computed afterwards by plain deterministic
 *    TypeScript in scoringEngine.ts. Extraction has much lower run-to-run
 *    variance than an abstract "give me a score" judgment, and — critically
 *    — even that residual variance cannot change the score-computation
 *    logic itself, only the extracted facts. This is the same pattern
 *    real ATS systems use: parse -> structure -> score with rules.
 *
 * 2. VALIDATE, DON'T TRUST
 *    Every structured call is validated against a zod schema. If the model
 *    returns malformed JSON (truncated output, wrong shape, etc.) we send a
 *    single "repair" follow-up with the validation error, then fail loudly
 *    rather than silently proceeding with corrupt data — which is exactly
 *    how the previous version could end up quietly mis-scoring candidates.
 * ============================================================================
 */

import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";

let aiClient: GoogleGenAI | null = null;

export function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Update this in one place if/when Google ships a newer recommended model.
export const MODEL_NAME = "gemini-3.5-flash";

export type ThinkingLevel = "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

interface StructuredCallOptions<T> {
  systemPrompt: string;
  userPrompt: string;
  /** Gemini `responseSchema` (uses `Type.*` from @google/genai) */
  responseSchema: unknown;
  /** zod schema used to validate the parsed JSON before trusting it */
  zodSchema: ZodType<T>;
  thinkingLevel?: ThinkingLevel;
  /** Number of self-repair retries on invalid JSON/schema mismatch (default 1) */
  maxRepairRetries?: number;
  /** Number of retries on transient/rate-limit errors (default 2) */
  maxTransientRetries?: number;
}

function isTransientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /429|RESOURCE_EXHAUSTED|UNAVAILABLE|deadline exceeded|ECONNRESET|ETIMEDOUT/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls Gemini expecting a strict JSON response, validates it against a zod
 * schema, and self-repairs once on validation failure. Throws a descriptive
 * error if the model still can't produce valid output after retries.
 */
export async function callStructuredGemini<T>(opts: StructuredCallOptions<T>): Promise<T> {
  const {
    systemPrompt,
    userPrompt,
    responseSchema,
    zodSchema,
    thinkingLevel = "MEDIUM",
    maxRepairRetries = 1,
    maxTransientRetries = 2,
  } = opts;

  const ai = getAIClient();
  let attemptPrompt = userPrompt;
  let lastValidationError: string | null = null;

  for (let repairAttempt = 0; repairAttempt <= maxRepairRetries; repairAttempt++) {
    let response;
    let transientAttempt = 0;

    // Transient-error retry loop (rate limits / temporary outages)
    while (true) {
      try {
        response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: attemptPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: responseSchema as never,
            thinkingConfig: { thinkingLevel: thinkingLevel as never },
            // Intentionally NOT setting temperature/topP/topK — see file header.
          },
        });
        break;
      } catch (err) {
        if (isTransientError(err) && transientAttempt < maxTransientRetries) {
          transientAttempt++;
          await sleep(500 * 2 ** transientAttempt);
          continue;
        }
        throw err;
      }
    }

    const raw = response.text || "";
    try {
      const parsed = JSON.parse(raw);
      const result = zodSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      lastValidationError = result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    } catch (e) {
      lastValidationError = `Response was not valid JSON: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Prepare a repair prompt: show the model exactly what was wrong.
    attemptPrompt = `${userPrompt}

---
IMPORTANT: Your previous response failed schema validation with this error:
${lastValidationError}

Return ONLY valid JSON that strictly matches the required schema. No markdown
code fences, no commentary, no trailing text — the entire response body must
be a single parseable JSON value.`;
  }

  throw new Error(
    `Gemini structured output failed validation after ${maxRepairRetries + 1} attempt(s): ${lastValidationError}`
  );
}
