/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readDB, writeDB } from "../../src/utils/db";

// Structure of a LinkedIn Profile candidate
interface LinkedInProfile {
  id: string;
  fullName: string;
  jobTitle: string;
  location: string;
  company: string;
  experience: string;
  skills: string[];
  linkedinUrl: string;
  email?: string;
  phone?: string;
  sourcedAt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
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
    const { 
      jobTitle = "", 
      skills = "", 
      location = "", 
      company = "", 
      experience = "", 
      dorkQuery = "", 
      simulate = false 
    } = req.body;

    const token = process.env.APIFY_API_TOKEN;

    // Simulation / Mock mode if requested or token is missing
    if (simulate || !token) {
      console.log("[Apify Sourcing] Running in Simulation Mode (No token or Simulation explicitly checked)");
      
      // Generate realistic mock data based on input
      const mockProfiles: LinkedInProfile[] = [
        {
          id: `li_${Date.now()}_1`,
          fullName: "Budi Santoso",
          jobTitle: jobTitle || "Senior Software Engineer",
          location: location || "Bandung, Indonesia",
          company: company || "Gojek",
          experience: experience || "5+ years",
          skills: skills ? skills.split(",").map((s: string) => s.trim()) : ["React", "TypeScript", "Node.js"],
          linkedinUrl: `https://www.linkedin.com/in/budi-santoso-${Math.floor(Math.random() * 10000)}`,
          email: "budi.santoso@gmail.com",
          phone: "+628123456789",
          sourcedAt: new Date().toISOString()
        },
        {
          id: `li_${Date.now()}_2`,
          fullName: "Rina Wijaya",
          jobTitle: jobTitle || "Product Manager",
          location: location || "Jakarta, Indonesia",
          company: company || "Tokopedia",
          experience: experience || "3 years",
          skills: skills ? skills.split(",").map((s: string) => s.trim()) : ["Product Strategy", "Agile", "Scrum"],
          linkedinUrl: `https://www.linkedin.com/in/rina-wijaya-${Math.floor(Math.random() * 10000)}`,
          email: "rina.wijaya@outlook.com",
          phone: "+628198765432",
          sourcedAt: new Date().toISOString()
        },
        {
          id: `li_${Date.now()}_3`,
          fullName: "Ahmad Hidayat",
          jobTitle: jobTitle || "HR Talent Acquisition",
          location: location || "Bandung, Indonesia",
          company: company || "Freelance",
          experience: experience || "4 years",
          skills: skills ? skills.split(",").map((s: string) => s.trim()) : ["Sourcing", "Technical Recruitment", "ATS"],
          linkedinUrl: `https://www.linkedin.com/in/ahmad-hidayat-${Math.floor(Math.random() * 10000)}`,
          email: "ahmad.hidayat@yahoo.com",
          sourcedAt: new Date().toISOString()
        }
      ];

      // Save mock results to database
      const db = await readDB();
      if (!db.linkedin_profiles) {
        db.linkedin_profiles = [];
      }
      
      // Save them and deduplicate by linkedinUrl
      for (const p of mockProfiles) {
        const exists = db.linkedin_profiles.some((existing: LinkedInProfile) => existing.linkedinUrl === p.linkedinUrl);
        if (!exists) {
          db.linkedin_profiles.push(p);
        }
      }
      await writeDB(db);

      return res.json({
        success: true,
        simulated: true,
        tokenConfigured: !!token,
        profiles: mockProfiles,
        message: "Sourcing completed in simulation mode. Profiles saved to database."
      });
    }

    // Real Apify Sourcing Mode
    console.log(`[Apify Sourcing] Executing real Apify actor run. Dork: "${dorkQuery}"`);
    
    const searchStr = dorkQuery || `site:linkedin.com/in "${jobTitle}" "${location}"`;
    const isGoogleDork = searchStr.includes("site:linkedin.com/in") || searchStr.includes("google.com") || !searchStr.includes("linkedin.com/in/");

    let actorId = "apify/google-search-scraper";
    let payload: any = {};

    if (isGoogleDork) {
      // Use Google Search Scraper for Google Dorks
      actorId = "apify/google-search-scraper";
      payload = {
        queries: searchStr,
        maxPagesPerQuery: 1,
        resultsPerPage: 10
      };
      console.log(`[Apify Sourcing] Using Google Search Scraper actor. Query: "${searchStr}"`);
    } else {
      // Direct LinkedIn URL scraping
      actorId = "microworlds/linkedin-profile-scraper";
      payload = {
        urls: [searchStr],
        limit: 10
      };
      console.log(`[Apify Sourcing] Using LinkedIn Profile Scraper actor. URL: "${searchStr}"`);
    }

