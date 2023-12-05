/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import sysFs from "fs/promises";
import path from "path";
import chalk from "chalk";
import compressCode from "./util/compressCode.js";
import removeBuiltFile from "./util/removeBuiltFile.js";
import compileStandaloneServer from "./serverTemplates/standalone.js";
import compileNetlifyServer from "./serverTemplates/netlify.js";
import extractDynamics from "./util/extractDynamics.js";
import parseTranslations from "./util/parseTranslations.js";
import preprocessStaticContent from "./util/preprocessStaticContent.js";
import preprocessDynamicContent from "./util/preprocessDynamicContent.js";

const regexToGlob = (regex) => regex.toString()
  .replaceAll("/^", "")
  .replaceAll("\\/?$/i", "")
  .replaceAll("(\\/|\\/.*)?$/i", "/*")
  .replaceAll("([^/]+)", "*")
  .replaceAll("\\/", "/")
  .replace(/^$/, "/");

/**
 * @param {import("@parcel/types").BundleGraph} bundleGraph
 * @param {string} srcPath
 * @param {string} outputPath
 * @param {string[]} locales
 * @param {string[]} rtlLocales
 * @param {string} defaultLocale
 * @param {number} port
 * @param {import("@parcel/fs").FileSystem} fs
 * @param {import("@parcel/package-manager").PackageManager} packageManager
 */
