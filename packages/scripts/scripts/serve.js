/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "fs";
import path from "path";
import handler from "serve-handler";
import http from "http";
import chalk from "chalk";
import { execSync, spawnSync } from "child_process";

const cwd = process.cwd();
const outputPath = path.join(cwd, "dist");

if (!fs.existsSync(outputPath)) {
  console.log(chalk.red("❌ No dist directory found"));
  process.exit(1);
}

const serverPath = path.join(outputPath, "server.js");
if (fs.existsSync(serverPath)) {
  console.log(chalk.yellow("📦 Installing dependencies...\n"));
  execSync("npm install", { cwd: outputPath });
  console.log(chalk.yellow("⌛ Starting Mango production server...\n"));
  console.log(chalk.green("✅ Server running at http://localhost:3000"));
  spawnSync("node", [serverPath], { cwd: outputPath, stdio: "inherit" });
} else {
  const server = http.createServer((request, response) => {
    return handler(request, response, {
      public: outputPath,
      rewrites: [{ source: "**", destination: "/index.html" }],
    });
  });
  server.listen(3000, () => {
    console.log(chalk.yellow("⌛ Starting Mango production server...\n"));
    console.log(chalk.green("✅ Server running at http://localhost:3000"));
  });
}