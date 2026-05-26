import { defineConfig } from "drizzle-kit";
import { resolve } from "path";

const dataDir = process.env.NOTES_DATA_DIR ?? "./data";

export default defineConfig({
  schema: "./src/lib/server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: resolve(dataDir, "notes.db"),
  },
  verbose: true,
  strict: true,
});
