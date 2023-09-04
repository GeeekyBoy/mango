/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import os from "os";
import path from "path";
import sysFs from "fs";
import asyncSysFs from "fs/promises";
import http from "http";
import { Worker } from "worker_threads";
import querystring from "querystring";
import chalk from "chalk";
import mimeDB from "mime-db";

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
 */
const getRouteData = (url, routes) => {
  var path = url.pathname;
  var params = {};
  var query = {};
  var pattern = "";
  if (url.search.length > 1) {
    var tokenizedQuery = url.search.slice(1).split("&");
    for (var i = 0; i < tokenizedQuery.length; i++) {
        const keyValue = tokenizedQuery[i].split("=");
        query[decodeURIComponent(keyValue[0])] = decodeURIComponent(keyValue[1] || "");
    }
  }
  for (var i = 0; i < routes.length; i += 3) {
    var match = routes[i + 2].exec(path);
    if (match) {
      for (var j = 1; j < match.length; j++) {
        params[routes[i + 1][j - 1]] = match[j];
      }
      pattern = routes[i];
      break;
    }
  }
  const hash = url.hash.slice(1);
  return { params, query, pattern, hash }
}

/**
 * @param {string} dir
 * @param {import("@parcel/fs").FileSystem} fs
 */
 const recursiveReadDir = async (dir, fs) => {
  const files = await fs.readdir(dir);
  const result = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      result.push(...(await recursiveReadDir(filePath, fs)));
    } else {
      result.push(filePath);
    }
  }
  return result;
};

const parseBody = async (req) => {
  const contentType = req.headers["content-type"]?.split(";")[0];
  if (contentType === "multipart/form-data") {
    req.setEncoding('latin1');
  } else {
    req.setEncoding('utf8');
  }
  const body = await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(data);
    });
  });
  if (contentType === "application/json") {
    return JSON.parse(body);
  } else if (contentType === "application/x-www-form-urlencoded") {
    return querystring.parse(body);
  } else if (contentType === "multipart/form-data") {
    const boundary = req.headers["content-type"].split("boundary=")[1];
    const parts = body.split(`--${boundary}`);
    const result = {};
    for (var i = 1; i < parts.length - 1; i++) {
      const part = parts[i];
      const headers = Buffer.from(part.split("\r\n\r\n")[0], 'latin1').toString('utf8');
      const content = part.split("\r\n\r\n")[1];
      const name = headers.split("name=\"")[1].split("\"")[0];
      const filename = headers.split("filename=\"")[1]?.split("\"")[0];
      let finalContent;
      if (filename) {
        const contentType = headers.split("Content-Type: ")[1]?.split("\r\n")[0];
        const tempDir = await asyncSysFs.mkdtemp(path.join(os.tmpdir(), 'upload-'));
        const tempFile = path.join(tempDir, filename);
        await asyncSysFs.writeFile(tempFile, content, 'binary');
        finalContent = { filename, type: contentType, path: tempFile };
      } else {
        finalContent = Buffer.from(content, 'latin1').toString('utf8');
      }
      if (result[name] === undefined) {
        result[name] = finalContent;
      } else if (Array.isArray(result[name])) {
        result[name].push(finalContent);
      } else {
        result[name] = [result[name], finalContent];
      }
    }
    return result;
  } else if (contentType === "text/plain" || !contentType) {
    return body;
  } else {
    return null;
  }
};

