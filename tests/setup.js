import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: false });
}
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.DISABLE_RATE_LIMIT = "true";
