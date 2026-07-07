/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseSearchIntent, runSourcedSearch } from "../src/connectors/orchestrator";
import { readDB, writeDB } from "../src/utils/db";
import { SearchHistoryItem } from "../src/types";

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
    const { prompt, userId = "u_default" } = req.body;
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({ error: "Search prompt is required" });
    }

    console.log(`[Vercel Serverless] Sourcing candidates for: "${prompt}"`);

    // 1. Gemini extracts intent & queries
    const { keywords, searchQueries } = await parseSearchIntent(prompt);
    
    // 2. Execute parallel public connector discovery via orchestrator helper
    const candidates = await runSourcedSearch(prompt, searchQueries);

    // 3. Save to search history persistently
    const db = await readDB();
    const newHistoryItem: SearchHistoryItem = {
      id: `h_${Date.now()}`,
      userId,
      query: prompt,
      keywords,
      candidateCount: candidates.length,
      searchedAt: new Date().toISOString()
    };
    db.search_history.push(newHistoryItem);
    await writeDB(db);

    return res.json({
      success: true,
      keywords,
      searchQueries,
      candidates
    });
  } catch (err: any) {
    console.error("Search Serverless execution failed:", err);
    return res.status(500).json({ error: "Failed to execute search. Please try again.", details: err.message });
  }
}
