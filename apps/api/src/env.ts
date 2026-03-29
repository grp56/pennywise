import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiWorkspaceRoot = path.resolve(currentDirectory, "..");
const repoRoot = path.resolve(apiWorkspaceRoot, "..", "..");
const repoEnvPath = path.join(repoRoot, ".env");

dotenv.config({ path: repoEnvPath });
