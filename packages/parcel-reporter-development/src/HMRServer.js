/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/reporter-dev-server
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import nullthrows from 'nullthrows';
import url from 'url';
import chalk from "chalk";
import mimeDB from "mime-db";
import { WebSocketServer } from 'ws';
import invariant from 'assert';
import parcelUtils from "@parcel/utils";
import extractDynamics from './util/extractDynamics.js';

const { ansiHtml, prettyDiagnostic, PromiseQueue, replaceURLReferences } = parcelUtils;

/** @typedef {import('@parcel/types').Asset} Asset */
/** @typedef {import('@parcel/types').Bundle} Bundle */
/** @typedef {import('@parcel/types').Dependency} Dependency */
/** @typedef {import('@parcel/types').NamedBundle} NamedBundle */
/** @typedef {import('@parcel/types').PackagedBundle} PackagedBundle */
/** @typedef {import('@parcel/types').BundleGraph<PackagedBundle>} PackagedBundleGraph */
/** @typedef {import('@parcel/types').BundleGraph<NamedBundle>} NamedBundleGraph */
/** @typedef {import('@parcel/types').PluginOptions} PluginOptions */
/** @typedef {import('@parcel/types').HMROptions} HMROptions */
/** @typedef {import('@parcel/types').PluginLogger} PluginLogger */

/** @typedef {import('http').IncomingMessage} HTTPIncomingMessage */
/** @typedef {import('http').ServerResponse} HTTPServerResponse */
/** @typedef {import('http').IncomingMessage} HTTPSIncomingMessage */
/** @typedef {import('http').ServerResponse} HTTPSServerResponse */

/** @typedef {HTTPIncomingMessage & {originalUrl?: string}} HTTPRequest */
/** @typedef {HTTPSIncomingMessage & {originalUrl?: string}} HTTPSRequest */

/** @typedef {HTTPRequest | HTTPSRequest} Request */
/** @typedef {HTTPServerResponse | HTTPSServerResponse} Response */

/** @typedef {import('http').Server} HTTPServer */

/** @typedef {Error & {code: string}} ServerError */

/**
 * @typedef {{
 *  id: string,
 *  url: string,
 *  type: string,
 *  output: string,
 *  envHash: string,
 *  outputFormat: string,
 *  depsByBundle: {[string]: {[string]: string}},
 * }} HMRAsset
 */

/**
 * @typedef {{
 *  type: 'update',
 *  assets: Array<HMRAsset>,
 * }
 * | {
 *  type: 'reload',
 * }} HMRUpdateMessage
 */

/**
 * @typedef {{
 *  type: 'error',
 *  diagnostics: {
 *    ansi: Array<any>,
 *    html: Array<any>,
 *  },
 * }} HMRErrorMessage
 */

/** @typedef {HMRUpdateMessage | HMRErrorMessage} HMRMessage */

/** @typedef {{ params: Record<string, string>, query: Record<string, string>, pattern: string, hash: string }} Route */

const FS_CONCURRENCY = 64;

const HMR_ENDPOINT = '/__parcel_hmr';
const SOURCES_ENDPOINT = '/__parcel_source_root';
const BROADCAST_MAX_ASSETS = 10000;

const mimeTypes = {};
Object.keys(mimeDB).forEach((key) => {
  const { extensions } = mimeDB[key];
  if (extensions) {
    extensions.forEach((ext) => {
      mimeTypes[ext] = key;
    });
  }
});

/**
 * @param {URL} url
 * @param {any[]} routes
 * @returns {Route}
 */
const getRouteData = (url, routes) => {
  const path = url.pathname;
  const params = {};
  const query = {};
  let pattern = "";
  if (url.search.length > 1) {
    const tokenizedQuery = url.search.slice(1).split("&");
    for (let i = 0; i < tokenizedQuery.length; i++) {
        const keyValue = tokenizedQuery[i].split("=");
        query[decodeURIComponent(keyValue[0])] = decodeURIComponent(keyValue[1] || "");
    }
  }
  for (let i = 0; i < routes.length; i += 3) {
    const match = routes[i + 2].exec(path);
    if (match) {
      for (let j = 1; j < match.length; j++) {
        params[routes[i + 1][j - 1]] = match[j];
      }
      pattern = routes[i];
      break;
    }
  }
  const hash = url.hash.slice(1);
  return { params, query, pattern, hash }
}

