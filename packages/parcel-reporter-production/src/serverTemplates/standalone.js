import mimeDB from "mime-db";

RegExp.prototype.toJSON = function () {
  return "&REGEX&" + this.toString() + "&REGEX&";
};

const mimeTypes = {};
Object.keys(mimeDB).forEach((key) => {
  const { extensions } = mimeDB[key];
  if (extensions) {
    extensions.forEach((ext) => {
      mimeTypes[ext] = key;
    });
  }
});

const compileTemplate = (functionsIds, remoteFnsIds, routes, statusRoutes, apisPatterns, remoteFns, apisFns, pagesFns, statusPagesFns, componentsFns, htmlChunks, locales, rtlLocales, defaultLocale, staticRoutes, staticStatusRoutes, port) => `
  import os from "os";
  import path from "path";
  import fs from "fs";
  import asyncFs from "fs/promises";
  import querystring from "querystring";
  import { createServer } from "http";
  import { fileURLToPath } from "url";
  import { createBrotliCompress, createGzip } from "zlib";
  ${Array.from(functionsIds).map((uid) => `import fn${uid} from "./__mango__/functions/function.${uid}.js";`).join("\n")}
  ${Object.entries(remoteFnsIds).map(([uid, exports]) => `import { ${Array.from(exports).map((exp) => `${exp} as fn${uid}_${exp}`).join(", ")} } from "./__mango__/functions/function.${uid}.js";`).join("\n")}
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const contentTypes = ${JSON.stringify(mimeTypes)};
  const compressibleMimeTypes = [
    "text/html",
    "text/css",
    "text/plain",
    "text/xml",
    "text/x-component",
    "text/javascript",
    "application/x-javascript",
    "application/javascript",
    "application/json",
    "application/manifest+json",
    "application/vnd.api+json",
    "application/xml",
    "application/xhtml+xml",
    "application/rss+xml",
    "application/atom+xml",
    "application/vnd.ms-fontobject",
    "application/x-font-ttf",
    "application/x-font-opentype",
    "application/x-font-truetype",
    "image/svg+xml",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "font/ttf",
    "font/eot",
    "font/otf",
    "font/opentype",
  ];
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
  const routes = ${
    JSON.stringify(routes)
      .replaceAll('"&REGEX&', "")
      .replaceAll('&REGEX&"', "")
      .replaceAll("\\\\", "\\")
  };
  const statusRoutes = ${
    JSON.stringify(statusRoutes)
      .replaceAll('"&REGEX&', "")
      .replaceAll('&REGEX&"', "")
      .replaceAll("\\\\", "\\")
  };
  const apisPatterns = ${
    JSON.stringify(apisPatterns)
  };
  const staticRoutes = ${
    JSON.stringify(staticRoutes)
      .replaceAll('"&REGEX&', "")
      .replaceAll('&REGEX&"', "")
      .replaceAll("\\\\", "\\")
  };
  const staticStatusRoutes = ${
    JSON.stringify(staticStatusRoutes)
      .replaceAll('"&REGEX&', "")
      .replaceAll('&REGEX&"', "")
      .replaceAll("\\\\", "\\")
  };
  const remoteFns = {
    ${remoteFns.join(",\n")}
  }
  const apis = {
    ${apisFns.join(",\n")}
  }
  const pages = {
    ${pagesFns.join(",\n")}
  }
  const statusPages = {
    ${Object.entries(statusPagesFns).map(([statusCode, pagesFns]) => `"${statusCode}": {
      ${pagesFns.join(",\n")}
    }`).join(",\n")}
  }
  const components = {
    ${componentsFns.join(",\n")}
  }
  ${locales.length ? `const localesToIndex = {
    ${locales.map((locale, index) => `${JSON.stringify(locale)}: ${index}`).join(",\n")}
  }` : ""}
  ${rtlLocales.length ? `const rtlLocalesFinder = {
    ${rtlLocales.map((locale) => `${JSON.stringify(locale)}: true`).join(",\n")}
  }` : ""}
  const existsAsync = (path) => {
    return new Promise((resolve) => {
      resolve(fs.existsSync(path));
    })
  }
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
  const sendCompressedData = (res, data, supportedEncodings, contentType, resHeaders, statusCode) => {
    if (supportedEncodings.includes("br")) {
      res.writeHead(statusCode, {
        "Content-Type": contentType + "; charset=utf-8",
        ...resHeaders,
        "Content-Encoding": "br",
        "Vary": "Accept-Encoding",
      })
      const brotli = createBrotliCompress();
      brotli.on("data", (chunk) => res.write(chunk));
      brotli.on("end", () => res.end());
      brotli.write(data);
      brotli.end();
    } else if (supportedEncodings.includes("gzip")) {
      res.writeHead(statusCode, {
        "Content-Type": contentType + "; charset=utf-8",
        ...resHeaders,
        "Content-Encoding": "gzip",
        "Vary": "Accept-Encoding",
      })
      const gzip = createGzip();
      gzip.on("data", (chunk) => res.write(chunk));
      gzip.on("end", () => res.end());
      gzip.write(data);
      gzip.end();
    } else {
      res.writeHead(statusCode, {
        "Content-Type": contentType + "; charset=utf-8",
        ...resHeaders,
      })
      res.end(data);
    }
  }
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
      const parts = body.split(${"`--${boundary}`"});
      const result = {};
      for (var i = 1; i < parts.length - 1; i++) {
        const part = parts[i];
        const headers = Buffer.from(part.split("\\r\\n\\r\\n")[0], 'latin1').toString('utf8');
        const content = part.split("\\r\\n\\r\\n")[1];
        const name = headers.split("name=\\"")[1].split("\\"")[0];
        const filename = headers.split("filename=\\"")[1]?.split("\\"")[0];
        let finalContent;
        if (filename) {
          const contentType = headers.split("Content-Type: ")[1]?.split("\\r\\n")[0];
          const tempDir = await asyncFs.mkdtemp(path.join(os.tmpdir(), 'upload-'));
          const tempFile = path.join(tempDir, filename);
          await asyncFs.writeFile(tempFile, content, 'binary');
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
  const sendErrorPage = async (statusCode, url, headers, userIPs, supportedEncodings, res) => {
    const statusCodeClass = statusCode.toString()[0] + "xx";
    const route = getStatusRouteData(url, statusRoutes, statusCode);
    if (route?.pattern) {
      const page = statusPages[route.statusCodePattern][route.pattern];
      delete route.statusCodePattern;
      ${locales.length ? `const locale = route.params["locale"] || ${JSON.stringify(defaultLocale)};` : ""}
      try {
        const {
          data = "",
          headers: resHeaders = {},
          statusCode = statusCode,
        } = await page({ url, headers, route, ${locales.length ? "locale, " : ""}userIPs });
        const html = ${htmlChunks.join(" + ")};
        sendCompressedData(res, html, supportedEncodings, "text/html", resHeaders, statusCode);
      } catch (e) {
        console.error(\`✖ 🚨 Error while generating status \${statusCode} page at \${route.pattern}\\n\`);
        console.error(e, "\\n");
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error", "utf-8");
      }
    } else {
      const fileName = staticStatusRoutes.find((route) => route[0].test(url.pathname) && (route[2] == statusCode || route[2] == statusCodeClass))?.[1];
      if (fileName) {
        const filePath = path.join(__dirname, fileName);
        const fileSize = (await asyncFs.stat(filePath)).size;
        if (supportedEncodings.includes("br")) {
          const brotliFilePath = filePath + ".br";
          let brotliFileSize = (await asyncFs.stat(brotliFilePath)).size;
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Encoding": "br",
            "Content-Length": brotliFileSize,
            "Vary": "Accept-Encoding",
          });
          fs.createReadStream(brotliFilePath).pipe(res);
          return;
        }
        if (supportedEncodings.includes("gzip")) {
          const gzipFilePath = filePath + ".gz";
          let gzipFileSize = (await asyncFs.stat(gzipFilePath)).size;
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Encoding": "gzip",
            "Content-Length": gzipFileSize,
            "Vary": "Accept-Encoding",
          });
          fs.createReadStream(gzipFilePath).pipe(res);
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": fileSize,
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(statusCode, { "Content-Type": "text/plain" });
        res.end(errorMessages[statusCode] || errorMessages[statusCodeClass], "utf-8");
      }
    }
  }
  createServer(async (req, res) => {
    const url = new URL(req.url, ${"`http://${req.headers.host}`"});
    const method = req.method;
    const headers = req.headers;
    const userIPs = (req.socket.remoteAddress || req.headers['x-forwarded-for'])?.split(", ") || [];
    const route = getRouteData(url, routes);
    const supportedEncodings = headers["accept-encoding"]?.split(", ") || [];
    if (url.pathname.indexOf("/__mango__") === 0) {
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
        await sendErrorPage(404, url, headers, userIPs, supportedEncodings, res);
      }
    } else if (apis[method + route.pattern]) {
      const api = apis[method + route.pattern];
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
        } = await api({ url, headers, body, route, userIPs });
        if (data instanceof Buffer) {
          res.writeHead(statusCode, { "Content-Type": "application/octet-stream", ...resHeaders });
          res.end(data, "binary");
        } else if (data.pipe) {
          res.writeHead(statusCode, { "Content-Type": "application/octet-stream", ...resHeaders });
          data.pipe(res);
        } else if (typeof data === "object") {
          sendCompressedData(res, JSON.stringify(data), supportedEncodings, "application/json", resHeaders, statusCode);
        } else {
          sendCompressedData(res, data, supportedEncodings, "text/plain", resHeaders, statusCode);
        }
      } catch (e) {
        console.error(\`✖ 🚨 Error in \${method.toUpperCase()} \${route.pattern}\\n\`);
        console.error(e, "\\n");
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error", "utf-8");
      }
    } else if (pages[route.pattern]) {
      const page = pages[route.pattern];
      ${locales.length ? `const locale = route.params["locale"] || ${JSON.stringify(defaultLocale)};` : ""}
      try {
        const {
          data = "",
          headers: resHeaders = {},
          statusCode = 200,
        } = await page({ url, headers, route, ${locales.length ? "locale, " : ""}userIPs });
        if (statusCode < 400) {
          const html = ${htmlChunks.join(" + ")};
          sendCompressedData(res, html, supportedEncodings, "text/html", resHeaders, statusCode);
        } else {
          await sendErrorPage(statusCode, url, headers, userIPs, supportedEncodings, res);
        }
      } catch (e) {
        console.error(\`✖ 🚨 Error while generating page at \${route.pattern}\\n\`);
        console.error(e, "\\n");
        await sendErrorPage(500, url, headers, userIPs, supportedEncodings, res);
      }
    } else if (apisPatterns.includes(route.pattern)) {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed", "utf-8");
    } else if (components[url.pathname]) {
      const component = components[url.pathname];
      ${locales.length ? `const locale = route.params["locale"] || ${JSON.stringify(defaultLocale)};` : ""}
      try {
        const {
          data,
          headers: resHeaders = {},
          statusCode = 200,
        } = await component({ url, headers, route, ${locales.length ? "locale, " : ""}userIPs });
        if (statusCode < 400) {
          sendCompressedData(res, data, supportedEncodings, "application/javascript", resHeaders, statusCode);
        } else {
          res.writeHead(statusCode, { "Content-Type": "text/plain" });
          res.end(errorMessages[statusCode] || errorMessages[statusCode.toString()[0] + "xx"], "utf-8");
        }
      } catch (e) {
        console.error(\`✖ 🚨 Error while generating component at \${defaultLocale ? url.pathname.replace(/\.[^.]+$/, "") : url.pathname}\\n\`);
        console.error(e, "\\n");
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error", "utf-8");
      }
    } else if (staticRoutes.some((route) => route[0].test(url.pathname)) && (!path.extname(url.pathname) || (path.extname(url.pathname) && !(await existsAsync(path.join(__dirname, url.pathname)))))) {
      const filePath = path.join(__dirname, staticRoutes.find((route) => route[0].test(url.pathname))[1]);
      const fileSize = (await asyncFs.stat(filePath)).size;
      if (supportedEncodings.includes("br")) {
        const brotliFilePath = filePath + ".br";
        let brotliFileSize = (await asyncFs.stat(brotliFilePath)).size;
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Encoding": "br",
          "Content-Length": brotliFileSize,
          "Vary": "Accept-Encoding",
        });
        fs.createReadStream(brotliFilePath).pipe(res);
        return;
      }
      if (supportedEncodings.includes("gzip")) {
        const gzipFilePath = filePath + ".gz";
        let gzipFileSize = (await asyncFs.stat(gzipFilePath)).size;
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Encoding": "gzip",
          "Content-Length": gzipFileSize,
          "Vary": "Accept-Encoding",
        });
        fs.createReadStream(gzipFilePath).pipe(res);
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": fileSize,
      });
      fs.createReadStream(filePath).pipe(res);
    } else if (!path.extname(url.pathname)) {
      await sendErrorPage(404, url, headers, userIPs, supportedEncodings, res);
    } else {
      const filePath = path.join(__dirname, path.extname(url.pathname) ? url.pathname : "index.html");
      const extname = path.extname(filePath).slice(1).toLowerCase();
      const contentType = contentTypes[extname] || "application/octet-stream";
      let fileSize = 0;
      try { fileSize = (await asyncFs.stat(filePath)).size; } catch {
        await sendErrorPage(404, url, headers, userIPs, supportedEncodings, res);
        return;
      }
      if (supportedEncodings.includes("br")) {
        const brotliFilePath = filePath + ".br";
        let brotliFileSize = 0;
        try { brotliFileSize = (await asyncFs.stat(brotliFilePath)).size; } catch {}
        if (brotliFileSize > 0 && brotliFileSize < fileSize) {
          res.writeHead(200, {
            "Content-Type": contentType,
            "Content-Encoding": "br",
            "Content-Length": brotliFileSize,
          });
          fs.createReadStream(brotliFilePath).pipe(res);
          return;
        }
      }
      if (supportedEncodings.includes("gzip")) {
        const gzipFilePath = filePath + ".gz";
        let gzipFileSize = 0;
        try { gzipFileSize = (await asyncFs.stat(gzipFilePath)).size; } catch {}
        if (gzipFileSize > 0 && gzipFileSize < fileSize) {
          res.writeHead(200, {
            "Content-Type": contentType,
            "Content-Encoding": "gzip",
            "Content-Length": gzipFileSize,
          });
          fs.createReadStream(gzipFilePath).pipe(res);
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
          res.writeHead(416, { "Content-Range": ${'`bytes */${fileSize}`'} });
          res.end();
        } else {
          const chunksize = (end - start) + 1;
          res.writeHead(206, {
              "Content-Range": ${'`bytes ${start}-${end}/${fileSize}`'},
              "Accept-Ranges": "bytes",
              "Content-Length": chunksize,
              "Content-Type": contentType,
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
        }
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": contentType,
        });
        fs.createReadStream(filePath).pipe(res);
      }
    }
  }).listen(${port}, () => {
    console.log("Server running at http://localhost:${port}/");
  });
`;

export default compileTemplate;
