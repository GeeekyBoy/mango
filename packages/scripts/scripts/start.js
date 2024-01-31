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
import { EventEmitter } from "events";
import { Parcel, createWorkerFarm } from "@parcel/core";
import parcelFS from "@parcel/fs";
import chokidar from "chokidar";
import "ora";
import detectLocales from "../util/detectLocales.js";

const { NodeFS, MemoryFS } = parcelFS;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  npm_package_config_devServer_port: port = 4000,
  npm_package_config_browsers: browsers = "> 0%",
  npm_package_config_cdn: cdn = "self",
} = process.env;

const PAGE_RE = /^\+pages?\.(jsx|tsx|js|ts)$/;
const API_RE = /^\+(get|post|put|patch|delete)\.(js|ts)$/;

const cwd = process.cwd();
const srcPath = path.join(cwd, "src");
const inputPath = path.join(srcPath, "index.html");
const outputPath = path.join(cwd, "dist");
const publicPath = path.join(cwd, "public");
const routesPath = path.join(srcPath, "routes");
const localesPath = path.join(srcPath, "locales");
const cacheDir = path.join(cwd, ".cache");
const configDir = path.join(__dirname, "..", ".parcelrc");
const workerFarm = createWorkerFarm();
const inputFS = new NodeFS();
const outputFS = new MemoryFS(workerFarm);

const originalWatch = inputFS.watch.bind(inputFS);
inputFS.watch = async (dir, fn, opts) => {
  let watchTimeout;
  const debouncedFn = (err, events) => {
    clearTimeout(watchTimeout);
    watchTimeout = setTimeout(() => fn(err, events), 100);
  }
  return await originalWatch(dir, debouncedFn, opts);
}

const [locales, rtlLocales, defaultLocale] = await detectLocales(localesPath);

let routesListenerReady = false;
let localesListenerReady = false;

const bundler = new Parcel({
  entries: inputPath,
  config: configDir,
  cacheDir: cacheDir,
  workerFarm: workerFarm,
  inputFS: inputFS,
  outputFS: outputFS,
  defaultTargetOptions: {
    distDir: outputPath,
    engines: {
      browsers: [browsers],
    },
    shouldOptimize: false,
    outputFormat: "global",
    isLibrary: false,
    publicUrl: "/",
    shouldScopeHoist: false
  },
  serveOptions: false,
  hmrOptions: {
    port: 5123,
  },
  env: {
    NODE_ENV: "development",
    SRC_PATH: srcPath,
    OUT_PATH: outputPath,
    PUBLIC_PATH: publicPath,
    LOCALES: locales.join(","),
    RTL_LOCALES: rtlLocales.join(","),
    DEFAULT_LOCALE: defaultLocale,
    CDN: cdn,
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

let pendingBuilds = 0;
const builderReadyEventEmitter = new EventEmitter();

const originalBuild = bundler._build.bind(bundler);
bundler._startNextBuild = async function () {
  pendingBuilds++;
  let currPos = pendingBuilds;
  while (currPos !== 1) {
    await new Promise(resolve => builderReadyEventEmitter.once('ready', resolve));
    currPos--;
  }
  try {
    await workerFarm.callAllWorkers('clearConfigCache', []);
    const watchAbortController = new AbortController();
    const buildEvent = await originalBuild({
      signal: watchAbortController.signal
    });
    pendingBuilds--;
    builderReadyEventEmitter.emit('ready');
    return buildEvent;
  } catch (err) {
    pendingBuilds--;
    builderReadyEventEmitter.emit('ready');
    throw err;
  }
}

const main = async () => {
  try { await fs.access(inputPath) } catch {
    console.error(chalk.red.bold("✖ 🚨 No index.html file found in src directory"));
    process.exit(1);
  }
  await outputFS.mkdirp(outputPath, { recursive: true });
  await fs.mkdir(publicPath, { recursive: true });
  chokidar.watch(routesPath).on('ready', () => {
    routesListenerReady = true;
  }).on('all', (event, changedPath) => {
    if (routesListenerReady) {
      const fileName = path.basename(changedPath);
      if (PAGE_RE.test(fileName) || API_RE.test(fileName)) {
        if (event === "add" || event === "unlink") {
          console.warn(chalk.yellow.bold("🧭 Routes changed. Restart the development server to apply changes."));
        }
      }
    }
  });
  chokidar.watch(localesPath).on('ready', () => {
    localesListenerReady = true;
  }).on('all', (event, changedPath) => {
    if (localesListenerReady) {
      const fileName = path.basename(changedPath);
      if (path.extname(fileName) === ".json") {
        if (event === "add" || event === "unlink") {
          console.warn(chalk.yellow.bold("🌐 Locales changed. Restart the development server to apply changes."));
        }
      }
    }
  });
  await bundler.watch();
};

main();
