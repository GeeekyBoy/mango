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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  npm_package_config_publicUrl: publicUrl = "/",
  npm_package_config_browsers: browsers = "> 0%",
} = process.env;

const cwd = process.cwd();
const inputPath = path.join(cwd, "src", "index.html");
const outputPath = path.join(cwd, "dist");
const publicPath = path.join(cwd, "public");
const cachePath = path.join(cwd, ".cache");
const configPath = path.join(__dirname, "..", ".parcelrc");

// if (fs.existsSync(cachePath)) {
//   fs.rmSync(cachePath, { recursive: true });
// }

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
    isLibrary: false,
    publicUrl: publicUrl,
    shouldScopeHoist: true,
    sourceMaps: false,
  },
  env: {
    NODE_ENV: "production",
    SRC_PATH: path.join(cwd, "src"),
    OUT_PATH: path.join(cwd, "dist"),
  },
  additionalReporters: [
    {
      packageName: "@mango-js/parcel-reporter-production",
      resolveFrom: cwd,
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
    const publicFiles = await fs.readdir(publicPath);
    for (const file of publicFiles) {
      await fs.copyFile(path.join(publicPath, file), path.join(outputPath, file));
    }
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

main();
