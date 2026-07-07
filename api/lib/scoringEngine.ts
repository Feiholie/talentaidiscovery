/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ============================================================================
 * PHASE C — DETERMINISTIC SCORING ENGINE
 * ============================================================================
 * This is the crux of the fix. The 0-100 "fit score" is NO LONGER produced
 * by asking an LLM for its opinion. It is computed here, in plain
 * TypeScript, from the structured `JobRequirements` + `CandidateProfile`
 * objects extracted in Phases A and B.
 *
 * Given the SAME extracted job requirements and the SAME extracted
 * candidate profile, `computeCandidateScore` will ALWAYS return the exact
 * same number. No randomness, no model sampling, no "mood" — just
 * arithmetic over evidence, exactly like a recruiter's weighted scorecard.
 *
 * Why this fixes "candidates who meet every requirement still score 5%":
 *  - The score can never be lower than what the evidence in `skillEvidence`
 *    / `timeline` / `measurableAchievements` actually supports — there is no
 *    step where an LLM can just "decide" a low number.
 *  - A candidate who has every must-have skill VERIFIED, meets the minimum
 *    experience, shows strong ownership, and has no stability red flags is
 *    mathematically guaranteed a high score, every time.
 *  - The ONLY thing that can cap a strong-looking candidate's score is the
 *    explicit "hard requirement missing" rule below — which is itself
 *    visible in the output (`hardRequirementCapApplied` + a matching gap
 *    entry), never a silent, unexplained low score.
 *
 * This file is intentionally the easiest place in the codebase to tune the
 * recruiter's judgment (weights, thresholds) without touching any prompts —
 * exactly the "mudah dikembangkan" (easy to extend) requirement.
 * ============================================================================
 */

import type { CandidateProfile, JobRequirements, ScoreBreakdown } from "./schemas";

// ----------------------------------------------------------------------------
// TUNABLE CONFIGURATION — adjust these to change recruiter "judgment" without
// touching any AI prompts. Weights must sum to 100.
// ----------------------------------------------------------------------------
export const SCORING_WEIGHTS = {
  mustHaveSkills: 40,
  niceToHaveSkills: 10,
  experienceMatch: 20,
  ownershipSeniority: 20,
  achievements: 10,
} as const;

/** Points deducted per detected stability/risk flag (job hopping, gaps, etc.) */
export const STABILITY_PENALTY_PER_FLAG = 4;
/** Ceiling on how much stability flags can drag the score down in total. */
export const MAX_STABILITY_PENALTY = 15;
/** Number of solid measurable achievements considered "full credit". */
export const ACHIEVEMENTS_FOR_FULL_CREDIT = 3;
/**
 * If ANY must-have skill marked isHardRequirement=true is not verified in
 * the candidate's profile, the final score is capped at this value — no
 * matter how strong everything else looks. This models a recruiter's
 * dealbreaker rule (e.g. a required certification/license/core skill that
 * simply isn't there).
 */
export const HARD_REQUIREMENT_MISSING_CEILING = 35;

const OWNERSHIP_VALUE: Record<string, number> = {
  led_end_to_end: 1.0,
  contributed: 0.6,
  supporting: 0.3,
  unclear: 0.1,
};

export interface ScoredCandidate {
  score: number;
  breakdown: ScoreBreakdown;
  strengths: string[];
  gaps: string[];
  fitSummary: string;
}

/** Normalizes a skill name for fuzzy comparison (case/punctuation-insensitive). */
function normalizeSkillName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Fuzzy-matches a required skill name against extracted skill evidence.
 * Exact-normalized match first, then substring overlap in either direction
 * (handles cases like "React" vs "React.js", "Team Leadership" vs
 * "Leadership / Team Management").
 */
function findMatchingEvidence(
  requiredName: string,
  evidence: CandidateProfile["skillEvidence"]
): CandidateProfile["skillEvidence"][number] | undefined {
  const normalizedRequired = normalizeSkillName(requiredName);
  if (!normalizedRequired) return undefined;

  const exact = evidence.find((e) => normalizeSkillName(e.skill) === normalizedRequired);
  if (exact) return exact;

  return evidence.find((e) => {
    const normalizedEvidence = normalizeSkillName(e.skill);
    if (!normalizedEvidence) return false;
    return (
      normalizedEvidence.includes(normalizedRequired) || normalizedRequired.includes(normalizedEvidence)
    );
  });
}

function scoreSkillGroup(
  requirements: JobRequirements["mustHaveSkills"],
  evidence: CandidateProfile["skillEvidence"],
  weight: number
): { score: number; matched: string[]; missing: string[] } {
  if (requirements.length === 0) {
    return { score: weight, matched: [], missing: [] };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const req of requirements) {
    const match = findMatchingEvidence(req.name, evidence);
    if (match && match.verified) {
      matched.push(req.name);
    } else {
      missing.push(req.name);
    }
  }

  const coverage = matched.length / requirements.length;
  return { score: coverage * weight, matched, missing };
}

function scoreExperience(job: JobRequirements, profile: CandidateProfile, weight: number): number {
  if (job.minYearsExperience <= 0) return weight;
  const ratio = Math.min(profile.totalYearsExperience / job.minYearsExperience, 1);
  return ratio * weight;
}

function scoreOwnership(profile: CandidateProfile, weight: number): number {
  if (profile.timeline.length === 0) return weight * 0.5; // neutral default when timeline couldn't be extracted
  const avg =
    profile.timeline.reduce((sum, entry) => sum + (OWNERSHIP_VALUE[entry.ownershipLevel] ?? 0.1), 0) /
    profile.timeline.length;
  return avg * weight;
}

