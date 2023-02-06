#! /usr/bin/env node
/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwd = process.cwd();
const mode = process.argv[2] || "start";

switch (mode) {
  case "start":
    spawnSync("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/postinstall.js")], { cwd: cwd, shell: true });
    spawnSync("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/start.js")], { cwd: cwd, shell: true, stdio: "inherit" });
    break;
  case "build":
    spawnSync("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/postinstall.js")], { cwd: cwd, shell: true });
    spawnSync("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/build.js")], { cwd: cwd, shell: true, stdio: "inherit" });
    break;
  case "serve":
    spawnSync("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/postinstall.js")], { cwd: cwd, shell: true });
    spawnSync("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/serve.js")], { cwd: cwd, shell: true, stdio: "inherit" });
    break;
  default:
    console.log(`Unknown mode: ${mode}`);
    process.exit(1);
}
