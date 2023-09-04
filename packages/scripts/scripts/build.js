/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { Parcel } from "@parcel/core";
import NameMinifier from "../util/NameMinifier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  npm_package_config_nameMinifier_port: minifierPort = 2023,
  npm_package_config_publicUrl: publicUrl = "/",
  npm_package_config_browsers: browsers = "> 0%",
} = process.env;

const shouldCompress = !process.env.NETLIFY;
const configName = shouldCompress ? ".parcelrc.compression" : ".parcelrc";

const cwd = process.cwd();
const inputPath = path.join(cwd, "src", "index.html");
const outputPath = path.join(cwd, "dist");
const publicPath = path.join(cwd, "public");
const cachePath = path.join(cwd, ".cache");
const configPath = path.join(__dirname, "..", configName);

const copyDir = async (src, dest) => {
  const files = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dest, { recursive: true });
  for (const file of files) {
    if (file.isDirectory()) {
      await copyDir(path.join(src, file.name), path.join(dest, file.name));
    } else {
      await fs.copyFile(path.join(src, file.name), path.join(dest, file.name));
    }
  }
};

const bundler = new Parcel({
  entries: inputPath,
  config: configPath,
  cacheDir: cachePath,
  mode: "production",
  defaultTargetOptions: {
    distDir: outputPath,
    engines: {
      browsers: [browsers],
    },
    shouldOptimize: true,
    outputFormat: "global",
    isLibrary: true,
    publicUrl: publicUrl,
    shouldScopeHoist: true,
    sourceMaps: false,
  },
  env: {
    NODE_ENV: "production",
    SRC_PATH: path.join(cwd, "src"),
    OUT_PATH: path.join(cwd, "dist"),
    MINIFIER_PORT: minifierPort,
  },
  additionalReporters: [
    {
      packageName: "@mango-js/parcel-reporter-production",
      resolveFrom: __dirname,
    },
  ],
});

const main = async () => {
  try {
    try { await fs.access(inputPath) } catch {
      console.log(chalk.red("❌ No index.html file found in src directory"));
      process.exit(1);
    }
    await fs.rm(cachePath, { recursive: true, force: true });
    await fs.rm(outputPath, { recursive: true, force: true });
    await fs.mkdir(outputPath, { recursive: true });
    await fs.mkdir(publicPath, { recursive: true });
    await copyDir(publicPath, outputPath);
    await bundler.run();
  } catch (err) {
    if (err.diagnostics) {
      console.log(chalk.red("❌ Build failed with errors:"));
      console.log(err.diagnostics);
    } else {
      console.log(err);
    }
  }
};

new NameMinifier(minifierPort, main);
