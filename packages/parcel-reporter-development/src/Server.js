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
import { EventEmitter } from "events";
import { Worker } from "worker_threads";
import querystring from "querystring";
import chalk from "chalk";
import mimeDB from "mime-db";
import icuParser from "@formatjs/icu-messageformat-parser";
import extractDynamics from "./util/extractDynamics.js";
import parseTranslations from "./util/parseTranslations.js";

/** @typedef {{ params: Record<string, string>, query: Record<string, string>, pattern: string, hash: string }} Route */
/** @typedef {Route & { statusCodePattern?: string }} StatusRoute */

const mimeTypes = {};
Object.keys(mimeDB).forEach((key) => {
  const { extensions } = mimeDB[key];
  if (extensions) {
    extensions.forEach((ext) => {
      mimeTypes[ext] = key;
    });
  }
});

const errorMessages = {
  "4xx": "Client Error",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Time-out",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Request Entity Too Large",
  "414": "Request-URI Too Long",
  "415": "Unsupported Media Type",
  "416": "Requested Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a teapot",
  "421": "Unprocessable Entity",
  "422": "Misdirected Request",
  "423": "Locked",
  "424": "Failed Dependency",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "451": "Unavailable For Legal Reasons",
  "5xx": "Server Error",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "508": "Loop Detected",
  "509": "Bandwidth Limit Exceeded",
  "510": "Not Extended",
  "511": "Network Authentication Required"
};

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

/**
 * @param {URL} url
 * @param {any[]} routes
 * @returns {StatusRoute}
 */
const getStatusRouteData = (url, routes, statusCode) => {
  const path = url.pathname;
  const params = {};
  const query = {};
  let pattern = "";
  let statusCodePattern = ""
  if (url.search.length > 1) {
    const tokenizedQuery = url.search.slice(1).split("&");
    for (let i = 0; i < tokenizedQuery.length; i++) {
        const keyValue = tokenizedQuery[i].split("=");
        query[decodeURIComponent(keyValue[0])] = decodeURIComponent(keyValue[1] || "");
    }
  }
  for (let i = 0; i < routes.length; i += 4) {
    const routeStatusCode = routes[i + 3];
    if (routeStatusCode == statusCode || routeStatusCode == statusCode.toString()[0] + "xx") {
      const match = routes[i + 2].exec(path);
      if (match) {
        for (let j = 1; j < match.length; j++) {
          params[routes[i + 1][j - 1]] = match[j];
        }
        pattern = routes[i];
        statusCodePattern = routeStatusCode;
        break;
      }
    }
  }
  const hash = url.hash.slice(1);
  return { params, query, pattern, hash, statusCodePattern }
}

/**
 * @param {string} dir
 * @param {import("@parcel/fs").FileSystem} fs
 * @returns {Promise<string[]>}
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

/**
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<any>}
 */
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

/**
 * @param {number} statusCode
 * @param {URL} url
 * @param {import("http").IncomingHttpHeaders} headers
 * @param {string[]} userIPs
 * @param {string[]} rtlLocales
 * @param {string} defaultLocale
 * @param {Record<string, Record<string, any>>} pages
 * @param {any[]} statusRoutes
 * @param {string} outputPath
 * @param {import("http").ServerResponse} res
 * @param {import("@parcel/fs").FileSystem} fs
 */
const sendErrorPage = async (
  statusCode,
  url,
  headers,
  userIPs,
  rtlLocales,
  defaultLocale,
  pages,
  statusRoutes,
  outputPath,
  res,
  fs
) => {
  const statusCodeClass = statusCode.toString()[0] + "xx";
  const route = getStatusRouteData(url, statusRoutes, statusCode);
  if (route?.pattern) {
    const page = pages[route.statusCodePattern][route.pattern];
    delete route.statusCodePattern;
    const locale = route.params["locale"] || defaultLocale;
    try {
      const {
        data,
        headers: resHeaders = {},
        statusCode = 200,
      } = await page({ url: url.toString(), headers, route, locale, userIPs });
      const localeDeclarator = locale ? `window.$l=${JSON.stringify(locale)};` : "";
      const rtlSetter = rtlLocales.includes(locale) ? `document.documentElement.style.direction="rtl";` : "";
      const html = (await fs.readFile(path.join(outputPath, "index.html"), "utf8"))
        .replace(/(window\.\$cp\s*=\s*\[.*?\];).*?<\/script>/s, (_, p1) => `${p1}${localeDeclarator}${rtlSetter}${data}</script>`);
      res.writeHead(statusCode, { "Content-Type": "text/html", ...resHeaders });
      res.end(html, "utf-8");
    } catch (e) {
      console.error(chalk.red.bold(`✖ 🚨 Error while generating status ${statusCode} page at ${route.pattern}\n`));
      console.error(chalk.red.bold(e), "\n");
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error", "utf-8");
    }
  } else {
    res.writeHead(statusCode, { "Content-Type": "text/plain" });
    res.end(errorMessages[statusCode] || errorMessages[statusCodeClass], "utf-8");
  }
}

