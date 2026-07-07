/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Import Vercel Serverless Functions to delegate local dev requests
import loginHandler from "./api/login";
import statsHandler from "./api/stats";
import searchHandler from "./api/search";
import historyIndexHandler from "./api/history/index";
import historyIdHandler from "./api/history/[id]";
import favoritesIndexHandler from "./api/favorites/index";
import favoritesIdHandler from "./api/favorites/[id]";
import healthHandler from "./api/connectors/health";
import linkedinSearchHandler from "./api/linkedin/search";
import linkedinProfilesHandler from "./api/linkedin/profiles";
import cvBulkAnalyzeHandler from "./api/cv-bulk-analyze";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parser middleware
  // NOTE: default express.json() body limit is 100kb. Now that real CV text
  // is extracted (instead of the old short mock text), a batch of up to 150
  // real CVs can easily exceed that default and be silently rejected with a
  // 413 error. Raised to accommodate large bulk-screening payloads.
  app.use(express.json({ limit: "25mb" }));

  // Adapt Vercel Serverless Function signature to Express middleware
  const adapt = (handler: any) => {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        await handler(req as any, res as any);
      } catch (err) {
        next(err);
      }
    };
  };

  // API Route mappings matching Vercel routes
  app.post("/api/login", adapt(loginHandler));
  app.get("/api/stats", adapt(statsHandler));
  app.post("/api/search", adapt(searchHandler));
  app.get("/api/history", adapt(historyIndexHandler));
  
  app.delete("/api/history/:id", (req, res, next) => {
    req.query.id = req.params.id;
    adapt(historyIdHandler)(req, res, next);
  });

  app.get("/api/favorites", adapt(favoritesIndexHandler));
  app.post("/api/favorites", adapt(favoritesIndexHandler));
  
  app.delete("/api/favorites/:id", (req, res, next) => {
    req.query.id = req.params.id;
    adapt(favoritesIdHandler)(req, res, next);
  });

  app.get("/api/connectors/health", adapt(healthHandler));

  app.post("/api/linkedin/search", adapt(linkedinSearchHandler));
  app.get("/api/linkedin/profiles", adapt(linkedinProfilesHandler));
  app.post("/api/linkedin/profiles", adapt(linkedinProfilesHandler));
  app.delete("/api/linkedin/profiles", adapt(linkedinProfilesHandler));
  app.post("/api/cv-bulk-analyze", adapt(cvBulkAnalyzeHandler));

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    console.log("[TalentAI Dev] Mounting Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("[TalentAI Production] Serving pre-built static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TalentAI Dev-Server] Running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start local dev-server:", err);
});
