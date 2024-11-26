/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import chalk from "chalk";
import ora from "ora";
import parcelUtils from '@parcel/utils';
import { Reporter } from '@parcel/plugin';
import Server from "./Server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { prettyDiagnostic } = parcelUtils;

const spinner = ora();

if (!process.versions.bun) {
  const { register } = await import("module");
  register("./util/httpLoader.node.js", pathToFileURL(__dirname + path.sep));
}

/** @type {Map<number, Server>} */
const servers = new Map();

export default new Reporter({
  async report({ event, options }) {
    if (event.type === 'watchStart') {
      const fs = options.outputFS;
      const {
        PORT: port,
        SRC_PATH: srcPath,
        OUT_PATH: outputPath,
        PUBLIC_PATH: publicPath,
        LOCALES: stringifiedLocales,
        RTL_LOCALES: stringifiedRtlLocales,
        DEFAULT_LOCALE: defaultLocale,
      } = options.env;
      const locales = stringifiedLocales.split(",").filter(Boolean);
      const rtlLocales = stringifiedRtlLocales.split(",").filter(Boolean);
      servers.set(port, new Server(port, srcPath, outputPath, publicPath, locales, rtlLocales, defaultLocale, fs, spinner));
    } else if (event.type === 'watchEnd') {
      const { PORT: port } = options.env;
      const server = servers.get(port);
      if (server) {
        server.close();
        servers.delete(port);
      }
    } else if (event.type === 'buildSuccess') {
      const { PORT: port } = options.env;
      const server = servers.get(port);
      const bundleGraph = event.bundleGraph;
      const changedAssets = event.changedAssets;
      const buildTime = new Date().toLocaleTimeString();
      server.resume(bundleGraph, options.env, changedAssets);
      if (spinner.isSpinning) {
        spinner.succeed(chalk.green.bold(`✨ ${changedAssets.size || "No"} assets changed @ ${buildTime}.\n`));
      }
    } else if (event.type === 'buildFailure') {
      const diagnostics = event.diagnostics;
      if (spinner.isSpinning) {
        spinner.fail(chalk.red.bold(`🚨 Build failed with ${diagnostics.length} errors.\n`));
        for (const diagnostic of diagnostics) {
          const { message, codeframe, hints, documentation } = await prettyDiagnostic(diagnostic, options);
          console.log(`${chalk.red.bold(message)}\n`);
          if (codeframe) {
            console.log(`${codeframe}\n`);
          }
          if (hints.length) {
            console.log(chalk.yellow.bold('💡 Possible solutions:'));
            for (const hint of hints) {
              console.log(`  ${hint}`);
            }
            console.log('');
          }
          if (documentation) {
            console.log(chalk.blue.bold(`📙 ${documentation}`));
          }
        }
      }
    } else if (event.type === 'buildStart') {
      const { PORT: port } = options.env;
      const server = servers.get(port);
      server.pause();
      spinner.start(chalk.cyan.bold(`🚧 Building...`));
    } else if (event.type === 'buildProgress') {
      switch (event.phase) {
        case 'transforming':
          spinner.start(chalk.cyan.bold(`⚒️ Transforming ${event.filePath}...`));
          break;
        case 'resolving':
          spinner.start(chalk.cyan.bold(`🔍 Resolving ${event.dependency.specifier}...`));
          break;
        case 'bundling':
          spinner.start(chalk.cyan.bold(`📦 Bundling...`));
          break;
        case 'packaging':
          spinner.start(chalk.cyan.bold(`📦 Packaging ${event.bundle.displayName}...`));
          break;
        case 'optimizing':
          spinner.start(chalk.cyan.bold(`🗜️ Optimizing ${event.bundle.displayName}...`));
          break;
      }
    }
  }
});
