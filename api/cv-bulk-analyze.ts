/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ============================================================================
 * CV BULK SCREENING & RANKING — ORCHESTRATOR
 * ============================================================================
 * This endpoint now runs a 4-phase deterministic pipeline instead of one
 * single LLM call that both judged and scored candidates in the same
 * breath. See api/lib/*.ts for the detailed rationale behind each phase.
 *
 *   Phase A (jobRequirements.ts)   — LLM: extract structured hiring model
 *                                    from free-text criteria (ONCE).
 *   Phase B (candidateProfiles.ts) — LLM: extract evidence-based structured
 *                                    profile per candidate (batched).
 *   Phase C (scoringEngine.ts)     — PURE CODE: compute the 0-100 score
 *                                    deterministically from A + B. No LLM
 *                                    call, no randomness, fully reproducible.
 *   Phase D (narrativeGenerator.ts)— LLM: write the executive summary and
 *                                    top-3 BEI/STAR questions using the
 *                                    ALREADY FINAL scores as fixed context.
 *
 * Every phase is wrapped so a failure is reported with which phase failed,
 * instead of one generic "analysis failed" message.
 * ============================================================================
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractJobRequirements } from "./lib/jobRequirements";
import { extractCandidateProfiles, MAX_CV_CHARS, type CandidateInput } from "./lib/candidateProfiles";
import { computeCandidateScore } from "./lib/scoringEngine";
import { generateNarrative } from "./lib/narrativeGenerator";
import type { RankedCandidateOutput } from "./lib/schemas";

// Vercel function configuration: the multi-call pipeline (job requirements +
// batched candidate extraction + narrative) can take longer than the 10s
// default on some plans, especially for large candidate batches.
// NOTE: on Vercel Hobby, max duration is capped at 60s regardless of this
// value — for very large batches (100+ candidates) consider Vercel
// Pro/Enterprise, or reduce BATCH_SIZE/MAX_CONCURRENT_BATCHES in
// candidateProfiles.ts to trade latency for a lower per-wave cost.
export const config = {
  maxDuration: 120,
};

const MIN_CV_TEXT_LENGTH = 40;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { positionCriteria, candidates } = req.body as {
      positionCriteria?: string;
      candidates?: CandidateInput[];
    };

    if (!positionCriteria || typeof positionCriteria !== "string" || positionCriteria.trim() === "") {
      return res.status(400).json({ error: "Position criteria is required." });
    }

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: "At least one candidate CV is required for bulk analysis." });
    }

    if (candidates.length > 150) {
      return res.status(400).json({ error: "Maximum limit of 150 candidates exceeded." });
    }

    // Guard against the exact bug class this pipeline was built to fix:
    // silently screening empty/near-empty CV text (e.g. a failed extraction
    // that slipped through). Fail loudly and specifically instead.
    const emptyCandidates = candidates.filter((c) => !c.cvText || c.cvText.trim().length < MIN_CV_TEXT_LENGTH);
    if (emptyCandidates.length > 0) {
      return res.status(400).json({
        error: `Teks CV kosong/terlalu pendek untuk kandidat berikut, sehingga tidak dapat dianalisis secara akurat: ${emptyCandidates
          .map((c) => c.name)
          .join(", ")}. Pastikan file berhasil diekstrak (lihat notifikasi saat upload) atau tempel teks CV secara manual.`,
      });
    }

    // Defensive clamp on CV length (mirrors the cap used when building
    // extraction prompts) so one abnormally large document can't blow the
    // token budget for its whole batch.
    const safeCandidates: CandidateInput[] = candidates.map((c) => ({
      id: String(c.id),
      name: c.name,
      cvText: c.cvText.slice(0, MAX_CV_CHARS),
    }));

    console.log(
      `[CV-Bulk-Analyze] Screening ${safeCandidates.length} candidates against: "${positionCriteria.substring(0, 100)}..."`
    );

    // ---------- Phase A ----------
    const jobRequirements = await extractJobRequirements(positionCriteria).catch((err) => {
      throw new Error(`[Phase A: Job Requirements] ${err instanceof Error ? err.message : String(err)}`);
    });

    // ---------- Phase B ----------
    const profiles = await extractCandidateProfiles(jobRequirements, safeCandidates).catch((err) => {
      throw new Error(`[Phase B: Candidate Profiles] ${err instanceof Error ? err.message : String(err)}`);
    });

    // ---------- Phase C (deterministic, pure code) ----------
    const rankings: RankedCandidateOutput[] = profiles.map((profile) => {
      const { score, breakdown, strengths, gaps, fitSummary } = computeCandidateScore(jobRequirements, profile);
      return {
        candidateId: profile.candidateId,
        name: profile.name,
        score,
        fitSummary,
        strengths,
        gaps,
        scoreBreakdown: breakdown,
      };
    });

    // Deterministic, stable sort: score desc, then name asc as a tiebreaker
    // so the ORDER of results is also reproducible across runs (not just
    // the individual scores).
    rankings.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    // ---------- Phase D (narrative only) ----------
    const top3Rankings = rankings.slice(0, 3);
    const top3Profiles = top3Rankings
      .map((r) => profiles.find((p) => p.candidateId === r.candidateId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const narrative = await generateNarrative(jobRequirements, rankings, top3Profiles).catch((err) => {
      throw new Error(`[Phase D: Narrative Generation] ${err instanceof Error ? err.message : String(err)}`);
    });

    // Never trust a score echoed back by the narrative step — always use
    // the authoritative, already-computed value from Phase C.
    const top3 = narrative.top3.map((t) => {
      const authoritative = rankings.find((r) => r.candidateId === t.candidateId);
      return {
        ...t,
        score: authoritative ? authoritative.score : t.score,
      };
    });

    return res.json({
      success: true,
      data: {
        analysisSummary: narrative.analysisSummary,
        rankings,
        top3,
      },
      // Exposed for transparency/debugging — the frontend can safely ignore
      // this field, but it makes it easy to inspect exactly what hiring
      // model the criteria were interpreted into.
      jobRequirements,
    });
  } catch (err: any) {
    console.error("CV Bulk analysis execution failed:", err);
    return res.status(500).json({
      error: "Failed to perform AI Bulk Analysis. Please try again.",
      details: err.message,
    });
  }
}
