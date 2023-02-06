#! /usr/bin/env node
/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2] || "start";

switch (mode) {
  case "start":
    spawn("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/postinstall.js")], { stdio: "inherit" });
    spawn("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/start.js")], { stdio: "inherit" });
    break;
  case "build":
    spawn("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/postinstall.js")], { stdio: "inherit" });
    spawn("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/build.js")], { stdio: "inherit" });
    break;
  case "serve":
    spawn("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/postinstall.js")], { stdio: "inherit" });
    spawn("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/serve.js")], { stdio: "inherit" });
    break;
  case "postinstall":
    spawn("node", ["--experimental-import-meta-resolve", path.join(__dirname, "../scripts/postinstall.js")], { stdio: "inherit" });
    break;
  default:
    console.log(`Unknown mode: ${mode}`);
    process.exit(1);
}
