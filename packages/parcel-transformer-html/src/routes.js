/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import PostHTML from "posthtml";

/** @typedef {import("posthtml").Node} PostHTMLNode */
/** @typedef {import("posthtml").Expression} PostHTMLExpression */
/** @typedef {import("@parcel/types").AST} AST */
/** @typedef {import("@parcel/types").MutableAsset} MutableAsset */
/** @typedef {import("@parcel/types").PluginOptions} PluginOptions */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, "../package.json");
const packageJsonContents = await fs.readFile(packageJsonPath, "utf8");
const packageJson = JSON.parse(packageJsonContents);
const version = packageJson.version;

RegExp.prototype.toJSON = function () {
  return "&REGEX&" + this.toString() + "&REGEX&";
};

const compilePattern = (pattern, publicUrl, locales) => {
  const entities = [];
  const isLocalized = !!locales?.length;
  const isSpread = pattern.endsWith("[*]");
  if (isSpread) {
    pattern = pattern.slice(0, -3);
  }
  if (isLocalized) {
    entities.push("locale");
  }
  const regex = new RegExp(
    "^" +
      publicUrl.replace(/\/$/, "") +
      (isLocalized ? `(?:/(${locales.join("|")}))?` : "") +
      pattern.replace(/\[(\w+)\]/g, (_, name) => (entities.push(name), "([^/]+)")).replace(/\/$/, "") +
      (isSpread ? "(/|/.*)?$" : "/?$"),
    "i"
  );
  if (isSpread) {
    entities.push("*");
  }
  return [pattern, entities, regex];
}

const getRoutes = async (dir, routesPath, publicUrl, locales) => {
  const files = await fs.readdir(dir);
  const pagesRoutes = [];
  const apisRoutes = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const isDirectory = (await fs.stat(filePath)).isDirectory();
    if (isDirectory) {
      const [pages_, apis_] = await getRoutes(filePath, routesPath, publicUrl, locales);
      pagesRoutes.push(...pages_);
      apisRoutes.push(...apis_);
    } else if (/^\+pages?\.(jsx|tsx|js|ts)$/.test(file)) {
      const routePath = filePath
        .split(routesPath)[1]
        .replace(/\\/g, "/")
        .replace(/^\/(.*?)\/?\+page\..*$/, '/$1')
        .replace(/^\/(.*?)\/?\+pages\..*$/, '/$1[*]');
      pagesRoutes.push([filePath, ...compilePattern(routePath, publicUrl, locales)]);
    } else if (/^\+(get|post|put|patch|delete)\.(js|ts)$/.test(file)) {
      const routePath = filePath
        .split(routesPath)[1]
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
  const {
    SRC_PATH: srcPath,
    PUBLIC_URL: publicUrl = "/",
    LOCALES: stringifiedLocales,
    RTL_LOCALES: stringifiedRtlLocales,
    DEFAULT_LOCALE: defaultLocale,
    CDN: cdn,
  } = options.env;
  const localRuntimePath = cdn === "self" ? fileURLToPath(await import.meta.resolve("@mango-js/runtime")) : null;
  const routesPath = path.join(srcPath, "routes");
  const localesPath = path.join(srcPath, "locales");
  const locales = stringifiedLocales.split(",").filter(Boolean);
  const rtlLocales = stringifiedRtlLocales.split(",").filter(Boolean);
  for (const locale of locales) {
    const filePath = path.join(localesPath, `${locale}.json`);
    asset.invalidateOnFileChange(filePath);
  }
  const [pagesRoutes, apisRoutes] = await getRoutes(routesPath, routesPath, publicUrl, locales);
  let hasExplicitRoot = false;
  PostHTML().walk.call(ast.program, /** @type {(node: PostHTMLNode) => PostHTMLNode} */ (node) => {
    if (node.attrs?.id === "root") {
      hasExplicitRoot = true;
    }
    return node;
  });
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
      for (const route of pagesRoutes) {
        const dependencyUrl = path.relative(srcPath, route[0]) + "?page" + (hasExplicitRoot ? "&hasExplicitRoot" : "");
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
        const dependencyUrl = "function:" + path.relative(srcPath, route[0]);
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
            var matchedPage = window.location.pathname.match(window.$cp[i + 2]);
            if (matchedPage) {${rtlLocales.length ? `var locale = window.$l = matchedPage[1] || ${JSON.stringify(defaultLocale)};
              if (${rtlLocales.map((locale) => `${JSON.stringify(locale)} === locale`).join(" || ")}) {
                document.documentElement.style.direction = "rtl";
              }` : ""}
              var script = document.createElement('script');
              script.type = 'text/javascript';
              script.src = ${JSON.stringify(`${publicUrl}pages/page.`)} + files[i / 3]${locales.length ? ` + "." + ${rtlLocales.length ? "locale" : `(window.$l = matchedPage[1] || ${JSON.stringify(defaultLocale)})`}` : ""} + ".js";
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
    }
    return node;
  });
}
