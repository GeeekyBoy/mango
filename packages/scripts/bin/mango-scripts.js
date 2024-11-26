#! /usr/bin/env node
/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const mode = process.argv[2] || "start";
const isWebContainer = process.versions.hasOwnProperty("webcontainer");

switch (mode) {
  case "start":
    isWebContainer && await import("../scripts/webContainerPatcher.js");
    await import("../scripts/start.js");
    break;
  case "build":
    isWebContainer && await import("../scripts/webContainerPatcher.js");
    await import("../scripts/build.js");
    break;
  case "serve":
    await import("../scripts/serve.js");
    break;
  default:
    console.log(`Unknown mode: ${mode}`);
    process.exit(1);
}