export default class HMRServer {
  /**
   * @param {HTTPServer} server
   * @param {string} defaultLocale
   * @param {(
   *   content: string,
   *   reqTranslations: { [key: string]: [string, { [key: string]: [number, number] }, [number, number][], number] },
   *   reqFunctions: { [key: string]: [string, string, number] },
   *   reqRemoteFunctions: { [key: string]: [string, string, number] },
   *   functionArgs: any,
   *   start: number,
   *   end: number,
   * ) => Promise<string>} preprocessContent
   */
  constructor(defaultLocale, server, preprocessContent) {
    this.defaultLocale = defaultLocale;
    this.preprocessContent = preprocessContent;
    /** @type {HMRMessage | null} */
    this.unresolvedError = null;
    /** @type {PackagedBundleGraph | NamedBundleGraph | null} */
    this.bundleGraph = null;
    /** @type {number} */
    this.port = server.address().port;
    this.routes = [];

    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      if (this.unresolvedError) {
        ws.send(JSON.stringify(this.unresolvedError));
      }

      const wsUrl = new URL(req.url, `http://${req.headers.host}`);
      const clientUrl = new URL(wsUrl.searchParams.get('url'), `http://${req.headers.host}`);
      const headers = req.headers;
      const userIPs = (req.socket.remoteAddress || req.headers['x-forwarded-for'])?.split(", ") || [];
      const route = getRouteData(clientUrl, this.routes);
      const locale = route.params["locale"] || defaultLocale;
      ws.ssrArgs = { url: clientUrl.toString(), headers, route, locale, userIPs };

      ws.on('message', (rawMsg) => {
        const msg = JSON.parse(rawMsg.toString());
        if (msg.type === 'route_change') {
          const clientUrl = new URL(msg.payload.url, `http://${req.headers.host}`);
          const headers = req.headers;
          const userIPs = (req.socket.remoteAddress || req.headers['x-forwarded-for'])?.split(", ") || [];
          const route = getRouteData(clientUrl, this.routes);
          const locale = route.params["locale"] || defaultLocale;
          ws.ssrArgs = { url: clientUrl.toString(), headers, route, locale, userIPs };
        }
      });
    });

    this.wss.on('error', err => this.handleSocketError(err));
  }

  /**
   * @param {Request} req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  async handleHmrEndpoint(req, res) {
    const { pathname } = url.parse(req.originalUrl || req.url);
    const id = pathname.slice(HMR_ENDPOINT.length + 1);
    try {
      const bundleGraph = nullthrows(this.bundleGraph);
      let asset;
      try {
        asset = bundleGraph.getAssetById(id);
      } catch {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }), "utf-8");
        return;
      }
      const mimeType = mimeTypes[asset.type] || "application/octet-stream";
      const output = await this.getHotAssetContents(asset);
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Content-Length": Buffer.byteLength(output),
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "max-age=0, must-revalidate",
      });
      res.end(output);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }), "utf-8");
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async stop() {
    this.wss.close();
    for (const ws of this.wss.clients) {
      ws.terminate();
    }
  }

  /**
   * @param {PluginOptions} options
   * @param {Array<any>} diagnostics
   * @returns {Promise<void>}
   */
  async emitError(options, diagnostics) {
    const renderedDiagnostics = await Promise.all(
      diagnostics.map(d => prettyDiagnostic(d, options)),
    );

    // store the most recent error so we can notify new connections
    // and so we can broadcast when the error is resolved
    this.unresolvedError = {
      type: 'error',
      diagnostics: {
        ansi: renderedDiagnostics,
        html: renderedDiagnostics.map((d, i) => {
          return {
            message: ansiHtml(d.message),
            stack: ansiHtml(d.stack),
            frames: d.frames.map(f => ({
              location: f.location,
              code: ansiHtml(f.code),
            })),
            hints: d.hints.map(hint => ansiHtml(hint)),
            documentation: diagnostics[i].documentationURL ?? '',
          };
        }),
      },
    };

    this.broadcast(this.unresolvedError);
  }

  /**
   * @param {PackagedBundleGraph | NamedBundleGraph} bundleGraph
   * @param {Map<string, Asset>} changedAssets
   * @param {any[]} routes
   * @returns {Promise<void>}
   */
  async emitUpdate(bundleGraph, changedAssets, routes) {
    this.unresolvedError = null;
    this.bundleGraph = bundleGraph;
    this.routes = routes;

    for (const ws of this.wss.clients) {
      const ssrArgs = ws.ssrArgs;
      const url = new URL(ssrArgs.url);
      const route = getRouteData(url, this.routes);
      const locale = route.params["locale"] || this.defaultLocale;
      ssrArgs.route = route;
      ssrArgs.locale = locale;
    }

    const changedAssetsSet = new Set(changedAssets.values());
    if (changedAssetsSet.size === 0) return;

    const queue = new PromiseQueue({ maxConcurrent: FS_CONCURRENCY });
    const jsAssetsToSend = [];

    for (const asset of changedAssetsSet) {
      if (
        asset.pipeline === "function" ||
        asset.pipeline === "function-util" ||
        asset.query.has("functionAsset")
      ) {
        const finalPath = bundleGraph.getBundlesWithAsset(asset)[0].name;
        bundleGraph.traverse((node) => {
          if (node.type === "dependency" && node.value.meta["resolved"] === finalPath) {
            const dep = node.value;
            const dependent = bundleGraph.getAssetWithDependency(dep);
            changedAssetsSet.add(dependent);
          }
        });

        continue;
      }

      if (asset.type !== 'js' && asset.type !== 'css') {
        // If all of the incoming dependencies of the asset actually resolve to a JS asset
        // rather than the original, we can mark the runtimes as changed instead. URL runtimes
        // have a cache busting query param added with HMR enabled which will trigger a reload.
        const runtimes = new Set();
        const incomingDeps = bundleGraph.getIncomingDependencies(asset);
        const isOnlyReferencedByRuntimes = incomingDeps.every(dep => {
          const resolved = bundleGraph.getResolvedAsset(dep);
          const isRuntime = resolved?.type === 'js' && resolved !== asset;
          if (resolved && isRuntime) {
            runtimes.add(resolved);
          }
          return isRuntime;
        });

        if (isOnlyReferencedByRuntimes) {
          for (const runtime of runtimes) {
            changedAssetsSet.add(runtime);
          }

          continue;
        }
      }

      if (asset.type === 'js') {
        jsAssetsToSend.push(asset);
      } else {
        queue.add(async () => {
          const dependencies = bundleGraph.getDependencies(asset);
          const depsByBundle = {};
          for (const bundle of bundleGraph.getBundlesWithAsset(asset)) {
            const deps = {};
            for (const dep of dependencies) {
              const resolved = bundleGraph.getResolvedAsset(dep, bundle);
              if (resolved) {
                deps[getSpecifier(dep)] = bundleGraph.getAssetPublicId(resolved);
              }
            }
            depsByBundle[bundle.id] = deps;
          }

          try {
            return {
              id: bundleGraph.getAssetPublicId(asset),
              url: this.getSourceURL(asset),
              type: asset.type,
              output: '',
              envHash: asset.env.id,
              outputFormat: asset.env.outputFormat,
              depsByBundle,
            };
          } catch {}
        });
      }
    }

    const nonJsAssetsUpdates = await queue.run();

    for (const ws of this.wss.clients) {
      const ssrArgs = ws.ssrArgs;
      for (const asset of jsAssetsToSend) {
        queue.add(async () => {
          const dependencies = bundleGraph.getDependencies(asset);
          const depsByBundle = {};
          for (const bundle of bundleGraph.getBundlesWithAsset(asset)) {
            const deps = {};
            for (const dep of dependencies) {
              const resolved = bundleGraph.getResolvedAsset(dep, bundle);
              if (resolved) {
                deps[getSpecifier(dep)] = bundleGraph.getAssetPublicId(resolved);
              }
            }
            depsByBundle[bundle.id] = deps;
          }

          try {
            return {
              id: bundleGraph.getAssetPublicId(asset),
              url: this.getSourceURL(asset),
              type: asset.type,
              output: await this.getHotAssetContents(asset, ssrArgs),
              envHash: asset.env.id,
              outputFormat: asset.env.outputFormat,
              depsByBundle,
            };
          } catch {}
        });
      }
      const jsAssetsUpdates = await queue.run();
      let msg;
      if (nonJsAssetsUpdates.length + jsAssetsUpdates.length >= BROADCAST_MAX_ASSETS) {
        // Too many assets to send via an update without errors, just reload instead
        msg = { type: 'reload' };
      } else {
        msg = {
          type: 'update',
          assets: [...nonJsAssetsUpdates, ...jsAssetsUpdates],
        };
      }
      ws.send(JSON.stringify(msg));
    }
  }

  /**
   * @param {Asset} asset
   * @param {Object} ssrArgs
   * @returns {Promise<string>}
   */
  async getHotAssetContents(asset, ssrArgs = {}) {
    let contents = await asset.getCode();
    let map = await asset.getMap();
    const bundleGraph = nullthrows(this.bundleGraph);
    if (asset.type === 'js') {
      const publicId = bundleGraph.getAssetPublicId(asset);
      for (const bundle of bundleGraph.getBundlesWithAsset(asset)) {
        ({ contents, map } = replaceURLReferences({
          bundle,
          bundleGraph,
          contents,
          map,
          relative: false,
          getReplacement: s => JSON.stringify(s).slice(1, -1),
        }));
      }
      const [reqTranslations, reqFunctions, reqRemoteFunctions] = await extractDynamics(contents);
      const result = await this.preprocessContent(contents, reqTranslations, reqFunctions, reqRemoteFunctions, ssrArgs);
      contents = `parcelHotUpdate['${publicId}'] = function (require, module, exports) {${result.data}}`;
    }

    if (map) {
      const sourcemapStringified = await map.stringify({
        format: 'inline',
        sourceRoot: SOURCES_ENDPOINT + '/',
        fs: asset.fs,
      });

      invariant(typeof sourcemapStringified === 'string');
      contents += `\n//# sourceMappingURL=${sourcemapStringified}`;
      contents += `\n//# sourceURL=${encodeURI(this.getSourceURL(asset))}\n`;
    }

    return contents;
  }

  /**
   * @param {Asset} asset
   * @returns {string}
   */
  getSourceURL(asset) {
    const origin = `http://localhost:${this.port}`;
    return origin + HMR_ENDPOINT + '/' + asset.id;
  }

  /**
   * @param {ServerError} err
   */
  handleSocketError(err) {
    if (err.code === 'ECONNRESET') {
      // This gets triggered on page refresh, ignore this
      return;
    }

    console.error(chalk.red.bold(`✖ 🚨 Error occurred in HMR websocket\n`));
    console.error(chalk.red.bold(`[${err.code}]: ${err.message}`));
    console.error(chalk.red.bold(err.stack), "\n");
  }

  /**
   * @param {HMRMessage} msg
   */
  broadcast(msg) {
    const json = JSON.stringify(msg);
    for (const ws of this.wss.clients) {
      ws.send(json);
    }
  }
}

/**
 * @param {Dependency} dep
 * @returns {string}
 */
function getSpecifier(dep) {
  if (typeof dep.meta.placeholder === 'string') {
    return dep.meta.placeholder;
  }

  return dep.specifier;
}
