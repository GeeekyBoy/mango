/**
 * Copyright (c) GeeekyBoy
 * A worker used to separate dynamic import from main thread.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { parentPort } from "worker_threads";

parentPort.on("message", async ([functionPath, exportName, params, reqId]) => {
  try {
    const result = await (await import(functionPath))[exportName](...params);
    parentPort.postMessage([0, reqId, result]);
  } catch (err) {
    parentPort.postMessage([1, reqId, err]);
  }
});
