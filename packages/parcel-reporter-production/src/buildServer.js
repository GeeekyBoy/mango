/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { createGzip, createBrotliCompress } from "zlib";
import compileStandaloneServer from "./serverTemplates/standalone.js";
import compileNetlifyServer from "./serverTemplates/netlify.js";

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
 * @param {number} port
 * @param {import("@parcel/fs").FileSystem} fs
 * @param {import("@parcel/package-manager").PackageManager} packageManager
 */
const buildServer = async (bundleGraph, srcPath, outputPath, port, fs, packageManager) => {
  const isNetlify = !!process.env.NETLIFY;
  const routesSrcPath = path.join(srcPath, "routes");
  const componentsOutPath = path.join(outputPath, "components");
  const apisPatterns = [];
  const remoteFns = [];
  const apisFns = [];
  const pagesFns = [];
  const componentsFns = [];
  const routes = [];
  /** @type {[string, string][]} */
  const staticRoutes = [];
  /** @type {{[key: string]: Set}} */
  const remoteFnsUids = {};
  const functionsUids = new Set();
  const htmlFile = await fs.readFile(path.join(outputPath, "index.html"), "utf8");
  if (isNetlify) await fs.unlink(path.join(outputPath, "index.html"));
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
      const routeType = /^\+([a-z]+)\./.exec(originalName)[1];
      const routePattern = routeData.pattern;
      const routeEntities = routeData.entities;
      const routeRegex = routeData.regex;
      const supportedMethods = ['get', 'post', 'put', 'delete', 'patch'];
      if (supportedMethods.includes(routeType)) {
        routes.push(routePattern, routeEntities, routeRegex);
        apisPatterns.push(routePattern);
        const functionUid = /function\.([\da-z]{8})\.js$/.exec(finalPath)[1];
        functionsUids.add(functionUid);
        apisFns.push(`
          ${JSON.stringify(routeType.toUpperCase() + routePattern)}: async (functionArgs) => await fn${functionUid}(functionArgs)
        `);
      } else if (routeType === "page" || routeType === "pages") {
        let content = await fs.readFile(finalPath, "utf8");
        content = content.replace(/"\/__mango__\/functions\/function\.([\da-z]{8})\.js\@(.*?)"/g, (_, functionUid, functionName) => {
          if (!remoteFnsUids[functionUid]) {
            remoteFnsUids[functionUid] = new Set();
          }
          remoteFnsUids[functionUid].add(functionName);
          remoteFns.push(`
            ${JSON.stringify(functionUid + functionName)}: async (functionArgs) => await fn${functionUid}_${functionName}(...functionArgs)
          `);
          return `"/__mango__/call?fn=${functionUid + functionName}"`;
        });
        if (content.search(/"(\/__mango__\/functions\/function\.[\da-z]{8}\.js\#.*?)"/) !== -1) {
          await fs.unlink(finalPath);
          routes.push(routePattern, routeEntities, routeRegex);
          const chunks = content.split(/"(\/__mango__\/functions\/function\.[\da-z]{8}\.js\#.*?)"/);
          const pageFunctionsUids = new Set();
          chunks.forEach((chunk, index) => {
            if (index % 2 !== 0) {
              const [, functionUid, functionResultName] = /\/__mango__\/functions\/function\.([\da-z]{8})\.js\#(.*)/.exec(chunk);
              functionsUids.add(functionUid);
              pageFunctionsUids.add(functionUid);
              chunks[index] = `JSON.stringify(fn${functionUid}_res.data[${JSON.stringify(functionResultName)}])`;
            } else {
              chunks[index] = JSON.stringify(chunk);
            }
          });
          pagesFns.push(`
            ${JSON.stringify(routePattern)}: async (functionArgs) => {
              ${Array.from(pageFunctionsUids).map((functionUid) => `const fn${functionUid}_res = await fn${functionUid}(functionArgs);`).join("\n  ")}
              return {
                data: ${chunks.join(" + ")},
                headers: {${Array.from(pageFunctionsUids).map((functionUid) => `...fn${functionUid}_res.headers`).join(", ")}},
                statusCode: ${Array.from(pageFunctionsUids).map((functionUid) => `fn${functionUid}_res.statusCode`).join(" || ")} || 200
              }
            }
          `);
        } else {
          const staticHtmlChunks = htmlChunks[0] + htmlChunks[1] + content + htmlChunks[2] + htmlChunks[3];
          const staticHtmlPath = path.join(path.dirname(finalPath), path.basename(finalPath, ".js") + ".html");
          const staticHtmlRoutePath = "/" + path.relative(outputPath, staticHtmlPath).replaceAll(path.sep, "/");
          await fs.writeFile(staticHtmlPath, staticHtmlChunks);
          await fs.unlink(finalPath);
          if (!isNetlify) {
            const gzip = createGzip();
            const gzipStream = fs.createWriteStream(staticHtmlPath + ".gz");
            gzip.pipe(gzipStream);
            gzip.write(staticHtmlChunks);
            gzip.end();
            const brotli = createBrotliCompress();
            const brotliStream = fs.createWriteStream(staticHtmlPath + ".br");
            brotli.pipe(brotliStream);
            brotli.write(staticHtmlChunks);
            brotli.end();
          }
          staticRoutes.push([routeRegex, staticHtmlRoutePath])
        }
      }
    } else if (isComponent) {
      let content = await fs.readFile(finalPath, "utf8");
      content = content.replace(/"\/__mango__\/functions\/function\.([\da-z]{8})\.js\@(.*?)"/g, (_, functionUid, functionName) => {
        if (!remoteFnsUids[functionUid]) {
          remoteFnsUids[functionUid] = new Set();
        }
        remoteFnsUids[functionUid].add(functionName);
        remoteFns.push(`
          ${JSON.stringify(functionUid + functionName)}: async (functionArgs) => await fn${functionUid}_${functionName}(...functionArgs)
        `);
        return `"/__mango__/call?fn=${functionUid + functionName}"`;
      });
      const finalRelPathname = "/" + path.relative(outputPath, finalPath).replaceAll(path.sep, "/");
      if (content.search(/"(\/__mango__\/functions\/function\.[\da-z]{8}\.js\#.*?)"/) !== -1) {
        await fs.unlink(finalPath);
        await fs.unlink(finalPath + ".gz");
        await fs.unlink(finalPath + ".br");
        routes.push(routePattern, routeEntities, routeRegex);
        const chunks = content.split(/"(\/__mango__\/functions\/function\.[\da-z]{8}\.js\#.*?)"/);
        const componentFunctionsUids = new Set();
        chunks.forEach((chunk, index) => {
          if (index % 2 !== 0) {
            const [, functionUid, functionResultName] = /\/__mango__\/functions\/function\.([\da-z]{8})\.js\#(.*)/.exec(chunk);
            functionsUids.add(functionUid);
            componentFunctionsUids.add(functionUid);
            chunks[index] = `JSON.stringify(fn${functionUid}_res.data[${JSON.stringify(functionResultName)}])`;
          } else {
            chunks[index] = JSON.stringify(chunk);
          }
        });
        componentsFns.push(`
          ${JSON.stringify(finalRelPathname)}: async (functionArgs) => {
            ${Array.from(componentFunctionsUids).map((functionUid) => `const fn${functionUid}_res = await fn${functionUid}(functionArgs);`).join("\n  ")}
            return {
              data: ${chunks.join(" + ")},
              headers: {${Array.from(componentFunctionsUids).map((functionUid) => `...fn${functionUid}_res.headers`).join(", ")}},
              statusCode: ${Array.from(componentFunctionsUids).map((functionUid) => `fn${functionUid}_res.statusCode`).join(" || ")} || 200
            }
          }
        `);
      }
    }
  }
  const dynamicHtmlChunks = htmlChunks.map((chunk) => JSON.stringify(chunk));
  dynamicHtmlChunks.splice(2, 0, "data");
  const serverFile = isNetlify
    ? compileNetlifyServer(functionsUids, remoteFnsUids, routes, apisPatterns, remoteFns, apisFns, pagesFns, componentsFns, dynamicHtmlChunks)
    : compileStandaloneServer(functionsUids, remoteFnsUids, routes, apisPatterns, remoteFns, apisFns, pagesFns, componentsFns, dynamicHtmlChunks, staticRoutes, port);
  const serverFileRelDir = isNetlify ? "./__mango__/netlify/functions" : "./";
  const serverFileAbsDir = path.join(outputPath, serverFileRelDir);
  await fs.mkdirp(serverFileAbsDir);
  await fs.writeFile(path.join(serverFileAbsDir, "server.js"), serverFile);
  if (isNetlify) {
    const serverRoutes = [];
    for (let i = 2; i < routes.length; i += 3) {
      serverRoutes.push(routes[i]);
    }
    const redirectsFile = [
      "/__mango__/* /.netlify/functions/server 200!",
      ...serverRoutes.map((route) => regexToGlob(route) + " /.netlify/functions/server 200"),
      ...staticRoutes.map(([route, staticHtmlRoutePath]) => regexToGlob(route) + " " + staticHtmlRoutePath + " 200")
    ].join("\n");
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
