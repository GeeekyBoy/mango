/**
 * Copyright (c) GeeekyBoy
 * A worker used to separate dynamic import from main thread.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { workerData, parentPort } from "worker_threads";
import { pathToFileURL } from "url";
import { types as t } from "@babel/core";

/** @type {{ type: "ssg" | "ssr" | "remote", path: string, hash: string, exports: string[] }[]} */
const dynamicMeta = workerData;

/** @type {{ [key: string]: t.Expression }} */
const dynamicContent = {};

for (const { type, path, hash, exports } of dynamicMeta) {
  if (type === "ssg") {
    const url = pathToFileURL(path);
    const module = await import(url);
    for (const exportName of exports) {
      if (exportName in dynamicContent) {
        throw new Error(`Duplicate export name ${exportName}`);
      } else if (exportName in module) {
        dynamicContent[exportName] = t.valueToNode(module[exportName]);
      } else {
        throw new Error(`Export name ${exportName} not found`);
      }
    }
  } else {
    for (const exportName of exports) {
      if (exportName in dynamicContent) {
        throw new Error(`Duplicate export name ${exportName}`);
      } else if (type === "ssr") {
        dynamicContent[exportName] = t.stringLiteral(`${hash}#${exportName}`);
      } else {
        dynamicContent[exportName] = t.callExpression(
          t.memberExpression(t.identifier("Mango"), t.identifier("n")),
          [t.stringLiteral(`${hash}@${exportName}`)]
        );
      }
    }
  }
}

parentPort.postMessage(dynamicContent);
process.exit(0);
