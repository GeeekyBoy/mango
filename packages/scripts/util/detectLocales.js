/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

/**
 * @param {string} localesPath
 * @returns {Promise<[string[], string[], string]>}
 */
export default async function detectLocales(localesPath) {
  const locales = [];
  let defaultLocale = process.env.npm_package_config_locales_default || "";
  const rtlLocales = (process.env.npm_package_config_locales_rtl || "").split(/\s+/).filter(Boolean);
  try {
    await fs.access(localesPath);
    const translationsFiles = await fs.readdir(localesPath);
    for (const translationsFile of translationsFiles) {
      const ext = path.extname(translationsFile);
      if (ext !== ".json") {
        console.error(chalk.red.bold(`✖ 🚨 Only JSON files are allowed in locales directory. Found "${translationsFile}"`));
        process.exit(1);
      }
      const locale = translationsFile.replace(/\.json$/i, "");
      locales.push(locale);
    }
    if (locales.length) {
      if (!defaultLocale) {
        defaultLocale = locales[0];
      } else if (!locales.includes(defaultLocale)) {
        console.error(chalk.red.bold(`✖ 🚨 Invalid default locale "${defaultLocale}"`));
        process.exit(1);
      }
    }
  } catch {}
  return [locales, rtlLocales, defaultLocale];
}
