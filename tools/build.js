/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "fs";
import asyncFs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import * as terser from "terser";
import * as esbuild from "esbuild"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const excludedPkg = ["router"];

const terserConfig = {
  mangle: {
    eval: true,
  },
  compress: {
    keep_fargs: false,
    passes: 2,
    negate_iife: false,
    side_effects: false,
  },
  ie8: true,
  safari10: true,
  sourceMap: false,
  toplevel: false,
  module: false
};

const iterateDir = async (dir, cb, root) => {
  const files = await asyncFs.readdir(dir);
  for (const file of files) {
    if (file === "node_modules") continue;
    if (file === "build") continue;
    if (file === "package.json" && root) continue;
    const filePath = path.join(dir, file);
    const stats = await asyncFs.stat(filePath);
    if (stats.isDirectory()) {
      await iterateDir(filePath, cb);
    } else {
      await cb(filePath);
    }
  };
};

const packages = await asyncFs.readdir(path.resolve(__dirname, "../packages"));

for (const pkg of packages) {
  const pkgPath = path.join(__dirname, `../packages/${pkg}`);
  const srcPath = path.join(pkgPath, "src");
  const buildPath = path.join(pkgPath, "build");
  const hasSrc = fs.existsSync(srcPath);
  const shouldBuild = excludedPkg.indexOf(pkg) === -1;

  await asyncFs.rm(buildPath, { recursive: true, force: true });
  await asyncFs.mkdir(buildPath);

  if (!shouldBuild) {
    const files = await asyncFs.readdir(pkgPath);
    for (const file of files) {
      if (file !== "build" && file !== "node_modules") {
        await asyncFs.cp(path.join(pkgPath, file), path.join(buildPath, file), { recursive: true });
      }
    };
    continue;
  }

  const pkgJsonPath = path.join(pkgPath, "package.json");
  const pkgJsonContents = await asyncFs.readFile(pkgJsonPath, "utf8");
  const pkgJson = JSON.parse(pkgJsonContents);
  const isModule = pkgJson.type === "module";
  if (hasSrc) {
    pkgJson.main = pkgJson.main.replace(/^src/, "dist");
    pkgJson.files = pkgJson.files.map((file) => file.replace(/^src/, "dist"));
  }
  if (pkg === "runtime") {
    pkgJson.main = pkgJson.main.replace(/index.js$/, "mango.min.js");
  }
  const newPkgJsonContents = JSON.stringify(pkgJson, null, 2);
  const newPkgJsonPath = path.join(buildPath, "package.json");
  await asyncFs.writeFile(newPkgJsonPath, newPkgJsonContents);

  if (process.env.npm_lifecycle_event === "prepublishOnly") {
    await asyncFs.writeFile(pkgJsonPath, newPkgJsonContents);
  }

  await iterateDir(pkgPath, async (filePath) => {
    const srcFilePath = filePath;
    const distFilePath = filePath.replace(pkgPath, buildPath);
    const isMjs = distFilePath.endsWith(".mjs");
    const isJs = distFilePath.endsWith(".js");
    await asyncFs.mkdir(path.dirname(distFilePath), { recursive: true });
    if (pkg === "runtime" && isJs) {
      const source = await asyncFs.readFile(srcFilePath, "utf8");
      const result = await terser.minify(source, terserConfig);
      await asyncFs.writeFile(distFilePath.replace("index.js", "mango.min.js"), result.code);
    } else if ((isModule && isJs) || isMjs) {
      const source = await asyncFs.readFile(srcFilePath, "utf8");
      const result = await esbuild.transform(source, {
        format: "esm",
        platform: "node",
        target: "node16",
        minify: true,
      });
      await asyncFs.writeFile(distFilePath, result.code);
    } else if (isJs) {
      const source = await asyncFs.readFile(srcFilePath, "utf8");
      const result = await esbuild.transform(source, {
        format: "cjs",
        platform: "node",
        target: "node16",
        minify: true,
      });
      await asyncFs.writeFile(distFilePath, result.code);
    } else {
      await asyncFs.copyFile(srcFilePath, distFilePath);
    }
  }, true);

  if (hasSrc) {
    await asyncFs.rename(path.join(buildPath, "src"), path.join(buildPath, "dist"));
  }

  if (pkg === "create") {
    const templatePath = path.join(buildPath, "template");
    const templateJsonPath = path.join(templatePath, "package.json");
    const templateJsonContents = await asyncFs.readFile(templateJsonPath, "utf8");
    const templateJson = JSON.parse(templateJsonContents);
    for (const key in templateJson.dependencies) {
      if (key.startsWith("@mango")) {
        templateJson.dependencies[key] = "^" + pkgJson.version;
      }
    }
    for (const key in templateJson.devDependencies) {
      if (key.startsWith("@mango")) {
        templateJson.devDependencies[key] = "^" + pkgJson.version;
      }
    }
    await asyncFs.writeFile(templateJsonPath, JSON.stringify(templateJson, null, 2));
    spawnSync("npm", ["install", "--package-lock-only"], { cwd: templatePath, shell: true, stdio: "inherit" });
  }

}
