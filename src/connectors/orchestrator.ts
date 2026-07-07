/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { CandidateResult } from "../types";
import { executeSearchOrchestration } from "../services/searchOrchestrator";

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export async function parseSearchIntent(prompt: string): Promise<{ keywords: string[]; searchQueries: string[] }> {
  try {
    const ai = getAIClient();
    const systemPrompt = `You are an AI recruitment search specialist. Your task is to analyze the recruiter's natural language search prompt and convert it into a set of high-impact keywords and specific web search queries for public candidate postings (e.g., LinkedIn public profiles, Reddit hiring/forhire forums, Twitter/X posts).
Analyze the intent for:
- Role/Job Title (e.g., "HR", "React Developer")
- Location (e.g., "Bandung", "Jakarta")
- Additional skills or constraints (e.g., "Remote", "Part-time")

Return a JSON object with:
1. "keywords": A list of extracted core search keywords (e.g., ["HR", "Bandung"])
2. "searchQueries": A list of 2-3 optimized search query strings designed for search engines to find real candidate postings (e.g., ['site:linkedin.com/posts "looking for opportunities" "Bandung" "HR"', 'site:reddit.com/r/forhire " Bandung" "HR"'])`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Extracted recruiter keywords",
            },
            searchQueries: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Google Search queries with site filters and candidate keywords",
            },
          },
          required: ["keywords", "searchQueries"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    return {
      keywords: data.keywords || [prompt],
      searchQueries: data.searchQueries || [`"looking for work" "${prompt}"`],
    };
  } catch (error) {
    console.error("Error parsing search intent with Gemini:", error);
    // Graceful fallback
    return {
      keywords: [prompt],
      searchQueries: [
        `site:reddit.com/r/forhire "looking for work" "${prompt}"`,
        `site:linkedin.com/posts "open to work" "${prompt}"`,
      ],
    };
  }
}

export async function runSourcedSearch(prompt: string, searchQueries: string[]): Promise<CandidateResult[]> {
  try {
    const result = await executeSearchOrchestration(prompt, "u_default", searchQueries);
    return result.candidates;
  } catch (error) {
    console.error("Error during search orchestration execution:", error);
    return [];
  }
}