export default class Server {
  /**
   * @param {number} port
   * @param {string} srcPath
   * @param {string} outputPath
   * @param {string} publicPath
   * @param {import("@parcel/fs").FileSystem} fs
   * @param {import("ora").Ora} spinner
   */
  constructor(port, srcPath, outputPath, publicPath, fs, spinner) {
    spinner.start(chalk.yellow.bold("⌛ Starting Mango dev server..."));
    const refreshFunctions = (code) => {
      if (code !== 1) {
        this.worker = new Worker(new URL("./worker.js", import.meta.url)).on("exit", refreshFunctions);
      }
    }
    this.worker = new Worker(new URL("./worker.js", import.meta.url)).on("exit", refreshFunctions);
    this.workerReqId = 0;
    this.port = port;
    this.outputPath = outputPath;
    this.publicPath = publicPath;
    this.routesSrcPath = path.join(srcPath, "routes");
    this.componentsOutPath = path.join(outputPath, "components");
    this.fs = fs;
    this.paused = true;
    this.remoteFns = {};
    this.apis = {};
    this.pages = {};
    this.components = {};
    this.routes = [];
    this.queuedRequests = [];
    /**
     * @type {import("http").RequestListener} req
     * @type {import("http").ServerResponse} res
     */
    this.handleReq = async (req, res) => {
      if (this.paused) {
        this.queuedRequests.push({ req, res });
        return;
      }
      const url = new URL(req.url, `http://${req.headers.host}`);
      const method = req.method;
      const headers = req.headers;
      const userIPs = (req.socket.remoteAddress || req.headers['x-forwarded-for'])?.split(", ") || [];
      const route = getRouteData(url, this.routes);
      if (url.pathname.indexOf("/__mango__") === 0 && url.pathname.indexOf("/__mango__/functions/") !== 0) {
        if (url.pathname === "/__mango__/call") {
          if (!route.query["fn"] || headers["content-type"] !== "application/json") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Bad Request" }), "utf-8");
            return;
          }
          if (!this.remoteFns[route.query["fn"]]) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Not Found" }), "utf-8");
            return;
          }
          if (method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method Not Allowed" }), "utf-8");
            return;
          }
          const body = await parseBody(req);
          try {
            const result = await this.remoteFns[route.query["fn"]](body);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result), "utf-8");
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }), "utf-8");
          }
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found", "utf-8");
        }
      } else if (this.apis[route.pattern] && this.apis[route.pattern][method]) {
        const api = this.apis[route.pattern];
        const body = await parseBody(req);
        if (body === null) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Bad Request", "utf-8");
          return;
        }
        const {
          data = {},
          headers: resHeaders = {},
          statusCode = 200,
        } = await api[method]({ url, headers, body, route, userIPs });
        res.writeHead(statusCode, { "Content-Type": "application/json", ...resHeaders });
        if (data instanceof Buffer) {
          res.end(data, "binary");
        } else if (data.pipe) {
          data.pipe(res);
        } else if (typeof data === "object") {
          res.end(JSON.stringify(data));
        } else {
          res.end(data);
        }
      } else if (this.pages[route.pattern]) {
        const page = this.pages[route.pattern];
        const {
          data,
          headers: resHeaders = {},
          statusCode = 200,
        } = await page({ url, headers, route, userIPs });
        const html = (await fs.readFile(path.join(outputPath, "index.html"), "utf8"))
          .replace(/(window\.\$cp\s*=\s*\[.*?\];).*?<\/script>/s, `$1${data}</script>`);
        res.writeHead(statusCode, { "Content-Type": "text/html", ...resHeaders });
        res.end(html, "utf-8");
      } else if (this.apis[route.pattern]) {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method Not Allowed", "utf-8");
      } else if (this.components[url.pathname]) {
        const component = this.components[url.pathname];
        const {
          data,
          headers: resHeaders = {},
          statusCode = 200,
        } = await component({ url, headers, route, userIPs });
        res.writeHead(statusCode, { "Content-Type": "application/javascript", ...resHeaders });
        res.end(data, "utf-8");
      } else {
        let fs = this.fs;
        let asyncFs = this.fs;
        let filePath = path.join(outputPath, path.extname(url.pathname) ? url.pathname : "index.html");
        const extname = path.extname(filePath).slice(1).toLowerCase();
        const contentType = mimeTypes[extname] || "application/octet-stream";
        let fileSize = 0;
        try { fileSize = (await asyncFs.stat(filePath)).size; } catch {
          fs = sysFs;
          asyncFs = asyncSysFs;
          filePath = path.join(publicPath, url.pathname);
          try { fileSize = (await asyncFs.stat(filePath)).size; } catch {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 Not Found", "utf-8");
            return;
          }
        }
        if (req.headers.range) {
          const range = req.headers.range;
          const parts = range.replace(/bytes=/, "").split("-");
          const partialstart = parts[0];
          const partialend = parts[1];
          const start = parseInt(partialstart, 10);
          const end = partialend ? parseInt(partialend, 10) : fileSize - 1;
          if (start >= fileSize || end >= fileSize) {
            res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
            res.end();
          } else {
            const chunksize = (end - start) + 1;
            const buffer = await asyncFs.readFile(filePath);
            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunksize,
                "Content-Type": contentType,
            });
            res.end(buffer.subarray(start, end + 1), "binary");
          }
        } else {
          res.writeHead(200, {
            "Content-Length": fileSize,
            "Content-Type": contentType,
          });
          fs.createReadStream(filePath).pipe(res);
        }
      }
    };
    this.server = http.createServer(this.handleReq);
    this.server.listen(this.port, () => {
      if (spinner.isSpinning) {
        spinner.succeed(chalk.green.bold(`🚀 Server running at http://localhost:${this.port}\n`));
      }
    });
  }
  /**
   * @param {string} functionPath
   * @param {string} exportName
   * @param {any[]} params
   * @returns {Promise<any>}
   */
  invokeFunction (functionPath, exportName, params) {
    return new Promise((resolve, reject) => {
      const reqId = this.workerReqId >= Number.MAX_SAFE_INTEGER ? 0 : ++this.workerReqId;
      let handleResult, handleError;
      const handleExit = () => {
        resolve({});
      }
      handleResult = ([status, id, result]) => {
        if (id === reqId) {
          this.worker.off('message', handleResult);
          this.worker.off('error', handleError);
          this.worker.off('exit', handleExit);
          if (status === 0) {
            resolve(result);
          } else {
            reject(result);
          }
        }
      }
      handleError = (err) => {
        this.worker.off('message', handleResult);
        this.worker.off('error', handleError);
        this.worker.off('exit', handleExit);
        reject(err);
      }
      this.worker.on('message', handleResult);
      this.worker.on('error', handleError);
      this.worker.on('exit', handleExit);
      this.worker.postMessage([functionPath, exportName, params, reqId]);
    })
  }
  pause() {
    this.paused = true;
  }
  close() {
    this.worker.terminate();
    this.server.close();
  }
  /**
   * @param {import("@parcel/types").BundleGraph} bundleGraph
   * @param {NodeJS.ProcessEnv} envVars
   * @param {boolean} shouldRefreshFunctions
   */
  async resume(bundleGraph, envVars, shouldRefreshFunctions) {
    if (shouldRefreshFunctions) {
      this.worker.postMessage("exit");
      const refreshFunctions = (code) => {
        if (code !== 1) {
          this.worker = new Worker(new URL("./worker.js", import.meta.url)).on("exit", refreshFunctions);
        }
      }
      this.worker = new Worker(new URL("./worker.js", import.meta.url)).on("exit", refreshFunctions);
    }
    this.apis = {};
    this.remoteFns = {};
    this.pages = {};
    this.components = {};
    this.routes = [];
    process.env = envVars;
    const bundles = bundleGraph.getBundles().filter((bundle) => bundle.getMainEntry());
    for (const bundle of bundles) {
      const asset = bundle.getMainEntry();
      const finalPath = bundle.filePath;
      const originalDir = path.dirname(asset.filePath);
      const originalName = path.basename(asset.filePath);
      const isInRoutesDir = !path.relative(this.routesSrcPath, originalDir).startsWith('..');
      const isComponent = !path.relative(this.componentsOutPath, finalPath).startsWith('..');
      const isRoute = originalName.startsWith('+') && isInRoutesDir;
      if (isRoute) {
        const routeData = bundleGraph.getIncomingDependencies(asset)[0].meta;
        const routeType = /^\+([a-z]+)\./.exec(originalName)[1];
        const routePattern = routeData.pattern;
        const routeEntities = routeData.entities;
        const routeRegex = routeData.regex;
        this.routes.push(routePattern, routeEntities, routeRegex);
        const supportedMethods = ['get', 'post', 'put', 'delete', 'patch'];
        if (supportedMethods.includes(routeType)) {
          if (!this.apis[routePattern]) {
            this.apis[routePattern] = {};
          }
          this.apis[routePattern][routeType.toUpperCase()] = async (functionArgs) => {
            const functionPath = new URL("__mango__" + finalPath.split('__mango__')[1], `http://localhost:${this.port}`).href;
            const exportName = "default";
            return (await this.invokeFunction(functionPath, exportName, [functionArgs])) || {};
          }
        } else if (routeType === "page" || routeType === "pages") {
          let content = await this.fs.readFile(finalPath, "utf8");
          content = content.replace(/"(\/__mango__\/functions\/function\.([\da-z]{8})\.js)\@(.*?)"/g, (_, functionFile, functionId, functionName) => {
            this.remoteFns[functionId + functionName] = async (functionArgs) => {
              const functionPath = new URL(functionFile, `http://localhost:${this.port}`).href;
              const exportName = functionName;
              return (await this.invokeFunction(functionPath, exportName, functionArgs)) || {};
            }
            return `"/__mango__/call?fn=${functionId + functionName}"`;
          });
          if (content.search(/"(\/__mango__\/functions\/function\.[\da-z]{8}\.js\#.*?)"/) !== -1) {
            this.pages[routePattern] = async (functionArgs) => {
              const cachedData = {};
              const resHeaders = {};
              let statusCode = 200;
              const chunks = content.split(/"(\/__mango__\/functions\/function\.[\da-z]{8}\.js\#.*?)"/);
              for (const [index, chunk] of chunks.entries()) {
                if (index % 2 !== 0) {
                  const [, functionFile, functionResultName] = /(\/__mango__\/functions\/function\.[\da-z]{8}\.js)\#(.*)/.exec(chunk);
                  const functionPath = new URL(functionFile, `http://localhost:${this.port}`).href;
                  const exportName = "default";
                  if (!cachedData[functionFile]) {
                    const result = (await this.invokeFunction(functionPath, exportName, [functionArgs])) || {};
                    cachedData[functionFile] = result.data || {};
                    Object.assign(resHeaders, result.headers);
                    statusCode = result.statusCode || statusCode;
                  }
                  chunks[index] = JSON.stringify(cachedData[functionFile][functionResultName]);
                }
              }
              return {
                data: chunks.join(""),
                headers: resHeaders,
                statusCode,
              };
            }
          }
        }
      } else if (isComponent) {
        let content = await this.fs.readFile(finalPath, "utf8");
        content = content.replace(/"(\/__mango__\/functions\/function\.([\da-z]{8})\.js)\@(.*?)"/g, (_, functionFile, functionId, functionName) => {
          this.remoteFns[functionId + functionName] = async (functionArgs) => {
            const functionPath = new URL(functionFile, `http://localhost:${this.port}`).href;
            const exportName = functionName;
            return (await this.invokeFunction(functionPath, exportName, functionArgs)) || {};
          }
          return `"/__mango__/call?fn=${functionId + functionName}"`;
        });
        const finalRelPathname = "/" + path.relative(this.outputPath, finalPath).replaceAll(path.sep, "/");
        if (content.search(/"(\/__mango__\/functions\/function\.[\da-z]{8}\.js\#.*?)"/) !== -1) {
          this.components[finalRelPathname] = async (functionArgs) => {
            const cachedData = {};
            const resHeaders = {};
            let statusCode = 200;
            const chunks = content.split(/"(\/__mango__\/functions\/function\.[\da-z]{8}\.js\#.*?)"/);
            for (const [index, chunk] of chunks.entries()) {
              if (index % 2 !== 0) {
                const [, functionFile, functionResultName] = /(\/__mango__\/functions\/function\.[\da-z]{8}\.js)\#(.*)/.exec(chunk);
                const functionPath = new URL(functionFile, `http://localhost:${this.port}`).href;
                const exportName = "default";
                if (!cachedData[functionFile]) {
                  const result = (await this.invokeFunction(functionPath, exportName, [functionArgs])) || {};
                  cachedData[functionFile] = result.data || {};
                  Object.assign(resHeaders, result.headers);
                  statusCode = result.statusCode || statusCode;
                }
                chunks[index] = JSON.stringify(cachedData[functionFile][functionResultName]);
              }
            }
            return {
              data: chunks.join(""),
              headers: resHeaders,
              statusCode,
            };
          }
        }
      }
    }
    this.paused = false;
    while (this.queuedRequests.length) {
      const { req, res } = this.queuedRequests.shift();
      this.handleReq(req, res);
    }
  }
}