const buildServer = async (bundleGraph, srcPath, outputPath, locales, rtlLocales, defaultLocale, port, fs, packageManager) => {
  const isNetlify = !!process.env.NETLIFY;
  const routesSrcPath = path.join(srcPath, "routes");
  const componentsOutPath = path.join(outputPath, "components");
  const localesPath = path.join(srcPath, "locales");
  const apisPatterns = [];
  const remoteFns = [];
  const apisFns = [];
  const pagesFns = [];
  const statusPagesFns = {};
  const componentsFns = [];
  let routes = [];
  let statusRoutes = [];
  let staticRoutes = [];
  let staticStatusRoutes = [];
  let notFoundRoutes = [];
  /** @type {{[key: string]: Set}} */
  const remoteFnsIds = {};
  const functionsIds = new Set();
  const allTranslations = [];
  for (const locale of locales) {
    const filePath = path.join(localesPath, `${locale}.json`);
    const fileContent = await sysFs.readFile(filePath, "utf-8");
    try {
      allTranslations.push(parseTranslations(JSON.parse(fileContent)));
    } catch (e) {
      console.error(chalk.red.bold(`✖ 🚨 Error parsing ${filePath}`));
      console.error(chalk.red.bold(e.message));
      return;
    }
  }
  const htmlFile = await fs.readFile(path.join(outputPath, "index.html"), "utf8");
  if (isNetlify) {
    await removeBuiltFile(path.join(outputPath, "index.html"), fs);
  }
  const htmlChunks = htmlFile.split(/(window\.\$cp\s*=\s*\[.*?\],)function.*?(<\/script>)/s);
  const bundles = bundleGraph.getBundles().filter((bundle) => bundle.getMainEntry());
  const nodeDeps = new Set();
  for (const bundle of bundles) {
    const asset = bundle.getMainEntry();
    if (asset.meta.nodeDeps) asset.meta.nodeDeps.forEach((dep) => nodeDeps.add(dep));
    const finalPath = bundle.filePath;
    const originalDir = path.dirname(asset.filePath);
    const originalName = path.basename(asset.filePath);
    const isInRoutesDir = !path.relative(routesSrcPath, originalDir).startsWith('..');
    const isComponent = !path.relative(componentsOutPath, finalPath).startsWith('..');
    const isRoute = originalName.startsWith('+') && isInRoutesDir;
    if (isRoute) {
      const routeData = bundleGraph.getIncomingDependencies(asset)[0].meta;
      const statusCode = routeData.statusCode;
      const routePattern = routeData.pattern;
      const routeEntities = routeData.entities;
      const routeRegex = routeData.regex;
      const routePriority = routeData.priority;
      const routeType = statusCode ? "status" : /^\+([a-z]+)\./.exec(originalName)[1];
      const supportedMethods = ['get', 'post', 'put', 'delete', 'patch'];
      if (supportedMethods.includes(routeType)) {
        routes.push([routePattern, routeEntities, routeRegex, routePriority]);
        apisPatterns.push(routePattern);
        const functionId = /function\.([\da-z]{8})\.js$/.exec(finalPath)[1];
        functionsIds.add(functionId);
        apisFns.push(`
          ${JSON.stringify(routeType.toUpperCase() + routePattern)}: async (functionArgs) => await fn${functionId}(functionArgs)
        `);
      } else if (routeType === "page" || routeType === "pages" || routeType === "status") {
        const content = await fs.readFile(finalPath, "utf8");
        const [reqTranslations, reqFunctions, reqRemoteFunctions] = await extractDynamics(content);
        for (const remoteFunctionStart in reqRemoteFunctions) {
          const [functionId, functionName] = reqRemoteFunctions[remoteFunctionStart];
          if (!remoteFnsIds[functionId]) {
            remoteFnsIds[functionId] = new Set();
          }
          remoteFnsIds[functionId].add(functionName);
          remoteFns.push(`
            ${JSON.stringify(functionId + functionName)}: async (functionArgs) => await fn${functionId}_${functionName}(...functionArgs)
          `);
        }
        if (Object.keys(reqFunctions).length) {
          await removeBuiltFile(finalPath, fs);
          if (routeType === "status") {
            statusRoutes.push([routePattern, routeEntities, routeRegex, statusCode, routePriority]);
          } else {
            routes.push([routePattern, routeEntities, routeRegex, routePriority]);
          }
          const pageFunctionsIds = new Set();
          for (const functionStart in reqFunctions) {
            const [functionId] = reqFunctions[functionStart];
            functionsIds.add(functionId);
            pageFunctionsIds.add(functionId);
          }
          const preprocessedContent = preprocessDynamicContent(content, reqTranslations, reqFunctions, reqRemoteFunctions, allTranslations);
          const pageFn = `
            ${JSON.stringify(routePattern)}: async (functionArgs) => {
              let statusCode = 200;
              const headers = {};
              ${Array.from(pageFunctionsIds).map((functionId) => `const fn${functionId}_res = await fn${functionId}(functionArgs);
              statusCode = Number(fn${functionId}_res.statusCode) || statusCode;
              if ((statusCode / 100 | 0) > 2) return { headers: fn${functionId}_res.headers, statusCode };
              Object.assign(headers, fn${functionId}_res.headers);`).join("\n  ")}
              ${locales.length ? `const locale = functionArgs.locale;
              const localeIndex = localesToIndex[locale];` : ""}
              return {
                data: ${locales.length ? '"window.$l=" + JSON.stringify(locale) + "," + ' : ""}${rtlLocales.length ? '(rtlLocalesFinder[locale] ? "document.documentElement.style.direction=\\"rtl\\"," : "") + ' : ""}${preprocessedContent},
                headers,
                statusCode,
              }
            }
          `;
          if (routeType === "status") {
            if (!statusPagesFns[statusCode]) {
              statusPagesFns[statusCode] = [];
            }
            statusPagesFns[statusCode].push(pageFn);
            if (statusCode === "404" || statusCode === "4xx") {
              notFoundRoutes.push([routeRegex, null, routePriority]);
            }
          } else {
            pagesFns.push(pageFn);
          }
        } else {
          if (locales.length) {
            for (const [localeIndex, locale] of locales.entries()) {
              const localeRouteRegex = new RegExp(routeRegex.source.replace(/\(\?:\\\/\(.*?\)\)\?/, `(?:\\/(${locale}))${locale === defaultLocale ? "?" : ""}`), routeRegex.flags);
              const translatedContent = preprocessStaticContent(content, reqTranslations, allTranslations[localeIndex], reqRemoteFunctions);
              const localeDeclarator = `window.$l=${JSON.stringify(locale)},`;
              const rtlSetter = rtlLocales.includes(locale) ? 'document.documentElement.style.direction="rtl",' : "";
              const staticHtmlChunks = htmlChunks[0] + htmlChunks[1] + localeDeclarator + rtlSetter + translatedContent + htmlChunks[2] + htmlChunks[3];
              const staticHtmlPath = path.join(path.dirname(finalPath), path.basename(finalPath, ".js") + "." + locale + ".html");
              const staticHtmlRoutePath = "/" + path.relative(outputPath, staticHtmlPath).replaceAll(path.sep, "/");
              await fs.writeFile(staticHtmlPath, staticHtmlChunks);
              if (routeType === "status") {
                if (isNetlify) {
                  if (statusCode === "404" || statusCode === "4xx") {
                    await fs.writeFile(staticHtmlPath, staticHtmlChunks);
                    compressCode(staticHtmlChunks, staticHtmlPath, fs);
                  }
                  staticStatusRoutes.push([localeRouteRegex, staticHtmlChunks, statusCode, routePriority]);
                } else {
                  await fs.writeFile(staticHtmlPath, staticHtmlChunks);
                  compressCode(staticHtmlChunks, staticHtmlPath, fs);
                  staticStatusRoutes.push([localeRouteRegex, staticHtmlRoutePath, statusCode, routePriority]);
                }
                if (statusCode === "404" || statusCode === "4xx") {
                  notFoundRoutes.push([localeRouteRegex, staticHtmlRoutePath, routePriority]);
                }
              } else {
                await fs.writeFile(staticHtmlPath, staticHtmlChunks);
                compressCode(staticHtmlChunks, staticHtmlPath, fs);
                staticRoutes.push([localeRouteRegex, staticHtmlRoutePath, routePriority]);
              }
            }
          } else {
            const preprocessedContent = Object.keys(reqRemoteFunctions).length
              ? preprocessStaticContent(content, reqTranslations, {}, reqRemoteFunctions)
              : content;
            const staticHtmlChunks = htmlChunks[0] + htmlChunks[1] + preprocessedContent + htmlChunks[2] + htmlChunks[3];
            const staticHtmlPath = path.join(path.dirname(finalPath), path.basename(finalPath, ".js") + ".html");
            const staticHtmlRoutePath = "/" + path.relative(outputPath, staticHtmlPath).replaceAll(path.sep, "/");
            if (routeType === "status") {
              if (isNetlify) {
                if (statusCode === "404" || statusCode === "4xx") {
                  await fs.writeFile(staticHtmlPath, staticHtmlChunks);
                  compressCode(staticHtmlChunks, staticHtmlPath, fs);
                }
                staticStatusRoutes.push([routeRegex, staticHtmlChunks, statusCode, routePriority]);
              } else {
                await fs.writeFile(staticHtmlPath, staticHtmlChunks);
                compressCode(staticHtmlChunks, staticHtmlPath, fs);
                staticStatusRoutes.push([routeRegex, staticHtmlRoutePath, statusCode, routePriority]);
              }
              if (statusCode === "404" || statusCode === "4xx") {
                notFoundRoutes.push([routeRegex, staticHtmlRoutePath, routePriority]);
              }
            } else {
              await fs.writeFile(staticHtmlPath, staticHtmlChunks);
              compressCode(staticHtmlChunks, staticHtmlPath, fs);
              staticRoutes.push([routeRegex, staticHtmlRoutePath, routePriority]);
            }
          }
          await removeBuiltFile(finalPath, fs);
        }
      }
    } else if (isComponent) {
      const content = await fs.readFile(finalPath, "utf8");
      const [reqTranslations, reqFunctions, reqRemoteFunctions] = await extractDynamics(content);
      for (const remoteFunctionStart in reqRemoteFunctions) {
        const [functionId, functionName] = reqRemoteFunctions[remoteFunctionStart];
        if (!remoteFnsIds[functionId]) {
          remoteFnsIds[functionId] = new Set();
        }
        remoteFnsIds[functionId].add(functionName);
        remoteFns.push(`
          ${JSON.stringify(functionId + functionName)}: async (functionArgs) => await fn${functionId}_${functionName}(...functionArgs)
        `);
      }
      if (Object.keys(reqFunctions).length) {
        await removeBuiltFile(finalPath, fs);
        const componentFunctionsIds = new Set();
        for (const functionStart in reqFunctions) {
          const [functionId] = reqFunctions[functionStart];
          functionsIds.add(functionId);
          componentFunctionsIds.add(functionId);
        }
        const preprocessedContent = preprocessDynamicContent(content, reqTranslations, reqFunctions, reqRemoteFunctions, allTranslations);
        const finalRelPathname = "/" + path.relative(outputPath, finalPath).replaceAll(path.sep, "/");
        componentsFns.push(`
          ${JSON.stringify(finalRelPathname)}: async (functionArgs) => {
            let statusCode = 200;
            const headers = {};
            ${Array.from(componentFunctionsIds).map((functionId) => `const fn${functionId}_res = await fn${functionId}(functionArgs);
            statusCode = fn${functionId}_res.statusCode;
            if ((statusCode / 100 | 0) > 2) return { headers: fn${functionId}_res.headers, statusCode };
            else Object.assign(headers, fn${functionId}_res.headers);`).join("\n  ")}
            return {
              data: ${preprocessedContent},
              headers,
              statusCode,
            }
          }
        `);
      } else if (locales.length) {
        for (const [localeIndex, locale] of locales.entries()) {
          const translatedContent = preprocessStaticContent(content, reqTranslations, allTranslations[localeIndex], reqRemoteFunctions);
          const translatedPath = finalPath + `.${locale}`;
          await fs.writeFile(translatedPath, translatedContent);
          compressCode(translatedContent, translatedPath, fs);
        }
        await removeBuiltFile(finalPath, fs);
      } else if (Object.keys(reqRemoteFunctions).length) {
        const preprocessedContent = preprocessStaticContent(content, reqTranslations, {}, reqRemoteFunctions);
        await removeBuiltFile(finalPath, fs);
        await fs.writeFile(finalPath, preprocessedContent);
        compressCode(preprocessedContent, finalPath, fs);
      }
    }
  }
  statusRoutes.sort((a, b) => a[4] - b[4]);
  statusRoutes = statusRoutes.flatMap(([routePattern, routeEntities, routeRegex, statusCode]) => [routePattern, routeEntities, routeRegex, statusCode]);
  staticStatusRoutes.sort((a, b) => a[3] - b[3]);
  staticStatusRoutes = staticStatusRoutes.map(([routeRegex, staticHtmlRoutePath, statusCode]) => [routeRegex, staticHtmlRoutePath, statusCode]);
  routes.sort((a, b) => a[3] - b[3]);
  routes = routes.flatMap(([routePattern, routeEntities, routeRegex]) => [routePattern, routeEntities, routeRegex]);
  staticRoutes.sort((a, b) => a[2] - b[2]);
  staticRoutes = staticRoutes.map(([routeRegex, staticHtmlRoutePath]) => [routeRegex, staticHtmlRoutePath]);
  notFoundRoutes.sort((a, b) => a[2] - b[2]);
  notFoundRoutes = notFoundRoutes.map(([routeRegex, staticHtmlRoutePath]) => [routeRegex, staticHtmlRoutePath]);
  const dynamicHtmlChunks = htmlChunks.map((chunk) => JSON.stringify(chunk));
  dynamicHtmlChunks.splice(2, 0, "data");
  const serverFile = isNetlify
    ? compileNetlifyServer(functionsIds, remoteFnsIds, routes, statusRoutes, apisPatterns, remoteFns, apisFns, pagesFns, statusPagesFns, componentsFns, dynamicHtmlChunks, locales, rtlLocales, defaultLocale, staticStatusRoutes)
    : compileStandaloneServer(functionsIds, remoteFnsIds, routes, statusRoutes, apisPatterns, remoteFns, apisFns, pagesFns, statusPagesFns, componentsFns, dynamicHtmlChunks, locales, rtlLocales, defaultLocale, staticRoutes, staticStatusRoutes, port);
  const serverFileRelDir = isNetlify ? "./__mango__/netlify/functions" : "./";
  const serverFileAbsDir = path.join(outputPath, serverFileRelDir);
  await fs.mkdirp(serverFileAbsDir);
  await fs.writeFile(path.join(serverFileAbsDir, "server.js"), serverFile);
  if (isNetlify) {
    const serverRoutes = [];
    for (let i = 2; i < routes.length; i += 3) {
      serverRoutes.push(routes[i]);
    }
    const redirectsLines = [
      "/__mango__/* /.netlify/functions/server 200!",
      ...serverRoutes.map((route) => regexToGlob(route) + " /.netlify/functions/server 200"),
      ...staticRoutes.map(([route, staticHtmlRoutePath]) => regexToGlob(route) + " " + staticHtmlRoutePath + " 200"),
      ...notFoundRoutes.map(([route, staticHtmlRoutePath]) => regexToGlob(route) + " " + (staticHtmlRoutePath || "/.netlify/functions/server") + (staticHtmlRoutePath ? " 404" : " 200")),
    ];
    const redirectsFile = redirectsLines.join("\n");
    await fs.writeFile(path.join(outputPath, "_redirects"), redirectsFile);
    const netlifyConfigFile = '[functions]\n  directory = "dist/__mango__/netlify/functions"\n  node_bundler = "esbuild"';
    await fs.writeFile(path.join(outputPath, ".." ,"netlify.toml"), netlifyConfigFile);
  } else {
    const packageJson = {
      "type": "module",
      "dependencies": {},
    }
    for (const nodeDep of nodeDeps) {
      const { pkg } = await packageManager.resolve(nodeDep, srcPath, {
        range: null,
        shouldAutoInstall: false,
        saveDev: false,
      });
      packageJson.dependencies[pkg.name] = pkg.version;
    }
    await fs.writeFile(path.join(outputPath, "package.json"), JSON.stringify(packageJson, null, 2));
  }
}

export default buildServer;
