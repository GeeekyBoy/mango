/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const patchesPath = path.join(__dirname, "..", "patches");
const patches = fs.readdirSync(patchesPath);
const packageNames = patches.map((patch) => patch.split(/\+\d/)[0].replace(/\+/g, "/"));

const patchPackage = async (packageName) => {
  const packagePath = path.dirname(fileURLToPath(await import.meta.resolve(packageName)));
  const projectPath = packagePath.split("node_modules")[0];
  const patchFilename = patches.find((patch) => patch.startsWith(packageName.replace(/\//g, "+")));
  const patchFilePath = path.join(patchesPath, patchFilename);
  try {
    execFileSync("git", ["apply", "--ignore-whitespace", "--reverse", "--check", patchFilePath], { cwd: projectPath });
  } catch {
    execFileSync("git", ["apply", "--ignore-whitespace", patchFilePath], { cwd: projectPath });
  }

};

packageNames.forEach((packageName) => patchPackage(packageName));
