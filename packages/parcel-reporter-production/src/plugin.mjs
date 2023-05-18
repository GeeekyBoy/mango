/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import chalk from "chalk";
import ora from "ora";
import parcelUtils from '@parcel/utils';
import { filesize } from "filesize";
import { Reporter } from '@parcel/plugin';
import buildServer from "./buildServer.mjs";

const { prettyDiagnostic, prettifyTime } = parcelUtils;

const spinner = ora();

export default new Reporter({
  async report({ event, options }) {
    if (event.type === 'buildSuccess') {
      const { SRC_PATH: srcPath, OUT_PATH: outputPath } = options.env;
      const fs = options.outputFS;
      const bundleGraph = event.bundleGraph;
      const buildTime = event.buildTime;
      if (spinner.isSpinning) {
        spinner.succeed(chalk.green.bold(`✨ Bundled in ${prettifyTime(buildTime)}.\n`));
      }
      const bundlesData = bundleGraph.getBundles().map(bundle => ({
        dir: path.relative(process.cwd(), path.dirname(bundle.filePath)).replaceAll(path.sep, '/') + "/",
        name: path.basename(bundle.filePath),
        size: filesize(bundle.stats.size, { base: 2, standard: "jedec" }),
      }));
      const longestPathLength = Math.max(...bundlesData.map(data => data.dir.length + data.name.length));
      const longestSizeLength = Math.max(...bundlesData.map(data => data.size.length));
      for (const { dir: bundleDir, name: bundleName, size: bundleSize } of bundlesData) {
        const pathPadding = ' '.repeat(longestPathLength - bundleDir.length - bundleName.length + 5);
        const sizePadding = ' '.repeat(longestSizeLength - bundleSize.length);
        console.log(`${(chalk.dim(bundleDir) + chalk.cyan.bold(bundleName))}${pathPadding}${sizePadding}${chalk.magenta.bold(bundleSize)}`);
      }
      console.log('');
      const functionsDetected = await fs.exists(path.join(outputPath, '__mango__/functions'));
      if (functionsDetected) {
        spinner.start(chalk.yellow.bold(`🔥 Functions detected. Building server...`));
        const port = parseInt(options.env["npm_package_config_prodServer_port"] || "3000", 10);
        buildServer(bundleGraph, srcPath, outputPath, port, fs, options.packageManager);
        if (spinner.isSpinning) {
          spinner.succeed(chalk.green.bold(`✨ Server built.`));
        }
      } else {
        const isNetlify = !!process.env.NETLIFY;
        if (isNetlify) {
          spinner.start(chalk.yellow.bold(`🔥 Netlify detected. Writing _redirects...`));
          await fs.writeFile(path.join(outputPath, '_redirects'), `/* /index.html 200`);
          if (spinner.isSpinning) {
            spinner.succeed(chalk.green.bold(`✨ _redirects written.`));
          }
        }
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
