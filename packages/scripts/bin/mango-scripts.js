#! /usr/bin/env node
/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwd = process.cwd();
const mode = process.argv[2] || "start";
const isWebContainer = process.versions.hasOwnProperty("webcontainer");

switch (mode) {
  case "start":
    isWebContainer && spawnSync("node", ["--experimental-import-meta-resolve", "--no-warnings", path.join(__dirname, "../scripts/webContainerPatcher.js")], { cwd: cwd, shell: true, stdio: "inherit" });
    spawnSync("node", ["--experimental-import-meta-resolve", "--experimental-fetch", "--experimental-loader", pathToFileURL(path.join(__dirname, "../loaders/http.js")), "--no-warnings", path.join(__dirname, "../scripts/start.js")], { cwd: cwd, shell: true, stdio: "inherit" });
    break;
  case "build":
    isWebContainer && spawnSync("node", ["--experimental-import-meta-resolve", "--no-warnings", path.join(__dirname, "../scripts/webContainerPatcher.js")], { cwd: cwd, shell: true, stdio: "inherit" });
    spawnSync("node", ["--experimental-import-meta-resolve", "--experimental-fetch", path.join(__dirname, "../scripts/build.js")], { cwd: cwd, shell: true, stdio: "inherit" });
    break;
  case "serve":
    spawnSync("node", ["--experimental-import-meta-resolve", "--experimental-fetch", path.join(__dirname, "../scripts/serve.js")], { cwd: cwd, shell: true, stdio: "inherit" });
    break;
  default:
    console.log(`Unknown mode: ${mode}`);
    process.exit(1);
}
