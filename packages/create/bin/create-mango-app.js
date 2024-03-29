#! /usr/bin/env node
/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectName = process.argv[2] || "my-app";
const cwd = process.cwd();

const projectDir = path.join(cwd, projectName);
if (fs.existsSync(projectDir)) {
  console.error(`Directory ${projectDir} already exists`);
  process.exit(1);
}

const templateDir = path.join(__dirname, "../template");
fs.mkdirSync(projectDir);
fs.readdirSync(templateDir).forEach((file) => {
  const filePath = path.join(templateDir, file);
  const fileName = path.basename(filePath);
  if (fileName !== "package.json" && fileName !== "package-lock.json") {
    fs.cpSync(filePath, path.join(projectDir, fileName), { recursive: true });
  } else {
    const fileContents = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(fileContents);
    json.name = projectName;
    if (fileName === "package-lock.json") {
      json.packages[""].name = projectName;
    }
    const newFileContents = JSON.stringify(json, null, 2);
    const newFilePath = path.join(projectDir, fileName);
    fs.writeFileSync(newFilePath, newFileContents);
  }
});

spawnSync("npm", ["install"], { cwd: projectDir, shell: true, stdio: "inherit" });