    const apifyUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;

    const response = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Apify Sourcing] Actor execution failed:", errorText);
      return res.status(response.status).json({
        success: false,
        error: `Apify Actor (${actorId}) run failed`,
        details: errorText
      });
    }

    const items: any = await response.json();
    console.log(`[Apify Sourcing] Fetched ${items.length} raw items from Apify dataset.`);

    const formattedProfiles: LinkedInProfile[] = [];

    if (isGoogleDork) {
      // Parse Google Search results
      const processGoogleResult = (result: any) => {
        const url = result.url || result.link;
        if (!url || !url.includes("linkedin.com/in/")) return;

        const titleStr = result.title || "";
        let fullName = "Unknown Candidate";
        let parsedTitle = jobTitle || "LinkedIn Candidate";
        let parsedCompany = company || "LinkedIn Company";

        // Extract name and details from Google title e.g. "Budi Santoso - Senior React Developer - Gojek | LinkedIn"
        const cleanTitle = titleStr.replace(/\s*\|\s*LinkedIn/gi, "").replace(/\s*-\s*LinkedIn/gi, "").trim();
        const parts = cleanTitle.split(/\s*-\s*/);
        
        if (parts.length > 0 && parts[0]) {
          fullName = parts[0].trim();
        }
        if (parts.length > 1 && parts[1]) {
          parsedTitle = parts[1].trim();
        }
        if (parts.length > 2 && parts[2]) {
          parsedCompany = parts[2].trim();
        }

        const skillsArray = skills 
          ? skills.split(",").map((s: string) => s.trim()) 
          : [];

        formattedProfiles.push({
          id: `li_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          fullName,
          jobTitle: parsedTitle,
          location: location || "Indonesia",
          company: parsedCompany,
          experience: experience || "",
          skills: skillsArray,
          linkedinUrl: url,
          sourcedAt: new Date().toISOString()
        });
      };

      for (const item of items) {
        if (item.organicResults && Array.isArray(item.organicResults)) {
          for (const res of item.organicResults) {
            processGoogleResult(res);
          }
        } else if (item.url && item.title) {
          processGoogleResult(item);
        }
      }
    } else {
      // Parse direct LinkedIn Profile Scraper items
      items.forEach((item: any, index: number) => {
        const url = item.url || item.linkedinUrl || item.profileUrl || searchStr;
        const name = item.fullName || item.name || (item.firstName ? `${item.firstName || ""} ${item.lastName || ""}`.trim() : "") || "Unknown Candidate";
        const title = item.title || item.jobTitle || item.headline || jobTitle || "LinkedIn Candidate";
        const loc = item.location || item.locationName || location || "Indonesia";
        const comp = item.currentCompany || item.company || company || "LinkedIn Company";
        const exp = item.experienceText || experience || "";
        const skillsArray = Array.isArray(item.skills) 
          ? item.skills.map((s: any) => typeof s === "string" ? s : s.name || "")
          : skills ? skills.split(",").map((s: string) => s.trim()) : [];

        formattedProfiles.push({
          id: `li_${Date.now()}_${index}`,
          fullName: name,
          jobTitle: title,
          location: loc,
          company: comp,
          experience: exp,
          skills: skillsArray.filter(Boolean),
          linkedinUrl: url,
          email: item.email || item.contactInfo?.email || undefined,
          phone: item.phone || item.contactInfo?.phone || undefined,
          sourcedAt: new Date().toISOString()
        });
      });
    }

    // Save fetched results to database
    const db = await readDB();
    if (!db.linkedin_profiles) {
      db.linkedin_profiles = [];
    }
    
    // Save them and deduplicate by linkedinUrl
    let newSavedCount = 0;
    for (const p of formattedProfiles) {
      const exists = db.linkedin_profiles.some((existing: LinkedInProfile) => existing.linkedinUrl === p.linkedinUrl);
      if (!exists) {
        db.linkedin_profiles.push(p);
        newSavedCount++;
      }
    }
    await writeDB(db);

    return res.json({
      success: true,
      simulated: false,
      tokenConfigured: true,
      profiles: formattedProfiles,
      newSavedCount,
      message: `Successfully sourced ${formattedProfiles.length} candidates from LinkedIn. Saved ${newSavedCount} new profiles.`
    });

  } catch (err: any) {
    console.error("[Apify Sourcing] API handler crashed:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Sourcing execution failed on server", 
      details: err.message 
    });
  }
}
