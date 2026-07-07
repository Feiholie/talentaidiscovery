/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readDB } from "../src/utils/db";
import { SearchHistoryItem, FavoriteCandidate } from "../src/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = (req.query.userId as string) || "u_default";
    const db = await readDB();
    
    const userHistory = db.search_history.filter((h: SearchHistoryItem) => h.userId === userId);
    const userFavorites = db.favorites.filter((f: FavoriteCandidate) => f.userId === userId);

    return res.json({
      totalSearches: userHistory.length,
      totalFavorites: userFavorites.length,
      recentSearchesCount: Math.min(5, userHistory.length),
      supportedConnectors: ["LinkedIn", "Reddit", "Twitter/X"]
    });
  } catch (err: any) {
    console.error("GET stats failed:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
