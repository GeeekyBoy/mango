/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @node-loader/http
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export function resolve(specifier, context, defaultResolve) {
  const { parentURL = null } = context;

  // Normally Node.js would error on specifiers starting with 'https://', so
  // this hook intercepts them and converts them into absolute URLs to be
  // passed along to the later hooks below.
  if (useLoader(specifier)) {
    return {
      shortCircuit: true,
      url: specifier,
    };
  } else if (parentURL && useLoader(parentURL)) {
    if (specifier.startsWith("node:") || specifier.startsWith("file:")) {
      return {
        shortCircuit: true,
        url: specifier,
      }
    } else {
      return {
        shortCircuit: true,
        url: new URL(specifier, parentURL).href,
      };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (useLoader(url)) {
    let format;
    if (url.endsWith(".mjs")) {
      format = "module";
    } else if (url.endsWith(".cjs")) {
      format = "commonjs";
    } else if (url.endsWith(".wasm")) {
      format = "wasm";
    } else if (url.endsWith(".json")) {
      format = "json";
    } else {
      // default to true, since NodeJS loaders only are triggered by ESM code
      // Alternatively, we could consider looking up the nearest package.json to the process.cwd()
      // And seeing if it has `"type": "module"`
      format = "module";
    }

    let source;

    const httpResponse = await fetch(url);

    if (httpResponse.ok) {
      source = await httpResponse.text();
    } else {
      throw Error(
        `Request to download javascript code from ${url} failed with HTTP status ${httpResponse.status} ${httpResponse.statusText}`
      );
    }

    return {
      shortCircuit: true,
      source: source,
      format: format,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}

export function getSource(url, context, defaultGetSource) {
  return defaultGetSource(url, context, defaultGetSource);
}

function useLoader(url) {
  return url.startsWith("http://") || url.startsWith("https://");
}
