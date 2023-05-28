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
import { Parcel, createWorkerFarm } from "@parcel/core";
import parcelFS from "@parcel/fs";

const { MemoryFS } = parcelFS;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  npm_package_config_devServer_port: port = 4000,
  npm_package_config_browsers: browsers = "> 0%",
} = process.env;

const cwd = process.cwd();
const inputPath = path.join(cwd, "src", "index.html");
const outputPath = path.join(cwd, "dist");
const publicPath = path.join(cwd, "public");
const cacheDir = path.join(cwd, ".cache");
const configDir = path.join(__dirname, "..", ".parcelrc");
const workerFarm = createWorkerFarm();
const outputFS = new MemoryFS(workerFarm);

const bundler = new Parcel({
  entries: inputPath,
  config: configDir,
  cacheDir: cacheDir,
  workerFarm: workerFarm,
  outputFS: outputFS,
  defaultTargetOptions: {
    distDir: outputPath,
    engines: {
      browsers: [browsers],
    },
    shouldOptimize: false,
    outputFormat: "esmodule",
    isLibrary: false,
    publicUrl: "/",
    shouldScopeHoist: false
  },
  serveOptions: false,
  hmrOptions: {
    port: 5123,
  },
  env: {
    SRC_PATH: path.join(cwd, "src"),
    OUT_PATH: path.join(cwd, "dist"),
    PUBLIC_PATH: path.join(cwd, "public"),
    PORT: port,
  },
  additionalReporters: [
    {
      packageName: "@parcel/reporter-dev-server",
      resolveFrom: __dirname,
    },
    {
      packageName: "@mango-js/parcel-reporter-development",
      resolveFrom: __dirname,
    },
  ],
});


const main = async () => {
  try { await fs.access(inputPath) } catch {
    console.log(chalk.red("❌ No index.html file found in src directory"));
    process.exit(1);
  }
  await outputFS.mkdirp(outputPath, { recursive: true });
  await fs.mkdir(publicPath, { recursive: true });
  await bundler.watch();
};

main();
