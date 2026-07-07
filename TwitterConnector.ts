/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { CandidateResult } from "../types";
import { CandidateConnector } from "./CandidateConnector";

export class TwitterConnector implements CandidateConnector {
  public name = "Twitter/X";
  public enabled = true;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
  }

  public async healthCheck(): Promise<boolean> {
    return !!this.apiKey;
  }

  public normalize(raw: any): CandidateResult {
    const defaultIdx = Math.floor(Math.random() * 1000);
    return {
      id: raw.id || `tw_${Date.now()}_${defaultIdx}`,
      name: raw.name || "Anonymous User",
      jobTitle: raw.jobTitle || "Freelancer",
      location: raw.location || "Anywhere",
      summary: raw.summary || "",
      email: raw.email || undefined,
      phone: raw.phone || undefined,
      telegram: raw.telegram || undefined,
      skills: Array.isArray(raw.skills) ? raw.skills : raw.skills ? [raw.skills] : [],
      sourceName: "Twitter/X",
      sourceUrl: raw.sourceUrl || "https://x.com",
      postedAt: raw.postedAt || new Date().toISOString().split("T")[0],
    };
  }

  public async search(query: string, parsedQueries?: string[]): Promise<CandidateResult[]> {
    if (!this.apiKey) {
      console.warn("TwitterConnector: GEMINI_API_KEY missing.");
      return [];
    }

    try {
      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      const searchTarget = parsedQueries && parsedQueries.length > 0
        ? parsedQueries.filter(q => q.includes("twitter") || q.includes("x.com")).join(" OR ")
        : `site:x.com "looking for work" "${query}"`;

      const systemInstruction = `You are an AI recruitment agent indexing job seeker tweets on Twitter/X.
Extract tweets from people actively advertising their skills or looking for hire.
ONLY extract public and real candidate postings.
DO NOT fabricate contact information or URLs.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Search Twitter/X for job seeker tweets matching: ${query}. Targets: ${searchTarget}`,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                jobTitle: { type: Type.STRING },
                location: { type: Type.STRING },
                summary: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                telegram: { type: Type.STRING },
                sourceUrl: { type: Type.STRING },
                postedAt: { type: Type.STRING },
                skills: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["name", "jobTitle", "location", "summary", "sourceUrl", "postedAt"]
            }
          }
        }
      });

      const items: any[] = JSON.parse(response.text || "[]");
      return items.map(item => this.normalize(item));
    } catch (err) {
      console.error("TwitterConnector error:", err);
      return [];
    }
  }
}