export default class Server {
  /**
   * @param {number} port
   * @param {string} srcPath
   * @param {string} outputPath
   * @param {string} publicPath
   * @param {string[]} locales
   * @param {string[]} rtlLocales
   * @param {string} defaultLocale
   * @param {import("@parcel/fs").FileSystem} fs
   * @param {import("ora").Ora} spinner
   */
  constructor(port, srcPath, outputPath, publicPath, locales, rtlLocales, defaultLocale, fs, spinner) {
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
    this.localesPath = path.join(srcPath, "locales");
    this.fs = fs;
    this.paused = true;
    this.locales = locales;
    this.rtlLocales = rtlLocales;
    this.defaultLocale = defaultLocale;
    this.allTranslations = {};
    this.remoteFns = {};
    this.apis = {};
    this.pages = {};
    this.statusPages = {};
    this.components = {};
    this.routes = [];
    this.statusRoutes = [];
    this.queuedResumes = [];
    this.resumeNextId = 0;
    this.queuedRequests = [];
    this.em = new EventEmitter();
    /**
     * @type {import("http").RequestListener} req
     * @type {import("http").ServerResponse} res
     */
    this.handleReq = async (req, res) => {
      if (this.paused) {
        this.queuedRequests.push({ req, res });
        return;
      }
      // START: Claim references to all shared variables
      const rtlLocales = this.rtlLocales;
      const defaultLocale = this.defaultLocale;
      const remoteFns = this.remoteFns;
      const apis = this.apis;
      const pages = this.pages;
      const statusPages = this.statusPages;
      const components = this.components;
      const routes = this.routes;
      const statusRoutes = this.statusRoutes;
      // END: Claim references to all shared variables
      const url = new URL(req.url, `http://${req.headers.host}`);
      const method = req.method;
      const headers = req.headers;
      const userIPs = (req.socket.remoteAddress || req.headers['x-forwarded-for'])?.split(", ") || [];
      const route = getRouteData(url, routes);
      if (url.pathname.indexOf("/__mango__") === 0 && url.pathname.indexOf("/__mango__/functions/") !== 0) {
        if (url.pathname === "/__mango__/call") {
          if (!route.query["fn"] || headers["content-type"] !== "application/json") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Bad Request" }), "utf-8");
            return;
          }
          if (!remoteFns[route.query["fn"]]) {
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
            const result = await remoteFns[route.query["fn"]](body);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result), "utf-8");
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }), "utf-8");
          }
        } else {
          await sendErrorPage(404, url, headers, userIPs, rtlLocales, defaultLocale, statusPages, statusRoutes, outputPath, res, this.fs);
        }
      } else if (apis[route.pattern] && apis[route.pattern][method]) {
        const api = apis[route.pattern];
        const body = await parseBody(req);
        if (body === null) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Bad Request", "utf-8");
          return;
        }
        try {
          const {
            data = {},
            headers: resHeaders = {},
            statusCode = 200,
          } = await api[method]({ url: url.toString(), headers, body, route, userIPs });
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
        } catch (e) {
          console.error(chalk.red.bold(`✖ 🚨 Error in ${method.toUpperCase()} ${route.pattern}\n`));
          console.error(chalk.red.bold(e), "\n");
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error", "utf-8");
        }
      } else if (pages[route.pattern]) {
        const page = pages[route.pattern];
        const locale = route.params["locale"] || defaultLocale;
        try {
          const {
            data,
            headers: resHeaders = {},
            statusCode = 200,
          } = await page({ url: url.toString(), headers, route, locale, userIPs });
          if (statusCode < 400) {
            const localeDeclarator = locale ? `window.$l=${JSON.stringify(locale)};` : "";
            const rtlSetter = rtlLocales.includes(locale) ? `document.documentElement.style.direction="rtl";` : "";
            const html = (await fs.readFile(path.join(outputPath, "index.html"), "utf8"))
              .replace(/(window\.\$cp\s*=\s*\[.*?\];).*?<\/script>/s, (_, p1) => `${p1}${localeDeclarator}${rtlSetter}${data}</script>`);
            res.writeHead(statusCode, { "Content-Type": "text/html", ...resHeaders });
            res.end(html, "utf-8");
          } else {
            await sendErrorPage(statusCode, url, headers, userIPs, rtlLocales, defaultLocale, statusPages, statusRoutes, outputPath, res, this.fs);
          }
        } catch (e) {
          console.error(chalk.red.bold(`✖ 🚨 Error while generating page at ${route.pattern}\n`));
          console.error(chalk.red.bold(e), "\n");
          await sendErrorPage(500, url, headers, userIPs, rtlLocales, defaultLocale, statusPages, statusRoutes, outputPath, res, this.fs);
        }
      } else if (apis[route.pattern]) {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method Not Allowed", "utf-8");
      } else if (components[defaultLocale ? url.pathname.replace(/\.(?!map)[^.]+$/, "") : url.pathname]) {
        const component = components[defaultLocale ? url.pathname.replace(/\.[^.]+$/, "") : url.pathname];
        const locale = defaultLocale ? url.pathname.split(".").pop() : null;
        try {
          const {
            data,
            headers: resHeaders = {},
            statusCode = 200,
          } = await component({ url: url.toString(), headers, route, locale, userIPs });
          if (statusCode < 400) {
            res.writeHead(statusCode, { "Content-Type": "application/javascript", ...resHeaders });
            res.end(data, "utf-8");
          } else {
            res.writeHead(statusCode, { "Content-Type": "text/plain" });
            res.end(errorMessages[statusCode] || errorMessages[statusCode.toString()[0] + "xx"], "utf-8");
          }
        } catch (e) {
          console.error(chalk.red.bold(`✖ 🚨 Error while generating component at ${defaultLocale ? url.pathname.replace(/\.[^.]+$/, "") : url.pathname}\n`));
          console.error(chalk.red.bold(e), "\n");
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error", "utf-8");
        }
      } else if (!route.pattern && !path.extname(url.pathname)) {
        await sendErrorPage(404, url, headers, userIPs, rtlLocales, defaultLocale, statusPages, statusRoutes, outputPath, res, this.fs);
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
            await sendErrorPage(404, url, headers, userIPs, rtlLocales, defaultLocale, statusPages, statusRoutes, outputPath, res, this.fs);
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
  /**
   * @param {string} content
   * @param {{ [key: string]: [string, { [key: string]: [number, number] }, [number, number][], number] }} reqTranslations
   * @param {{ [key: string]: [string, string, number] }} reqFunctions
   * @param {{ [key: string]: [string, string, number] }} reqRemoteFunctions
   * @param {any} functionArgs
   * @param {number} start
   * @param {number} end
   * @returns {Promise<string>}
   */
  async preprocessContent (
    content,
    reqTranslations,
    reqFunctions,
    reqRemoteFunctions,
    functionArgs,
    start = 0,
    end = content.length
  ) {
    const cachedData = {};
    const headers = {};
    let statusCode = 200;
    let data = "";
    for (let i = start; i < end; i++) {
      if (i in reqTranslations) {
        const [translationId, params, children, end] = reqTranslations[i];
        const locale = functionArgs.locale;
        const translations = this.allTranslations[locale];
        const translationAST = translations[translationId];
        if (translationAST) {
          const preprocessedPrams = {};
          const compiledTranslation = [];
          let childIndexCaptured = false;
          for (const param in params) {
            const [paramStart, paramEnd] = params[param];
            const result = await this.preprocessContent(content, reqTranslations, reqFunctions, reqRemoteFunctions, functionArgs, paramStart, paramEnd);
            preprocessedPrams[param] = result.data;
            Object.assign(headers, result.headers);
            statusCode = result.statusCode || statusCode;
          }
          for (const node of translationAST) {
            if (node.type === icuParser.TYPE.literal) {
              compiledTranslation.push(JSON.stringify(node.value));
            } else if (node.type === icuParser.TYPE.argument) {
              const varName = node.value;
              if (isNaN(varName)) {
                compiledTranslation.push(`(${preprocessedPrams[node.value]})`);
              } else {
                if (!childIndexCaptured) {
                  data += "[";
                }
                if (compiledTranslation.length) {
                  data += compiledTranslation.join("+") + ",";
                  compiledTranslation.length = 0;
                }
                if (varName in children) {
                  const [childStart, childEnd] = children[varName];
                  const result = await this.preprocessContent(content, reqTranslations, reqFunctions, reqRemoteFunctions, functionArgs, childStart, childEnd);
                  data += result.data;
                  Object.assign(headers, result.headers);
                  statusCode = result.statusCode || statusCode;
                } else {
                  data += "undefined";
                }
                if (node !== translationAST[translationAST.length - 1]) {
                  data += ",";
                }
                childIndexCaptured = true;
              }
            }
          }
          if (compiledTranslation.length) {
            data += compiledTranslation.join("+");
          }
          if (childIndexCaptured) {
            data += "]";
          }
        } else {
          data += JSON.stringify(translationId);
        }
        i = end - 1;
      } else if (i in reqFunctions) {
        const [functionId, functionResultName, end] = reqFunctions[i];
        const functionFile = `/__mango__/functions/function.${functionId}.js`;
        const functionPath = new URL(functionFile, `http://localhost:${this.port}`).href;
        const exportName = "default";
        if (!cachedData[functionFile]) {
          const result = (await this.invokeFunction(functionPath, exportName, [functionArgs])) || {};
          cachedData[functionFile] = result.data || {};
          Object.assign(headers, result.headers);
          statusCode = result.statusCode || statusCode;
        }
        data += JSON.stringify(cachedData[functionFile][functionResultName]);
        i = end - 1;
      } else if (i in reqRemoteFunctions) {
        const [functionId, functionName, end] = reqRemoteFunctions[i];
        data += JSON.stringify(`/__mango__/call?fn=${functionId + functionName}`);
        i = end - 1;
      } else {
        data += content[i];
      }
    }
    return { data, headers, statusCode };
  };
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
    const resumeId = this.resumeNextId < Number.MAX_SAFE_INTEGER ? ++this.resumeNextId : 0;
    this.queuedResumes.push(resumeId);
    if (this.queuedResumes.length > 1) {
      await new Promise((resolve) => {
        this.em.once(`resume-${resumeId}`, resolve);
      });
    }
    if (shouldRefreshFunctions) {
      this.worker.postMessage("exit");
      const refreshFunctions = (code) => {
        if (code !== 1) {
          this.worker = new Worker(new URL("./worker.js", import.meta.url)).on("exit", refreshFunctions);
        }
      }
      this.worker = new Worker(new URL("./worker.js", import.meta.url)).on("exit", refreshFunctions);
    }
    this.allTranslations = {};
    this.apis = {};
    this.remoteFns = {};
    this.pages = {};
    this.statusPages = {};
    this.components = {};
    this.routes = [];
    this.statusRoutes = [];
    process.env = envVars;
    for (const locale of this.locales) {
      const filePath = path.join(this.localesPath, `${locale}.json`);
      const fileContent = await asyncSysFs.readFile(filePath, "utf-8");
      try {
        this.allTranslations[locale] = parseTranslations(JSON.parse(fileContent));
      } catch (e) {
        console.error(chalk.red.bold(`✖ 🚨 Error parsing ${filePath}`));
        console.error(chalk.red.bold(e.message));
        this.queuedResumes.shift();
        if (this.queuedResumes.length) {
          this.em.emit(`resume-${this.queuedResumes.shift()}`);
        }
        return;
      }
    }
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
        const statusCode = routeData.statusCode;
        const routePattern = routeData.pattern;
        const routeEntities = routeData.entities;
        const routeRegex = routeData.regex;
        const routePriority = routeData.priority;
        const routeType = statusCode ? "status" : /^\+([a-z]+)\./.exec(originalName)[1];
        if (routeType === "status") {
          this.statusRoutes.push([routePattern, routeEntities, routeRegex, statusCode, routePriority]);
        } else {
          this.routes.push([routePattern, routeEntities, routeRegex, routePriority]);
        }
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
        } else if (routeType === "page" || routeType === "pages" || routeType === "status") {
          const content = await this.fs.readFile(finalPath, "utf8");
          const [reqTranslations, reqFunctions, reqRemoteFunctions] = await extractDynamics(content);
          for (const remoteFunctionStart in reqRemoteFunctions) {
            const [functionId, functionName] = reqRemoteFunctions[remoteFunctionStart];
            const functionFile = `/__mango__/functions/function.${functionId}.js`;
            this.remoteFns[functionId + functionName] = async (functionArgs) => {
              const functionPath = new URL(functionFile, `http://localhost:${this.port}`).href;
              const exportName = functionName;
              return (await this.invokeFunction(functionPath, exportName, functionArgs)) || {};
            }
          }
          if (Object.keys(reqTranslations).length || Object.keys(reqFunctions).length || Object.keys(reqRemoteFunctions).length) {
            if (routeType === "status") {
              if (!this.statusPages[statusCode]) {
                this.statusPages[statusCode] = {};
              }
              this.statusPages[statusCode][routePattern] = async (functionArgs) => (
                await this.preprocessContent(content, reqTranslations, reqFunctions, reqRemoteFunctions, functionArgs)
              );
            } else {
              this.pages[routePattern] = async (functionArgs) => (
                await this.preprocessContent(content, reqTranslations, reqFunctions, reqRemoteFunctions, functionArgs)
              );
            }
          } else if (routeType === "status") {
            if (!this.statusPages[statusCode]) {
              this.statusPages[statusCode] = {};
            }
            this.statusPages[statusCode][routePattern] = async () => ({ data: content, headers: {}, statusCode: 200 });
          }
        }
      } else if (isComponent) {
        const content = await this.fs.readFile(finalPath, "utf8");
        const finalRelPathname = "/" + path.relative(this.outputPath, finalPath).replaceAll(path.sep, "/");
        const [reqTranslations, reqFunctions, reqRemoteFunctions] = await extractDynamics(content);
        if (Object.keys(reqTranslations).length || Object.keys(reqFunctions).length || Object.keys(reqRemoteFunctions).length) {
          for (const remoteFunctionStart in reqRemoteFunctions) {
            const [functionId, functionName] = reqRemoteFunctions[remoteFunctionStart];
            const functionFile = `/__mango__/functions/function.${functionId}.js`;
            this.remoteFns[functionId + functionName] = async (functionArgs) => {
              const functionPath = new URL(functionFile, `http://localhost:${this.port}`).href;
              const exportName = functionName;
              return (await this.invokeFunction(functionPath, exportName, functionArgs)) || {};
            }
          }
          this.components[finalRelPathname] = async (functionArgs) => (
            await this.preprocessContent(content, reqTranslations, reqFunctions, reqRemoteFunctions, functionArgs)
          );
        }
      }
    }
    this.statusRoutes.sort((a, b) => a[4] - b[4]);
    this.statusRoutes = this.statusRoutes.flatMap(([routePattern, routeEntities, routeRegex, statusCode]) => [routePattern, routeEntities, routeRegex, statusCode]);
    this.routes.sort((a, b) => a[3] - b[3]);
    this.routes = this.routes.flatMap(([routePattern, routeEntities, routeRegex]) => [routePattern, routeEntities, routeRegex]);
    this.queuedResumes.shift();
    if (this.queuedResumes.length) {
      this.em.emit(`resume-${this.queuedResumes.shift()}`);
    } else {
      this.paused = false;
      while (this.queuedRequests.length) {
        const { req, res } = this.queuedRequests.shift();
        this.handleReq(req, res);
      }
    }
  }
}
