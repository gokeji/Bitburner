import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fileSyncJson = JSON.parse(readFileSync(join(__dirname, "../filesync.json"), "utf8"));
const dist = fileSyncJson["scriptsFolder"];
const src = "src";
const allowedFiletypes = fileSyncJson["allowedFiletypes"];
const excludedFiles = ["scripts/examples/", "excluded/"]; // Hardcoded exclusion since filesync.json doesn't support it

export { dist, src, allowedFiletypes, excludedFiles };
