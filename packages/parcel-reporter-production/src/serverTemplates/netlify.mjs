RegExp.prototype.toJSON = function () {
  return "&REGEX&" + this.toString() + "&REGEX&";
};

const compileTemplate = (functionsUids, remoteFnsUids, routes, apisPatterns, remoteFns, apisFns, pagesFns, componentsFns, htmlChunks) => `
  import os from "os";
  import path from "path";
  import asyncFs from "fs/promises";
  import querystring from "querystring";
  import { fileURLToPath } from "url";
  import { brotliCompress, gzip } from "zlib";
  ${Array.from(functionsUids).map((uid) => `import fn${uid} from "../../functions/function.${uid}.js";`).join("\n")}
  ${Object.entries(remoteFnsUids).map(([uid, exports]) => `import { ${Array.from(exports).map((exp) => `${exp} as fn${uid}_${exp}`).join(", ")} } from "../../functions/function.${uid}.js";`).join("\n")}
  const routes = ${
    JSON.stringify(routes)
      .replaceAll('"&REGEX&', "")
      .replaceAll('&REGEX&"', "")
      .replaceAll("\\\\", "\\")
  };
  const apisPatterns = ${
    JSON.stringify(apisPatterns)
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
  const components = {
    ${componentsFns.join(",\n")}
  }
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
  export async function handler(event, context) {
    const url = new URL(event.rawUrl);
    const method = event.httpMethod;
    const headers = event.headers;
    const userIPs = (headers["client-ip"] || headers["x-forwarded-for"])?.split(", ") || [];
    const route = getRouteData(url, routes);
    const supportedEncodings = headers["accept-encoding"]?.split(", ") || [];
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
        return await sendCompressedData(res, data, supportedEncodings, "text/plain", resHeaders, statusCode);
      }
    } else if (pages[route.pattern]) {
      const page = pages[route.pattern];
      const {
        data,
        headers: resHeaders = {},
        statusCode = 200,
      } = await page({ url, headers, route, userIPs });
      const html = ${htmlChunks.join(" + ")};
      return await sendCompressedData(html, supportedEncodings, "text/html", resHeaders, statusCode);
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
      const {
        data,
        headers: resHeaders = {},
        statusCode = 200,
      } = await component({ url, headers, route, userIPs });
      return await sendCompressedData(data, supportedEncodings, "application/javascript", resHeaders, statusCode);
    }
  };
`;

export default compileTemplate;
