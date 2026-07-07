/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readDB } from "../../src/utils/db";
import { SearchHistoryItem } from "../../src/types";

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
    const userHistory = db.search_history
      .filter((h: SearchHistoryItem) => h.userId === userId)
      .sort((a: SearchHistoryItem, b: SearchHistoryItem) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime());
    
    return res.json(userHistory);
  } catch (err: any) {
    console.error("GET history failed:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
