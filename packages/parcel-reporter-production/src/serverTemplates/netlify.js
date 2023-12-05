RegExp.prototype.toJSON = function () {
  return "&REGEX&" + this.toString() + "&REGEX&";
};

const compileTemplate = (functionsIds, remoteFnsIds, routes, statusRoutes, apisPatterns, remoteFns, apisFns, pagesFns, statusPagesFns, componentsFns, htmlChunks, locales, rtlLocales, defaultLocale, staticStatusRoutes) => `
  import os from "os";
  import path from "path";
  import asyncFs from "fs/promises";
  import querystring from "querystring";
  import { fileURLToPath } from "url";
  import { brotliCompress, gzip } from "zlib";
  ${Array.from(functionsIds).map((uid) => `import fn${uid} from "../../functions/function.${uid}.js";`).join("\n")}
  ${Object.entries(remoteFnsIds).map(([uid, exports]) => `import { ${Array.from(exports).map((exp) => `${exp} as fn${uid}_${exp}`).join(", ")} } from "../../functions/function.${uid}.js";`).join("\n")}
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
  const staticStatusRoutes = [
    ${staticStatusRoutes.map(([regex, content, statusCode]) => `[
      ${
        JSON.stringify(regex)
        .replaceAll('"&REGEX&', "")
        .replaceAll('&REGEX&"', "")
        .replaceAll("\\\\", "\\")
      },
      ${JSON.stringify(content)},
      ${JSON.stringify(statusCode)}
    ]`).join(",\n")}
  ]
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
  const sendCompressedData = async (data, supportedEncodings, contentType, resHeaders, statusCode) => {
    if (supportedEncodings.includes("br")) {
      return await new Promise((resolve, reject) => {
        brotliCompress(data, (err, buffer) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              isBase64Encoded: true,
              statusCode,
              headers: {
                "Content-Type": contentType + "; charset=utf-8",
                ...resHeaders,
                "Content-Encoding": "br",
                "Vary": "Accept-Encoding",
              },
              body: buffer.toString("base64"),
            });
          }
        });
      });
    } else if (supportedEncodings.includes("gzip")) {
      return await new Promise((resolve, reject) => {
        gzip(data, (err, buffer) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              isBase64Encoded: true,
              statusCode,
              headers: {
                "Content-Type": contentType + "; charset=utf-8",
                ...resHeaders,
                "Content-Encoding": "gzip",
                "Vary": "Accept-Encoding",
              },
              body: buffer.toString("base64"),
            });
          }
        });
      });
    } else {
      return {
        isBase64Encoded: false,
        statusCode,
        headers: {
          "Content-Type": contentType + "; charset=utf-8",
          ...resHeaders,
        },
        body: data,
      }
    }
  }
  const parseBody = async (event) => {
    const contentType = event.headers["content-type"]?.split(";")[0];
    let body;
    if (contentType === "multipart/form-data") {
      body = Buffer.from(event.body, 'base64').toString('latin1');
    } else {
      body = event.body;
    }
    if (contentType === "application/json") {
      return JSON.parse(body);
    } else if (contentType === "application/x-www-form-urlencoded") {
      return querystring.parse(body);
    } else if (contentType === "multipart/form-data") {
      const boundary = event.headers["content-type"].split("boundary=")[1];
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
          finalContent = { filename, contentType, path: tempFile };
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
  const sendErrorPage = async (statusCode, url, headers, userIPs, supportedEncodings) => {
    const statusCodeClass = statusCode.toString()[0] + "xx";
    const route = getStatusRouteData(url, statusRoutes, statusCode);
    if (route?.pattern) {
      const page = statusPages[route.statusCodePattern][route.pattern];
      delete route.statusCodePattern;
      ${locales.length ? `const locale = route.params["locale"] || ${JSON.stringify(defaultLocale)};` : ""}
      try {
        const {
          data,
          headers: resHeaders = {},
          statusCode = statusCode,
        } = await page({ url, headers, route, ${locales.length ? "locale, " : ""}userIPs });
        const html = ${htmlChunks.join(" + ")};
        return await sendCompressedData(html, supportedEncodings, "text/html", resHeaders, statusCode);
      } catch (e) {
        console.error(\`✖ 🚨 Error while generating status \${statusCode} page at \${route.pattern}\\n\`);
        console.error(e, "\\n");
        return {
          statusCode: 500,
          headers: {
            "Content-Type": "text/plain",
          },
          body: "Internal Server Error",
        }
      }
    } else {
      const content = staticStatusRoutes.find((route) => route[0].test(url.pathname) && (route[2] == statusCode || route[2] == statusCodeClass))?.[1];
      if (content) {
        return sendCompressedData(content, supportedEncodings, "text/html", {}, statusCode)
      } else {
        return {
          statusCode: statusCode,
          headers: {
            "Content-Type": "text/plain",
          },
          body: errorMessages[statusCode] || errorMessages[statusCodeClass],
        }
      }
    }
  }
  export async function handler(event, context) {
    const url = new URL(event.rawUrl);
    const method = event.httpMethod;
    const headers = event.headers;
    const userIPs = (headers["client-ip"] || headers["x-forwarded-for"])?.split(", ") || [];
    const route = getRouteData(url, routes);
    const supportedEncodings = headers["accept-encoding"]?.split(", ") || [];
    if (url.pathname.indexOf("/__mango__") === 0) {
      if (url.pathname === "/__mango__/call") {
        if (!route.query["fn"] || headers["content-type"] !== "application/json") {
          return {
            statusCode: 400,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ error: "Bad Request" }),
          }
        }
        if (!remoteFns[route.query["fn"]]) {
          return {
            statusCode: 404,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ error: "Not Found" }),
          }
        }
        if (method !== "POST") {
          return {
            statusCode: 405,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ error: "Method Not Allowed" }),
          }
        }
        const body = await parseBody(event);
        try {
          const result = await remoteFns[route.query["fn"]](body);
          return {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(result),
          }
        } catch (e) {
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ error: e.message }),
          }
        }
      } else {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "text/plain",
          },
          body: "Not Found",
        }
      }
    } else if (apis[method + route.pattern]) {
      const api = apis[method + route.pattern];
      const body = await parseBody(event);
      if (body === null) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "text/plain",
          },
          body: "Bad Request",
        }
      }
      try {
        const {
          data = {},
          headers: resHeaders = {},
          statusCode = 200,
        } = await api({ url, headers, body, route, userIPs });
        if (data instanceof Buffer) {
          return {
            isBase64Encoded: true,
            statusCode,
            headers: {
              "Content-Type": "application/octet-stream",
              ...resHeaders,
            },
            body: data.toString("base64"),
          }
        } else if (data.pipe) {
          return await new Promise((resolve, reject) => {
            const chunks = [];
            data.on("data", (chunk) => chunks.push(chunk));
            data.on("end", () => {
              const buffer = Buffer.concat(chunks);
              resolve({
                isBase64Encoded: true,
                statusCode,
                headers: {
                  "Content-Type": "application/octet-stream",
                  ...resHeaders,
                },
                body: buffer.toString("base64"),
              });
            });
            data.on("error", (err) => {
              reject(err);
            });
          });
        } else if (typeof data === "object") {
          return await sendCompressedData(JSON.stringify(data), supportedEncodings, "application/json", resHeaders, statusCode);
        } else {
          return await sendCompressedData(data, supportedEncodings, "text/plain", resHeaders, statusCode);
        }
      } catch (e) {
        console.error(\`✖ 🚨 Error in \${method.toUpperCase()} \${route.pattern}\\n\`);
        console.error(e, "\\n");
        return {
          statusCode: 500,
          headers: {
            "Content-Type": "text/plain",
          },
          body: "Internal Server Error",
        }
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
          return await sendCompressedData(html, supportedEncodings, "text/html", resHeaders, statusCode);
        } else {
          return await sendErrorPage(statusCode, url, headers, userIPs, supportedEncodings);
        }
      } catch (e) {
        console.error(\`✖ 🚨 Error while generating page at \${route.pattern}\\n\`);
        console.error(e, "\\n");
        return await sendErrorPage(500, url, headers, userIPs, supportedEncodings);
      }
    } else if (apisPatterns.includes(route.pattern)) {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "text/plain",
        },
        body: "Method Not Allowed",
      }
    } else if (components[url.pathname]) {
      const component = components[url.pathname];
      ${locales.length ? `const locale = route.params["locale"] || ${JSON.stringify(defaultLocale)};` : ""}
      try {
        const {
          data = "",
          headers: resHeaders = {},
          statusCode = 200,
        } = await component({ url, headers, route, ${locales.length ? "locale, " : ""}userIPs });
        return await sendCompressedData(data, supportedEncodings, "application/javascript", resHeaders, statusCode);
      } catch (e) {
        console.error(\`✖ 🚨 Error while generating component at \${defaultLocale ? url.pathname.replace(/\.[^.]+$/, "") : url.pathname}\\n\`);
        console.error(e, "\\n");
        return await sendErrorPage(500, url, headers, userIPs, supportedEncodings);
      }
    } else {
      return await sendErrorPage(404, url, headers, userIPs, supportedEncodings);
    }
  };
`;

export default compileTemplate;
