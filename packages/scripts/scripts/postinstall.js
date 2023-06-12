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

const getRepoRoot = async () => {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
    return root.trim();
  } catch {
    return null;
  }
};

const repoRoot = await getRepoRoot();

const patchPackage = async (packageName) => {
  const packagePath = path.dirname(fileURLToPath(await import.meta.resolve(packageName)));
  const projectPath = packagePath.split("node_modules")[0].slice(0, -1).replace(/\\/g, "/");
  const patchFilename = patches.find((patch) => patch.startsWith(packageName.replace(/\//g, "+")));
  const patchFilePath = path.join(patchesPath, patchFilename);
  try {
    execFileSync("git", ["apply", "--ignore-whitespace", "--unsafe-paths", "--reverse", "--check", "--directory", projectPath, patchFilePath], { cwd: repoRoot || projectPath });
  } catch {
    execFileSync("git", ["apply", "--ignore-whitespace", "--unsafe-paths", "--directory", projectPath, patchFilePath], { cwd: repoRoot || projectPath });
  }

};

packageNames.forEach((packageName) => patchPackage(packageName));
