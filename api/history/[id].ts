/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readDB, writeDB } from "../../src/utils/db";
import { SearchHistoryItem } from "../../src/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "History item ID is required" });
    }

    const db = await readDB();
    db.search_history = db.search_history.filter((h: SearchHistoryItem) => h.id !== id);
    await writeDB(db);
    
    return res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE history failed:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
