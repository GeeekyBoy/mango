/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PostHTML from "posthtml";

/** @typedef {import("posthtml").Node} PostHTMLNode */
/** @typedef {import("posthtml").Expression} PostHTMLExpression */
/** @typedef {import("@parcel/types").AST} AST */
/** @typedef {import("@parcel/types").PluginOptions} PluginOptions */


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, "../package.json");
const packageJsonContents = fs.readFileSync(packageJsonPath, "utf8");
const packageJson = JSON.parse(packageJsonContents);
const version = packageJson.version;

RegExp.prototype.toJSON = function () {
  return "&REGEX&" + this.toString() + "&REGEX&";
};

const compilePattern = (pattern, publicUrl) => {
  const entities = [];
  let isSpread = pattern.endsWith("[*]");
  if (isSpread) {
    entities.push("*");
    pattern = pattern.slice(0, -3);
  }
  const regex = new RegExp("^" + publicUrl.replace(/\/$/, "") + pattern.replace(/\[(\w+)\]/g, (_, name) => {
    entities.push(name);
    return "([^/]+)";
  }).replace(/\/$/, "") + (isSpread ? "(/|/.*)?$" : "/?$"), "i");
  return [pattern, entities, regex];
}

const getRoutes = (dir, routesDir = dir, publicUrl) => {
  const files = fs.readdirSync(dir);
  const pagesRoutes = [];
  const apisRoutes = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const isDirectory = fs.statSync(filePath).isDirectory();
    if (isDirectory) {
      const [pages_, apis_] = getRoutes(filePath, routesDir, publicUrl);
      pagesRoutes.push(...pages_);
      apisRoutes.push(...apis_);
    } else if (/^\+pages?\.(jsx|tsx|js|ts)$/.test(file)) {
      const routePath = filePath
        .split(routesDir)[1]
        .replace(/\\/g, "/")
        .replace(/^\/(.*?)\/?\+page\..*$/, '/$1')
        .replace(/^\/(.*?)\/?\+pages\..*$/, '/$1[*]');
      pagesRoutes.push([filePath, ...compilePattern(routePath, publicUrl)]);
    } else if (/^\+(get|post|put|patch|delete)\.(js|ts)$/.test(file)) {
      const routePath = filePath
        .split(routesDir)[1]
        .replace(/\\/g, "/")
        .replace(/^\/(.*?)\/?\+(get|post|put|patch|delete)\..*$/, '/$1');
      apisRoutes.push([filePath, ...compilePattern(routePath, publicUrl)]);
    }
  }
  return [pagesRoutes, apisRoutes];
};

/**
 * @param {MutableAsset} asset
 * @param {AST} ast
 * @param {PluginOptions} options
 */
export default async function injectRoutes(asset, ast, options) {
  const cdn = options.env["npm_package_config_cdn"] || "self";
  const localRuntimePath = cdn === "self" ? fileURLToPath(await import.meta.resolve("@mango-js/runtime")) : null;
  PostHTML().walk.call(ast.program, /** @type {(node: PostHTMLNode) => PostHTMLNode} */ (node) => {
    const { tag } = node;
    if (tag === 'head') {
      let cdnUrl;
      if (cdn === "self") {
        cdnUrl = path.relative(path.dirname(asset.filePath), localRuntimePath);
      } else if (cdn === "unpkg") {
        cdnUrl = `//unpkg.com/@mango-js/runtime@${version}/dist/mango.min.js`;
      } else if (cdn === "jsdelivr") {
        cdnUrl = `//cdn.jsdelivr.net/npm/@mango-js/runtime@${version}/dist/mango.min.js`;
      } else {
        throw new Error(`Invalid CDN: ${cdn}`);
      }
      node.content.push({
        tag: 'script',
        attrs: {
          type: 'text/javascript',
          src: cdnUrl,
        }
      });
    } else if (tag === 'body') {
      const fileDir = path.dirname(asset.filePath);
      const routesDir = path.join(fileDir, "routes");
      const publicUrl = options.mode === "production" ? options.env["npm_package_config_publicUrl"] || "/" : "/";
      const [pagesRoutes, apisRoutes] = getRoutes(routesDir, routesDir, publicUrl);
      for (const route of pagesRoutes) {
        const dependencyUrl = path.relative(fileDir, route[0]) + "?page"
        asset.invalidateOnFileChange(route[0]);
        route[0] = asset.addURLDependency(dependencyUrl, {
          priority: 'parallel',
          bundleBehavior: 'isolated',
          meta: {
            pattern: route[1],
            entities: route[2],
            regex: route[3],
          },
          env: {
            sourceType: "module",
            outputFormat: "global",
            loc: {
              filePath: asset.filePath,
              start: node.location.start,
              end: node.location.end,
            },
          },
        });
      }
      for (const route of apisRoutes) {
        const dependencyUrl = "function:"
          + path.relative(fileDir, route[0])
        asset.invalidateOnFileChange(route[0]);
        asset.addURLDependency(dependencyUrl, {
          meta: {
            pattern: route[1],
            entities: route[2],
            regex: route[3],
          }
        });
      }
      const routesFiles = pagesRoutes.map(route => route[0]);
      const routesCompiledPatterns = pagesRoutes.map(route => route.slice(1)).flat();
      const stringifiedCompiledPatterns = JSON.stringify(routesCompiledPatterns)
        .replaceAll('"&REGEX&', "")
        .replaceAll('&REGEX&"', "")
        .replaceAll("\\\\", "\\");
      const routesScript = `
        window.$cp = ${stringifiedCompiledPatterns};
        (function () {
          var files = ${JSON.stringify(routesFiles)};
          for (var i = 0; i < window.$cp.length; i += 3) {
            if (window.location.pathname.match(window.$cp[i + 2])) {
              var script = document.createElement('script');
              script.type = 'text/javascript';
              script.src = files[i / 3];
              document.body.appendChild(script);
              break;
            }
          }
        })();
      `;
      node.content.push({
        tag: 'script',
        attrs: {
          type: 'text/javascript',
        },
        content: [routesScript],
      });
      return node;
    }
    return node;
  });
}
