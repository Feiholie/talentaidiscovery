/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PHASE A — Convert free-text position criteria into ONE structured hiring
 * model that every candidate will be measured against identically. Doing
 * this once, up front, guarantees all candidates in the same batch are
 * judged by the exact same yardstick — in the old design, the "meaning" of
 * the job criteria was silently re-interpreted inside the same reasoning
 * pass as each candidate's scoring, with no guarantee of consistency.
 */

import { Type } from "@google/genai";
import { callStructuredGemini } from "./geminiClient";
import { JobRequirementsSchema, type JobRequirements } from "./schemas";

const SYSTEM_PROMPT = `You are a Senior Executive Talent Acquisition Partner with 15+ years of hiring experience.

Your ONLY task right now is to convert a free-text position/criteria description into a structured internal hiring model. Do NOT evaluate any candidates yet — that happens in a later step.

Rules:
- "mustHaveSkills" are competencies/qualifications that are explicitly required or clearly non-negotiable given the role (e.g. a stated minimum years of experience, a required certification, a core technology explicitly named as required). Mark isHardRequirement=true ONLY for genuine dealbreakers — things that would disqualify an otherwise strong candidate if missing entirely. Most skills should be isHardRequirement=false even if important, unless the text signals they are truly mandatory (e.g. "must have", "required", "non-negotiable", a specific certification/license, or a minimum years figure).
- "niceToHaveSkills" are competencies that add value but are not disqualifying if absent.
- Apply functional equivalence: think in terms of work activities and responsibilities, not exact keyword wording (e.g. "Created Job Advertisements" is equivalent to "Recruitment Marketing"). Reflect this by naming requirements at the level of the underlying competency, not narrow jargon.
- "transferableDomains" should list adjacent roles/industries whose experience is reasonably transferable to this position (e.g. for a recruiter role: "Engineering Manager", "Retail Supervisor", "Project Manager" type backgrounds that involve hiring, people management, or process ownership).
- "minYearsExperience" should be your best-faith reading of the minimum relevant experience implied by the text. Use 0 if none is implied.
- Do not invent requirements that aren't reasonably implied by the given text.

Return ONLY JSON matching the required schema.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    targetPosition: { type: Type.STRING },
    seniorityLevel: { type: Type.STRING },
    minYearsExperience: { type: Type.NUMBER },
    mustHaveSkills: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          isHardRequirement: { type: Type.BOOLEAN },
        },
        required: ["name", "isHardRequirement"],
      },
    },
    niceToHaveSkills: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          isHardRequirement: { type: Type.BOOLEAN },
        },
        required: ["name", "isHardRequirement"],
      },
    },
    keyResponsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
    transferableDomains: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["targetPosition", "seniorityLevel", "minYearsExperience", "mustHaveSkills"],
};

export async function extractJobRequirements(positionCriteria: string): Promise<JobRequirements> {
  const userPrompt = `Position/Criteria:\n"""\n${positionCriteria}\n"""`;

  return callStructuredGemini({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseSchema: RESPONSE_SCHEMA,
    zodSchema: JobRequirementsSchema,
    // This single call sets the reference standard for the whole batch, so
    // it's worth spending more reasoning budget on getting it right.
    thinkingLevel: "HIGH",
  });
}
