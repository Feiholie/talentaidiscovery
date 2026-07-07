/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRegisteredConnectors } from "../../src/connectors";

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
    const connectors = getRegisteredConnectors();
    const report = await Promise.all(
      connectors.map(async (connector) => {
        const startTime = Date.now();
        const isHealthy = await connector.healthCheck();
        const duration = Date.now() - startTime;
        return {
          name: connector.name,
          enabled: connector.enabled,
          healthy: isHealthy,
          latencyMs: duration,
          status: isHealthy ? "ACTIVE" : "MISSING_API_KEY",
          lastChecked: new Date().toISOString()
        };
      })
    );
    
    return res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      geminiApiKeyConfigured: !!process.env.GEMINI_API_KEY,
      apifyTokenConfigured: !!process.env.APIFY_API_TOKEN,
      connectors: report
    });
  } catch (err: any) {
    console.error("Health check api failed:", err);
    return res.status(500).json({ error: "Failed to generate health report", details: err.message });
  }
}
