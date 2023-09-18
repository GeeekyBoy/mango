/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import sysFs from "fs/promises";
import path from "path";
import chalk from "chalk";
import parseTranslations from "./util/parseTranslations.js";
import extractDynamics from "./util/extractDynamics.js";
import compressCode from "./util/compressCode.js";
import preprocessStaticContent from "./util/preprocessStaticContent.js";

/**
 * @param {import("@parcel/types").BundleGraph} bundleGraph
 * @param {string} srcPath
 * @param {string} outputPath
 * @param {string[]} locales
 * @param {import("@parcel/fs").FileSystem} fs
 */
const localizeStatic = async (bundleGraph, srcPath, outputPath, locales, fs) => {
  const routesSrcPath = path.join(srcPath, "routes");
  const componentsOutPath = path.join(outputPath, "components");
  const localesPath = path.join(srcPath, "locales");
  const allTranslations = {};
  for (const locale of locales) {
    const filePath = path.join(localesPath, `${locale}.json`);
    const fileContent = await sysFs.readFile(filePath, "utf-8");
    try {
      allTranslations[locale] = parseTranslations(JSON.parse(fileContent));
    } catch (e) {
      console.error(chalk.red.bold(`❌ Error parsing ${filePath}`));
      console.error(chalk.red.bold(e.message));
      return;
    }
  }
  const bundles = bundleGraph.getBundles().filter((bundle) => bundle.getMainEntry());
  for (const bundle of bundles) {
    const asset = bundle.getMainEntry();
    const finalPath = bundle.filePath;
    const originalDir = path.dirname(asset.filePath);
    const originalName = path.basename(asset.filePath);
    const isInRoutesDir = !path.relative(routesSrcPath, originalDir).startsWith("..");
    const isComponent = !path.relative(componentsOutPath, finalPath).startsWith("..");
    const isRoute = originalName.startsWith("+") && isInRoutesDir;
    if (isRoute) {
      const routeType = /^\+([a-z]+)\./.exec(originalName)[1];
      if (routeType === "page" || routeType === "pages") {
        const content = await fs.readFile(finalPath, "utf8");
        const [reqTranslations] = await extractDynamics(content);
        for (const [locale, translations] of Object.entries(allTranslations)) {
          const translatedContent = preprocessStaticContent(content, reqTranslations, translations);
          const translatedPath = finalPath.replace(/\.js$/, `.${locale}.js`);
          await fs.writeFile(translatedPath, translatedContent);
          compressCode(translatedContent, translatedPath, fs);
        }
        await fs.unlink(finalPath);
        await fs.unlink(finalPath + ".gz");
        await fs.unlink(finalPath + ".br");
      }
    } else if (isComponent) {
      const content = await fs.readFile(finalPath, "utf8");
      const [reqTranslations] = await extractDynamics(content);
      for (const [locale, translations] of Object.entries(allTranslations)) {
        const translatedContent = preprocessStaticContent(content, reqTranslations, translations);
        const translatedPath = finalPath + `.${locale}`;
        await fs.writeFile(translatedPath, translatedContent);
        compressCode(translatedContent, translatedPath, fs);
      }
      await fs.unlink(finalPath);
      await fs.unlink(finalPath + ".gz");
      await fs.unlink(finalPath + ".br");
    }
  }
}

export default localizeStatic;

