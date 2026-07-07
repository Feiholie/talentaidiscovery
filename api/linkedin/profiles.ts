/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readDB, writeDB } from "../../src/utils/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const db = await readDB();
    if (!db.linkedin_profiles) {
      db.linkedin_profiles = [];
    }

    // GET: Retrieve all profiles
    if (req.method === "GET") {
      return res.json(db.linkedin_profiles);
    }

    // POST: Add new profiles, or run deduplication
    if (req.method === "POST") {
      const { action, profile, profiles } = req.body;

      if (action === "deduplicate") {
        const uniqueUrls = new Set<string>();
        const uniqueProfiles = [];

        // Traverse in reverse order (keep the most recent entries)
        for (let i = db.linkedin_profiles.length - 1; i >= 0; i--) {
          const p = db.linkedin_profiles[i];
          const cleanUrl = p.linkedinUrl?.trim().toLowerCase();
          if (cleanUrl && !uniqueUrls.has(cleanUrl)) {
            uniqueUrls.add(cleanUrl);
            uniqueProfiles.unshift(p); // Put it back in original relative order
          }
        }

        const removedCount = db.linkedin_profiles.length - uniqueProfiles.length;
        db.linkedin_profiles = uniqueProfiles;
        await writeDB(db);

        return res.json({
          success: true,
          removedCount,
          profiles: db.linkedin_profiles,
          message: `Deduplication complete. Removed ${removedCount} duplicate profiles.`
        });
      }

      // Bulk save
      if (profiles && Array.isArray(profiles)) {
        let addedCount = 0;
        for (const p of profiles) {
          if (!p.id) p.id = `li_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          if (!p.sourcedAt) p.sourcedAt = new Date().toISOString();
          
          const exists = db.linkedin_profiles.some((existing: any) => existing.linkedinUrl === p.linkedinUrl);
          if (!exists) {
            db.linkedin_profiles.push(p);
            addedCount++;
          }
        }
        await writeDB(db);
        return res.json({ success: true, addedCount, profiles: db.linkedin_profiles });
      }

      // Single profile add
      if (profile) {
        if (!profile.id) profile.id = `li_${Date.now()}`;
        if (!profile.sourcedAt) profile.sourcedAt = new Date().toISOString();

        const exists = db.linkedin_profiles.some((existing: any) => existing.linkedinUrl === profile.linkedinUrl);
        if (!exists) {
          db.linkedin_profiles.push(profile);
          await writeDB(db);
          return res.json({ success: true, profile, message: "Profile saved successfully." });
        } else {
          return res.status(409).json({ error: "Profile with this LinkedIn URL already exists." });
        }
      }

      return res.status(400).json({ error: "Invalid action or payload." });
    }

    // DELETE: Delete single profile or clear all
    if (req.method === "DELETE") {
      const { id, clearAll } = req.query;

      if (clearAll === "true") {
        db.linkedin_profiles = [];
        await writeDB(db);
        return res.json({ success: true, message: "All LinkedIn profiles cleared." });
      }

      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Profile ID is required" });
      }

      db.linkedin_profiles = db.linkedin_profiles.filter((p: any) => p.id !== id);
      await writeDB(db);
      return res.json({ success: true, message: "Profile deleted successfully." });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("LinkedIn profiles API failed:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
