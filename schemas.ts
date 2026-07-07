/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ============================================================================
 * STRUCTURED DATA CONTRACTS FOR THE SCREENING PIPELINE
 * ============================================================================
 * These schemas are the backbone of the deterministic-scoring redesign.
 *
 * Old design (root cause of inconsistent/wrong scores):
 *   One giant LLM call received the job criteria + ALL candidate CVs at once
 *   and was asked to directly output a final 0-100 "score" per candidate in
 *   the same breath as writing prose summaries. The score was a black-box,
 *   subjective judgment with no audit trail, and — being just one number
 *   picked by the model — was never guaranteed to be the same across two
 *   runs of the exact same input.
 *
 * New design:
 *   1. Extract job criteria into a structured `JobRequirements` object once.
 *   2. Extract each candidate's CV into a structured, evidence-based
 *      `CandidateProfile` (skills WITH proof, timeline, achievements, risk
 *      flags). This is a factual extraction task, not a judgment call.
 *   3. Compute the actual 0-100 score with plain, deterministic TypeScript
 *      (see scoringEngine.ts) using those two structured objects as input.
 *      Same JobRequirements + same CandidateProfile ALWAYS produces the
 *      exact same score, every single time — because it's arithmetic, not
 *      an LLM guess.
 *   4. Only the *narrative* (executive summary, interview questions) is left
 *      to free-form generation, because wording is allowed to vary — the
 *      ranking itself is not.
 *
 * zod is used to validate every LLM JSON response before it's trusted. If
 * validation fails, we retry once with the validation error fed back to the
 * model (self-repair). If it still fails, we fail loudly with a clear error
 * instead of silently proceeding with garbage data.
 * ============================================================================
 */

import { z } from "zod";

// ----------------------------------------------------------------------------
// Phase A: Job Requirements (extracted once per screening run)
// ----------------------------------------------------------------------------

export const RequirementItemSchema = z.object({
  name: z.string().min(1),
  // A hard requirement that is NOT verified in a candidate's CV caps their
  // final score (see scoringEngine.HARD_REQUIREMENT_MISSING_CEILING). This
  // is what "dealbreaker" means in recruiting terms.
  isHardRequirement: z.boolean(),
});
export type RequirementItem = z.infer<typeof RequirementItemSchema>;

export const JobRequirementsSchema = z.object({
  targetPosition: z.string().min(1),
  seniorityLevel: z.string().min(1),
  // Minimum years of relevant experience implied by the criteria. 0 if the
  // criteria don't specify a minimum.
  minYearsExperience: z.number().min(0).max(60),
  mustHaveSkills: z.array(RequirementItemSchema).min(1),
  niceToHaveSkills: z.array(RequirementItemSchema).default([]),
  keyResponsibilities: z.array(z.string()).default([]),
  // Industries/roles the recruiter should treat as transferable rather than
  // penalizing for "wrong industry" (per the functional-equivalence /
  // transferable-experience reasoning from the original prompt, preserved
  // here as structured data instead of buried prose).
  transferableDomains: z.array(z.string()).default([]),
});
export type JobRequirements = z.infer<typeof JobRequirementsSchema>;

// ----------------------------------------------------------------------------
// Phase B: Candidate Profile (extracted per candidate, evidence-based)
// ----------------------------------------------------------------------------

export const SkillEvidenceSchema = z.object({
  skill: z.string().min(1),
  // true ONLY if the CV's work-experience descriptions (not just a skills
  // list) back up the claim with concrete evidence. Unverified skills must
  // not receive credit — this rule from the original prompt is preserved.
  verified: z.boolean(),
  evidenceQuote: z.string().max(220).optional(),
  yearsUsed: z.number().min(0).max(60).optional(),
});
export type SkillEvidence = z.infer<typeof SkillEvidenceSchema>;

export const TimelineEntrySchema = z.object({
  role: z.string(),
  company: z.string(),
  durationMonths: z.number().min(0).max(600).optional(),
  ownershipLevel: z.enum(["led_end_to_end", "contributed", "supporting", "unclear"]),
});
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

export const CandidateProfileSchema = z.object({
  candidateId: z.string().min(1),
  name: z.string().min(1),
  totalYearsExperience: z.number().min(0).max(60),
  timeline: z.array(TimelineEntrySchema).default([]),
  skillEvidence: z.array(SkillEvidenceSchema).default([]),
  measurableAchievements: z.array(z.string()).default([]),
  // e.g. "3 roles in 2 years", "unexplained 8-month gap (2022)"
  stabilityFlags: z.array(z.string()).default([]),
  transferableExperienceNotes: z.array(z.string()).default([]),
  // Set by our own code (never by the LLM) when extraction could not be
  // completed for this candidate, so they are never silently dropped from
  // the ranking — they show up with a score of 0 and a clear explanation.
  extractionFailed: z.boolean().default(false),
});
export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const CandidateProfileBatchSchema = z.object({
  profiles: z.array(CandidateProfileSchema),
});

// ----------------------------------------------------------------------------
// Final API output contract (kept backward-compatible with the existing
// frontend `AnalysisResults` shape in CVBulkAnalyzer.tsx)
// ----------------------------------------------------------------------------

export const ScoreBreakdownSchema = z.object({
  mustHaveSkillsScore: z.number(),
  niceToHaveSkillsScore: z.number(),
  experienceScore: z.number(),
  ownershipScore: z.number(),
  achievementsScore: z.number(),
  stabilityPenalty: z.number(),
  hardRequirementCapApplied: z.boolean(),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const RankedCandidateSchema = z.object({
  candidateId: z.string(),
  name: z.string(),
  score: z.number(),
  fitSummary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  scoreBreakdown: ScoreBreakdownSchema,
});
export type RankedCandidateOutput = z.infer<typeof RankedCandidateSchema>;

export const BEIQuestionSchema = z.object({
  question: z.string(),
  whatToLookFor: z.string(),
});

export const TopCandidateSchema = z.object({
  candidateId: z.string(),
  name: z.string(),
  score: z.number(),
  suitabilitySummary: z.string(),
  beiQuestions: z.array(BEIQuestionSchema),
});
export type TopCandidateOutput = z.infer<typeof TopCandidateSchema>;

export const NarrativeResponseSchema = z.object({
  analysisSummary: z.string(),
  top3: z.array(TopCandidateSchema),
});
export type NarrativeResponse = z.infer<typeof NarrativeResponseSchema>;
