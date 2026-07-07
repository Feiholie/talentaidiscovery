/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";

// On Vercel (or Serverless environments), write to /tmp/db.json to avoid Read-Only filesystem errors.
// Locally, write to src/db.json.
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA || process.env.NETLIFY;
const DB_PATH = isServerless 
  ? path.join("/tmp", "db.json") 
  : path.join(process.cwd(), "src", "db.json");

const SEED_PATH = path.join(process.cwd(), "src", "db.json");

const defaultDB = {
  users: [{ id: "u_default", email: "steffiholiea2b@gmail.com", name: "Steffi Holiea", password: "password" }],
  favorites: [],
  search_history: []
};

export async function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // If we are in a serverless environment and /tmp/db.json does not exist, try to seed it from src/db.json
      if (fs.existsSync(SEED_PATH)) {
        try {
          const seedData = await fs.promises.readFile(SEED_PATH, "utf8");
          // Write seedData to the writable DB_PATH
          await fs.promises.writeFile(DB_PATH, seedData, "utf8");
          return JSON.parse(seedData);
        } catch (seedErr) {
          console.error("Error seeding from src/db.json:", seedErr);
        }
      }
      
      // If still not created, write defaultDB to DB_PATH
      await fs.promises.writeFile(DB_PATH, JSON.stringify(defaultDB, null, 2), "utf8");
      return defaultDB;
    }

    const data = await fs.promises.readFile(DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database:", err);
    // If anything fails, try to return default or read from SEED_PATH directly
    try {
      if (fs.existsSync(SEED_PATH)) {
        const seedData = await fs.promises.readFile(SEED_PATH, "utf8");
        return JSON.parse(seedData);
      }
    } catch {}
    return defaultDB;
  }
}

export async function writeDB(data: any) {
  try {
    // Ensure parent directory exists (just in case)
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    await fs.promises.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
    
    // Also write to local SEED_PATH if NOT in serverless environment to persist locally during dev
    if (!isServerless && fs.existsSync(SEED_PATH)) {
      await fs.promises.writeFile(SEED_PATH, JSON.stringify(data, null, 2), "utf8");
    }
  } catch (err) {
    console.error("Error writing database:", err);
  }
}
