/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PHASE D — Narrative generation (executive summary + BEI/STAR interview
 * questions for the top 3). This is the ONLY step where the LLM is asked to
 * write prose, and it happens AFTER scores are already finalized by
 * scoringEngine.ts. The model is given the already-computed rankings as
 * fixed context — it cannot change anyone's score here, only describe it.
 * Minor wording variation across runs is acceptable for this step because
 * it never affects who ranks where.
 */

import { Type } from "@google/genai";
import { callStructuredGemini } from "./geminiClient";
import { NarrativeResponseSchema, type JobRequirements, type NarrativeResponse, type RankedCandidateOutput } from "./schemas";
import type { CandidateProfile } from "./schemas";

const SYSTEM_PROMPT = `You are a Senior Executive Talent Acquisition Partner with 15+ years of hiring experience, writing up the results of a screening that has ALREADY been scored and ranked by objective criteria. Your job now is ONLY to communicate those results clearly — you must NOT change, second-guess, or imply different scores than what is given to you.

EXECUTIVE SUMMARY (analysisSummary):
- Must start with exactly this sentence pattern: "This screening evaluates candidate suitability for the [Target Job Position] position." (insert the actual target position given).
- Never describe the candidate pool by their current profession (e.g. never say "The candidate pool consists of..."). The job position is always the subject, candidates are supporting evidence.
- Then explain: overall suitability distribution, major strengths and gaps relative to the role, any transferable-experience findings worth highlighting, and an overall hiring recommendation.
- Base every claim strictly on the ranking data and profiles given to you. Do not invent facts not present in the input.

TOP 3 (top3):
- For each of the top 3 candidates given, write a "suitabilitySummary" explaining what makes them strong for this role, grounded in their actual strengths/profile data provided.
- Generate 3-4 specific, non-generic Behavioral Event Interview (BEI/STAR) questions per candidate. Each question must reference specific achievements, roles, or companies from their actual profile data. For each question, provide "whatToLookFor" — concrete guidance on what a strong STAR-structured answer should contain.

Return ONLY JSON matching the required schema.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    analysisSummary: { type: Type.STRING },
    top3: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          candidateId: { type: Type.STRING },
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          suitabilitySummary: { type: Type.STRING },
          beiQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                whatToLookFor: { type: Type.STRING },
              },
              required: ["question", "whatToLookFor"],
            },
          },
        },
        required: ["candidateId", "name", "score", "suitabilitySummary", "beiQuestions"],
      },
    },
  },
  required: ["analysisSummary", "top3"],
};

export async function generateNarrative(
  job: JobRequirements,
  allRankings: RankedCandidateOutput[],
  top3Profiles: CandidateProfile[]
): Promise<NarrativeResponse> {
  const rankingSummary = allRankings
    .map(
      (r, idx) =>
        `#${idx + 1} ${r.name} (candidateId=${r.candidateId}) — score ${r.score}/100. Strengths: ${
          r.strengths.join("; ") || "none recorded"
        }. Gaps: ${r.gaps.join("; ") || "none recorded"}.`
    )
    .join("\n");

  const top3Detail = top3Profiles
    .map(
      (p) => `--- ${p.name} (candidateId=${p.candidateId}) ---
Total experience: ${p.totalYearsExperience} years
Timeline: ${p.timeline.map((t) => `${t.role} at ${t.company} (${t.ownershipLevel})`).join(" | ") || "n/a"}
Verified skills: ${p.skillEvidence.filter((s) => s.verified).map((s) => s.skill).join(", ") || "none"}
Measurable achievements: ${p.measurableAchievements.join("; ") || "none"}`
    )
    .join("\n\n");

  const userPrompt = `TARGET JOB POSITION: ${job.targetPosition} (Seniority: ${job.seniorityLevel})

FULL RANKING (already finalized — do not alter or re-derive these scores):
${rankingSummary}

TOP 3 DETAILED PROFILES (for writing suitabilitySummary + BEI questions):
${top3Detail}`;

  return callStructuredGemini({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseSchema: RESPONSE_SCHEMA,
    zodSchema: NarrativeResponseSchema,
    thinkingLevel: "MEDIUM",
  });
}
