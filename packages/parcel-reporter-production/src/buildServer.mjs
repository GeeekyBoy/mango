/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { createGzip, createBrotliCompress } from "zlib";
import compileStandaloneServer from "./serverTemplates/standalone.mjs";
import compileNetlifyServer from "./serverTemplates/netlify.mjs";

RegExp.prototype.toJSON = function () {
  return "&REGEX&" + this.toString() + "&REGEX&";
};

const regexToGlob = (regex) => regex.toString()
  .replaceAll('"&REGEX&', "")
  .replaceAll('&REGEX&"', "")
  .replaceAll("\\\\", "\\")
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
 * @param {import("@parcel/fs").FileSystem} fs
 */
const buildServer = async (bundleGraph, srcPath, outputPath, fs) => {
  const routesSrcPath = path.join(srcPath, "routes");
  const componentsOutPath = path.join(outputPath, "components");
  const apisFns = [];
  const pagesFns = [];
  const componentsFns = [];
  const routes = [];
  /** @type {[string, string][]} */
  const staticRoutes = [];
  const functionsUids = new Set();
  const htmlFile = await fs.readFile(path.join(outputPath, "index.html"), "utf8");
  const htmlChunks = htmlFile.split(/(window\.\$cp\s*=\s*\[.*?\],)function.*?(<\/script>)/s);
  const bundles = bundleGraph.getBundles().filter((bundle) => bundle.getMainEntry());
  for (const bundle of bundles) {
    const asset = bundle.getMainEntry();
    const finalPath = bundle.filePath;
    const originalDir = path.dirname(asset.filePath);
    const originalName = path.basename(asset.filePath);
    const isInRoutesDir = !path.relative(routesSrcPath, originalDir).startsWith('..');
    const isComponent = !path.relative(componentsOutPath, finalPath).startsWith('..');
    const isRoute = originalName.startsWith('+') && isInRoutesDir;
    if (isRoute) {
      const routeType = /^\+([a-z]+)\./.exec(originalName)[1];
      const routePattern = asset.query.get("pattern");
      const routeEntities = asset.query.get("entities").split(",");
      const routeRegex = new RegExp(asset.query.get("regex"), "i");
      const supportedMethods = ['get', 'post', 'put', 'delete', 'patch'];
      if (supportedMethods.includes(routeType)) {
        routes.push(routePattern, routeEntities, routeRegex);
        const functionUid = /function\.([\da-z]{8})\.js$/.exec(finalPath)[1];
        functionsUids.add(functionUid);
        apisFns.push(`
          ${JSON.stringify(routePattern)}: async (functionArgs) => await fn${functionUid}(functionArgs)
        `);
      } else if (routeType === "page" || routeType === "pages") {
        const content = await fs.readFile(finalPath, "utf8");
        if (content.search(/"(\/functions\/function\.[\da-z]{8}\.js\#.*?)"/) !== -1) {
          await fs.unlink(finalPath);
          routes.push(routePattern, routeEntities, routeRegex);
          const chunks = content.split(/"(\/functions\/function\.[\da-z]{8}\.js\#.*?)"/);
          chunks.forEach((chunk, index) => {
            if (index % 2 !== 0) {
              const [, functionUid, functionResultName] = /\/functions\/function\.([\da-z]{8})\.js\#(.*)/.exec(chunk);
              functionsUids.add(functionUid);
              chunks[index] = `JSON.stringify(fn${functionUid}_res.data[${JSON.stringify(functionResultName)}])`;
            } else {
              chunks[index] = JSON.stringify(chunk);
            }
          });
          pagesFns.push(`
            ${JSON.stringify(routePattern)}: async (functionArgs) => {
              ${Array.from(functionsUids).map((functionUid) => `const fn${functionUid}_res = await fn${functionUid}(functionArgs);`).join("\n  ")}
              return {
                data: ${chunks.join(" + ")},
                headers: {${Array.from(functionsUids).map((functionUid) => `...fn${functionUid}_res.headers`).join(", ")}},
                statusCode: ${Array.from(functionsUids).map((functionUid) => `fn${functionUid}_res.statusCode`).join(" || ")} || 200
              }
            }
          `);
        } else {
          const staticHtmlChunks = htmlChunks[0] + htmlChunks[1] + content + htmlChunks[2] + htmlChunks[3];
          const staticHtmlPath = path.join(path.dirname(finalPath), path.basename(finalPath, ".js") + ".html");
          const staticHtmlRoutePath = "/" + path.relative(outputPath, staticHtmlPath).replaceAll(path.sep, "/");
          await fs.writeFile(staticHtmlPath, staticHtmlChunks);
          await fs.unlink(finalPath);
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
          staticRoutes.push([routeRegex, staticHtmlRoutePath])
        }
      }
    } else if (isComponent) {
      const content = await fs.readFile(finalPath, "utf8");
      const finalRelPathname = "/" + path.relative(outputPath, finalPath).replaceAll(path.sep, "/");
      if (content.search(/"(\/functions\/function\.[\da-z]{8}\.js\#.*?)"/) !== -1) {
        await fs.unlink(finalPath);
        await fs.unlink(finalPath + ".gz");
        await fs.unlink(finalPath + ".br");
        routes.push(routePattern, routeEntities, routeRegex);
        const chunks = content.split(/"(\/functions\/function\.[\da-z]{8}\.js\#.*?)"/);
        chunks.forEach((chunk, index) => {
          if (index % 2 !== 0) {
            const [, functionUid, functionResultName] = /\/functions\/function\.([\da-z]{8})\.js\#(.*)/.exec(chunk);
            functionsUids.add(functionUid);
            chunks[index] = `JSON.stringify(fn${functionUid}_res.data[${JSON.stringify(functionResultName)}])`;
          } else {
            chunks[index] = JSON.stringify(chunk);
          }
        });
        componentsFns.push(`
          ${JSON.stringify(finalRelPathname)}: async (functionArgs) => {
            ${Array.from(functionsUids).map((functionUid) => `const fn${functionUid}_res = await fn${functionUid}(functionArgs);`).join("\n  ")}
            return {
              data: ${chunks.join(" + ")},
              headers: {${Array.from(functionsUids).map((functionUid) => `...fn${functionUid}_res.headers`).join(", ")}},
              statusCode: ${Array.from(functionsUids).map((functionUid) => `fn${functionUid}_res.statusCode`).join(" || ")} || 200
            }
          }
        `);
      }
    }
  }
  const dynamicHtmlChunks = htmlChunks.map((chunk) => JSON.stringify(chunk));
  dynamicHtmlChunks.splice(2, 0, "data");
  const isNetlify = !!process.env.NETLIFY;
  const serverFile = isNetlify
    ? compileNetlifyServer(functionsUids, routes, apisFns, pagesFns, componentsFns, dynamicHtmlChunks)
    : compileStandaloneServer(functionsUids, routes, apisFns, pagesFns, componentsFns, dynamicHtmlChunks, staticRoutes);
  const serverFileRelDir = isNetlify ? "./netlify/functions" : "./";
  const serverFileAbsDir = path.join(outputPath, serverFileRelDir);
  await fs.mkdirp(serverFileAbsDir);
  await fs.writeFile(path.join(serverFileAbsDir, "server.js"), serverFile);
  if (isNetlify) {
    const serverRoutes = [];
    for (let i = 2; i < routes.length; i += 3) {
      serverRoutes.push(routes[i]);
    }
    const redirectsFile = [
      ...serverRoutes.map((route) => regexToGlob(route) + " /.netlify/functions/server 200!"),
      ...staticRoutes.map(([route, staticHtmlRoutePath]) => regexToGlob(route) + " " + staticHtmlRoutePath + " 200!")
    ].join("\n");
    await fs.writeFile(path.join(outputPath, "_redirects"), redirectsFile);
    const netlifyConfigFile = '[functions]\n  directory = "dist/netlify/functions"\n  node_bundler = "esbuild"';
    await fs.writeFile(path.join(outputPath, ".." ,"netlify.toml"), netlifyConfigFile);
  }
  const packageJson = {
    "type": "module",
  }
  await fs.writeFile(path.join(outputPath, "package.json"), JSON.stringify(packageJson, null, 2));
}

export default buildServer;