function scoreAchievements(profile: CandidateProfile, weight: number): number {
  const ratio = Math.min(profile.measurableAchievements.length / ACHIEVEMENTS_FOR_FULL_CREDIT, 1);
  return ratio * weight;
}

function buildFitSummary(params: {
  mustHaveCoveragePct: number;
  ownershipRatio: number;
  hardRequirementCapApplied: boolean;
  missingHardRequirements: string[];
  stabilityFlagCount: number;
}): string {
  const { mustHaveCoveragePct, ownershipRatio, hardRequirementCapApplied, missingHardRequirements, stabilityFlagCount } =
    params;

  const ownershipDescriptor =
    ownershipRatio >= 0.8
      ? "menunjukkan pola kepemilikan pekerjaan end-to-end yang kuat"
      : ownershipRatio >= 0.5
      ? "menunjukkan kontribusi individu yang solid dalam tim"
      : "cenderung berperan pendukung/partisipasi pasif berdasarkan bukti di CV";

  const parts = [
    `${Math.round(mustHaveCoveragePct * 100)}% kompetensi inti (must-have) terverifikasi dengan bukti konkret di CV`,
    ownershipDescriptor,
  ];

  if (hardRequirementCapApplied) {
    parts.push(
      `namun terdapat persyaratan wajib (dealbreaker) yang tidak terverifikasi: ${missingHardRequirements.join(", ")}, sehingga skor dibatasi`
    );
  } else if (stabilityFlagCount > 0) {
    parts.push(`terdapat ${stabilityFlagCount} indikator risiko stabilitas kerja yang perlu ditelusuri saat interview`);
  } else {
    parts.push("tidak ditemukan red flag signifikan");
  }

  return parts.join("; ") + ".";
}

export function computeCandidateScore(job: JobRequirements, profile: CandidateProfile): ScoredCandidate {
  if (profile.extractionFailed) {
    return {
      score: 0,
      breakdown: {
        mustHaveSkillsScore: 0,
        niceToHaveSkillsScore: 0,
        experienceScore: 0,
        ownershipScore: 0,
        achievementsScore: 0,
        stabilityPenalty: 0,
        hardRequirementCapApplied: false,
      },
      strengths: [],
      gaps: ["CV kandidat ini gagal diproses/diekstrak oleh sistem. Periksa kembali file sumber atau input ulang secara manual."],
      fitSummary: "Tidak dapat dianalisis — proses ekstraksi CV gagal.",
    };
  }

  const mustHave = scoreSkillGroup(job.mustHaveSkills, profile.skillEvidence, SCORING_WEIGHTS.mustHaveSkills);
  const niceToHave = scoreSkillGroup(job.niceToHaveSkills, profile.skillEvidence, SCORING_WEIGHTS.niceToHaveSkills);
  const experienceScore = scoreExperience(job, profile, SCORING_WEIGHTS.experienceMatch);
  const ownershipScore = scoreOwnership(profile, SCORING_WEIGHTS.ownershipSeniority);
  const achievementsScore = scoreAchievements(profile, SCORING_WEIGHTS.achievements);

  const stabilityPenalty = Math.min(
    profile.stabilityFlags.length * STABILITY_PENALTY_PER_FLAG,
    MAX_STABILITY_PENALTY
  );

  let rawScore =
    mustHave.score + niceToHave.score + experienceScore + ownershipScore + achievementsScore - stabilityPenalty;

  // Dealbreaker gate: any unverified HARD requirement caps the final score,
  // regardless of how strong everything else is.
  const missingHardRequirements = job.mustHaveSkills
    .filter((req) => req.isHardRequirement)
    .map((req) => req.name)
    .filter((name) => mustHave.missing.includes(name));

  const hardRequirementCapApplied = missingHardRequirements.length > 0;
  if (hardRequirementCapApplied) {
    rawScore = Math.min(rawScore, HARD_REQUIREMENT_MISSING_CEILING);
  }

  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  const strengths = [
    ...mustHave.matched.map((s) => `Kompetensi inti terverifikasi: ${s}`),
    ...niceToHave.matched.map((s) => `Nilai tambah: ${s}`),
    ...profile.measurableAchievements.slice(0, 3),
    ...profile.transferableExperienceNotes,
  ];

  const gaps = [
    ...mustHave.missing.map((s) =>
      job.mustHaveSkills.find((r) => r.name === s)?.isHardRequirement
        ? `Persyaratan WAJIB tidak terverifikasi: ${s}`
        : `Kompetensi inti belum terverifikasi: ${s}`
    ),
    ...niceToHave.missing.map((s) => `Nilai tambah belum terlihat: ${s}`),
    ...profile.stabilityFlags,
  ];

  const mustHaveCoveragePct = job.mustHaveSkills.length > 0 ? mustHave.matched.length / job.mustHaveSkills.length : 1;
  const ownershipRatio =
    profile.timeline.length > 0
      ? profile.timeline.reduce((sum, e) => sum + (OWNERSHIP_VALUE[e.ownershipLevel] ?? 0.1), 0) /
        profile.timeline.length
      : 0.5;

  const fitSummary = buildFitSummary({
    mustHaveCoveragePct,
    ownershipRatio,
    hardRequirementCapApplied,
    missingHardRequirements,
    stabilityFlagCount: profile.stabilityFlags.length,
  });

  return {
    score,
    breakdown: {
      mustHaveSkillsScore: Math.round(mustHave.score * 10) / 10,
      niceToHaveSkillsScore: Math.round(niceToHave.score * 10) / 10,
      experienceScore: Math.round(experienceScore * 10) / 10,
      ownershipScore: Math.round(ownershipScore * 10) / 10,
      achievementsScore: Math.round(achievementsScore * 10) / 10,
      stabilityPenalty,
      hardRequirementCapApplied,
    },
    strengths,
    gaps,
    fitSummary,
  };
}
