/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "fs";
import asyncFs from "fs/promises";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

// Parcel WASM node bindings downloader
{
  const wasmUrl =
    "https://repl.parceljs.org/parcel_node_bindings.ee671620.wasm";
  const wasmPath = path.join(
    path.dirname(fileURLToPath(await import.meta.resolve("@parcel/rust"))),
    "parcel_node_bindings.wasm",
  );

  if (!fs.existsSync(wasmPath)) {
    await new Promise((resolve) =>
      https.get(wasmUrl, (res) => {
        const writeStream = fs.createWriteStream(wasmPath);
        res.pipe(writeStream);
        writeStream.on("finish", () => {
          writeStream.close();
          resolve();
        });
      }),
    );
  }
}

// @parcel/rust package.json patcher
{
  const packageJsonPath = path.join(
    path.dirname(fileURLToPath(await import.meta.resolve("@parcel/rust"))),
    "package.json",
  );
  const packageJsonContents = await asyncFs.readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonContents);
  if (packageJson.main !== "browser.js") {
    packageJson.main = "browser.js";
    await asyncFs.writeFile(packageJsonPath, JSON.stringify(packageJson));
  }
}

// @parcel/rust package.json patcher
{
  const packageJsonPath = path.join(
    path.dirname(fileURLToPath(await import.meta.resolve("@parcel/source-map"))),
    "..", "package.json",
  );
  const packageJsonContents = await asyncFs.readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonContents);
  if (packageJson.main !== "./dist/wasm.js") {
    packageJson.main = "./dist/wasm.js";
    await asyncFs.writeFile(packageJsonPath, JSON.stringify(packageJson));
  }
}

// @parcel/package-manager index.js patcher
{
  const indexJsPath = fileURLToPath(await import.meta.resolve("@parcel/package-manager"));
  const indexJsContents = await asyncFs.readFile(indexJsPath, "utf8");
  if (indexJsContents.indexOf("process.versions.hasOwnProperty(\"webcontainer\")") === -1) {
    const newIndexJsContents = indexJsContents.replace("this.fs instanceof", "!process.versions.hasOwnProperty(\"webcontainer\") && this.fs instanceof");
    await asyncFs.writeFile(indexJsPath, newIndexJsContents);
  }
}

// @parcel/core resolveOptions.js patcher
{
  const resolveOptionsJsPath = path.join(
    path.dirname(fileURLToPath(await import.meta.resolve("@parcel/core"))),
    "resolveOptions.js",
  );
  const resolveOptionsJsContents = await asyncFs.readFile(resolveOptionsJsPath, "utf8");
  if (resolveOptionsJsContents.indexOf("!process.versions.hasOwnProperty(\"webcontainer\")") === -1) {
    const newResolveOptionsJsContents = resolveOptionsJsContents.replace("outputFS instanceof _fs().NodeFS &&", "outputFS instanceof _fs().NodeFS && !process.versions.hasOwnProperty(\"webcontainer\")");
    await asyncFs.writeFile(resolveOptionsJsPath, newResolveOptionsJsContents);
  }
}

// @parcel/fs index.js patcher
{
  const indexJsPath = fileURLToPath(await import.meta.resolve("@parcel/fs"));
  const indexJsContents = await asyncFs.readFile(indexJsPath, "utf8");
  if (indexJsContents.indexOf("@parcel/watcher-wasm") === -1) {
    const newIndexJsContents = indexJsContents
      .replace("process.versions.pnp != null", 'true')
      .replace("@parcel/watcher", "@parcel/watcher-wasm")
      .replace("function $parcel$interopDefault(a) {", "$axY1a$parcelwatcher.default = $axY1a$parcelwatcher;\nfunction $parcel$interopDefault(a) {");
    await asyncFs.writeFile(indexJsPath, newIndexJsContents);
  }
}

// @parcel/rust browser.js patcher
{
  const browserJsPath = path.join(
    path.dirname(fileURLToPath(await import.meta.resolve("@parcel/rust"))),
    "browser.js",
  );
  const newBrowserJsContents =
`const { Environment, napi } = require("napi-wasm");
const crypto = require("crypto");

module.exports.hashString = void 0;

let env;
module.exports.init = async function init(input) {
  if (env) return;

  input = input ?? require("path").join(__dirname, "parcel_node_bindings.wasm");
  const { instance } = await WebAssembly.instantiate(
    require("fs").readFileSync(input),
    {
      env: {
        ...napi,
        __getrandom_custom: (ptr, len) => {
          let buf = env.memory.subarray(ptr, ptr + len);
          crypto.getRandomValues(buf);
        },
        log: (ptr, len) => {
          // eslint-disable-next-line no-console
          console.log(env.getString(ptr, len));
        },
      },
    }
  );

  for (let key in instance.exports) {
    if (key.startsWith("__napi_register__")) {
      instance.exports[key]();
    }
  }

  env = new Environment(instance);

  for (let key in env.exports) {
    if (key !== "transform") {
      module.exports[key] = env.exports[key];
    }
  }

  module.exports.transform = function (config) {
    !config.env["LOCALES"] && delete config.env["LOCALES"];
    !config.env["RTL_LOCALES"] && delete config.env["RTL_LOCALES"];
    !config.env["DEFAULT_LOCALE"] && delete config.env["DEFAULT_LOCALE"];
    let result = env.exports.transform(config);
    return {
      ...result,
      // Hydrate Uint8Array into Buffer
      code: Buffer.from(result.code),
    };
  };

  module.exports.Resolver.prototype.getInvalidations = function (_path) {
    return {
      invalidateOnFileCreate: [],
      invalidateOnFileChange: new Set(),
      invalidateOnStartup: false,
    };
  };

  env.exports.initPanicHook();
};`;
  await asyncFs.writeFile(browserJsPath, newBrowserJsContents);
}
