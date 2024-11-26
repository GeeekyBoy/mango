/**
 * Copyright (c) GeeekyBoy
 * A worker used to separate dynamic import from main thread.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { parentPort } from "worker_threads";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.versions.bun) {
  const { register } = await import("module");
  register("./util/httpLoader.node.js", pathToFileURL(__dirname + path.sep));
}

let pendingTasks = 0;

parentPort.on("message", async (msg) => {
  if (msg !== "exit") {
    pendingTasks++;
    const [functionPath, exportName, params, reqId] = msg;
    if (params[0].url) {
      params[0].url = new URL(params[0].url);
    }
    try {
      const result = await (await import(functionPath))[exportName](...params);
      parentPort.postMessage([0, reqId, result]);
    } catch (err) {
      parentPort.postMessage([1, reqId, err]);
    }
  }
  pendingTasks--;
  if (pendingTasks === -1) {
    process.exit(1);
  }
});
