import path from "path";
import { fileURLToPath } from "url";
import { createSyncFn } from "synckit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerAbsPath = path.join(__dirname, "worker.js");

/** @type {(modulePath: string) => any} */
export default (modulePath) => createSyncFn(workerAbsPath)(modulePath);
