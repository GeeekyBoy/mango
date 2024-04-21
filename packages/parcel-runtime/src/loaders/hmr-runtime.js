/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/runtime-browser-hmr
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @typedef {{
 *  id: string,
 *  url: string,
 *  type: string,
 *  output: string,
 *  envHash: string,
 *  outputFormat: string,
 *  depsByBundle: {[string]: {[string]: string}},
 * }} HMRAsset
 */

/**
 * @typedef {{
 *  type: 'update',
 *  assets: Array<HMRAsset>,
 * }} HMRUpdateMessage
 */

/**
 * @typedef {{
 *  type: 'error',
 *  diagnostics: {
 *    ansi: Array<any>,
 *    html: Array<any>,
 *  },
 * }} HMRErrorMessage
 */

/** @typedef {HMRUpdateMessage | HMRErrorMessage} HMRMessage */

/**
 * @typedef {{
 *  hot: {
 *   data: any,
 *   accept(cb: (Function) => void): void,
 *   dispose(cb: (any) => void): void,
 *   _acceptCallbacks: Array<(Function) => void>,
 *   _disposeCallbacks: Array<(any) => void>,
 *  }
 * }} ParcelModule
 */

/**
 * @typedef {{
 *  cache: {[string]: ParcelModule},
 *  hotData: {[string]: any},
 *  Module: any,
 *  parent: ?ParcelRequire,
 *  isParcelRequire: true,
 *  modules: {[string]: [Function, {[string]: string}]},
 *  HMR_BUNDLE_ID: string,
 *  root: ParcelRequire,
 * }} ParcelRequire
 */

var globalObject = typeof self !== "undefined" ? self : window;

globalObject["loadedEnvs"] = globalObject["loadedEnvs"] || new Set();
globalObject["loadedEnvs"].add(/** @type {string} */ (HMR_ENV_HASH));

var OVERLAY_ID = '__parcel__error__overlay__';

var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData[moduleName],
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    },
  };
  module.bundle.hotData[moduleName] = undefined;
}
module.bundle.Module = Module;
module.bundle.hotData = {};

/** @type {{ [string]: boolean }} */
let checkedAssets = {};

/** @type {Array<[ParcelRequire, string]>} */
let assetsToDispose = [];

/** @type {Array<[ParcelRequire, string]>} */
let assetsToAccept = [];

/** @type {boolean} */
let supportsSourceURL = false;

/**
 * @returns {string}
 */
function getHostname() {
  return location.protocol.indexOf('http') === 0 ? location.hostname : 'localhost';
}

/**
 * @returns {string}
 */
function getPort() {
  return location.port;
}

const parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  const hostname = getHostname();
  const port = getPort();
  const protocol =
    /** @type {boolean} */ (HMR_SECURE) ||
    (location.protocol == 'https:' &&
      !['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname))
      ? 'wss'
      : 'ws';
  const currentUrl = location.href;
  const wsQuery = `?url=${encodeURIComponent(currentUrl)}`;
  const wsUrl = `${protocol}://${hostname}${port ? ':' + port : ''}/${wsQuery}`;

  let pendingRouteChange = null;

  /** @type {WebSocket} */
  let ws;
  try {
    ws = new WebSocket(wsUrl);
    ws.onopen = function () {
      if (pendingRouteChange) {
        ws.send(JSON.stringify(pendingRouteChange));
        pendingRouteChange = null;
      }
    }
  } catch (err) {
    if (err.message) {
      console.error(err.message);
    }
    ws = {};
  }

  if (window) {
    window.addEventListener('beforeunload', function () {
      ws.close();
    });

    window.__notifyHMRRouteChange = function () {
      const message = {
        type: 'route_change',
        payload: {
          url: location.href,
        },
      };
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      } else {
        pendingRouteChange = message;
      }
    };

    window.addEventListener('popstate', function () {
      window.__notifyHMRRouteChange();
    });
  }

  // Safari doesn't support sourceURL in error stacks.
  // eval may also be disabled via CSP, so do a quick check.
  try {
    (0, eval)('throw new Error("test"); //# sourceURL=test.js');
  } catch (err) {
    supportsSourceURL = err.stack.includes('test.js');
  }

  ws.onmessage = async function (/** @type {{ data: string }} */ event) {
    checkedAssets = {};
    assetsToAccept = [];
    assetsToDispose = [];

    /** @type {HMRMessage} */
    const data = JSON.parse(event.data);

    if (data.type === 'update') {
      // Remove error overlay if there is one
      if (typeof document !== 'undefined') {
        removeErrorOverlay();
      }

      const assets = data.assets.filter(asset => globalObject["loadedEnvs"].has(asset.envHash));

      // Handle HMR Update
      const handled = assets.every(asset => (
          asset.type === 'css' ||
          (asset.type === 'js' &&
            hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle))
        ));

      if (handled) {
        console.clear();

        // Dispatch custom event so other runtimes (e.g React Refresh) are aware.
        if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
          window.dispatchEvent(new CustomEvent('parcelhmraccept'));
        }

        await hmrApplyUpdates(assets);

        // Dispose all old assets.
        /** @type {{ [string]: boolean }} */
        let processedAssets = {};
        for (let i = 0; i < assetsToDispose.length; i++) {
          const id = assetsToDispose[i][1];

          if (!processedAssets[id]) {
            hmrDispose(assetsToDispose[i][0], id);
            processedAssets[id] = true;
          }
        }

        // Run accept callbacks. This will also re-execute other disposed assets in topological order.
        processedAssets = {};
        for (let i = 0; i < assetsToAccept.length; i++) {
          let id = assetsToAccept[i][1];

          if (!processedAssets[id]) {
            hmrAccept(assetsToAccept[i][0], id);
            processedAssets[id] = true;
          }
        }
      } else {
        location.reload();
      }
    }

    if (data.type === 'error') {
      // Log parcel errors to console
      for (const ansiDiagnostic of data.diagnostics.ansi) {
        const stack = ansiDiagnostic.codeframe
          ? ansiDiagnostic.codeframe
          : ansiDiagnostic.stack;

        console.error(
          '🚨 [parcel]: ' +
            ansiDiagnostic.message +
            '\n' +
            stack +
            '\n\n' +
            ansiDiagnostic.hints.join('\n'),
        );
      }

      if (typeof document !== 'undefined') {
        // Render the fancy html overlay
        removeErrorOverlay();
        const overlay = createErrorOverlay(data.diagnostics.html);
        document.body.appendChild(overlay);
      }
    }
  };

  ws.onerror = function (e) {
    if (e.message) {
      console.error(e.message);
    }
  };

  ws.onclose = function () {
    console.warn('[parcel] 🚨 Connection to the HMR server was lost');
  };
}

/**
 * @returns {void}
 */
function removeErrorOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.remove();
    console.log('[parcel] ✨ Error resolved');
  }
}

/**
 * @param {Array<any>} diagnostics
 * @returns {HTMLDivElement}
 */
function createErrorOverlay(diagnostics) {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;

  let errorHTML =
    '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';

  for (let diagnostic of diagnostics) {
    const stack = diagnostic.frames.length
      ? diagnostic.frames.reduce((p, frame) => `
        ${p}
        <a
          href="/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}"
          style="text-decoration: underline; color: #888"
          onclick="fetch(this.href); return false"
        >
          ${frame.location}
        </a>
        ${frame.code}
      `, '')
      : diagnostic.stack;

    errorHTML += `
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          🚨 ${diagnostic.message}
        </div>
        <pre>${stack}</pre>
        <div>
          ${diagnostic.hints.map(hint => '<div>💡 ' + hint + '</div>').join('')}
        </div>
        ${
          diagnostic.documentation
            ? `<div>📝 <a style="color: violet" href="${diagnostic.documentation}" target="_blank">Learn more</a></div>`
            : ''
        }
      </div>
    `;
  }

  errorHTML += '</div>';

  overlay.innerHTML = errorHTML;

  return overlay;
}

/**
 * @param {ParcelRequire} bundle
 * @param {string} id
 * @returns {Array<[ParcelRequire, string]>}
 */
function getParents(bundle, id) {
  const modules = bundle.modules;
  if (!modules) {
    return [];
  }

  const parents = [];

  for (const k in modules) {
    for (const d in modules[k][1]) {
      const dep = modules[k][1][d];

      if (dep === id || (Array.isArray(dep) && dep[dep.length - 1] === id)) {
        parents.push([bundle, k]);
      }
    }
  }

  if (bundle.parent) {
    parents.push(...getParents(bundle.parent, id));
  }

  return parents;
}

/**
 * @param {HTMLLinkElement} link
 */
function updateLink(link) {
  const href = link.getAttribute('href');

  if (!href) {
    return;
  }

  const newLink = link.cloneNode();
  newLink.onload = function () {
    if (link.parentNode !== null) {
      link.parentNode.removeChild(link);
    }
  };
  newLink.setAttribute('href', href.split('?')[0] + '?' + Date.now());
  link.parentNode.insertBefore(newLink, link.nextSibling);
}

/** @type {?number} */
let cssTimeout = null;

/**
 * @returns {void}
 */
function reloadCSS() {
  if (cssTimeout) {
    return;
  }

  cssTimeout = setTimeout(function () {
    /** @type {NodeListOf<HTMLLinkElement>} */
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    for (let i = 0; i < links.length; i++) {
      const href = links[i].getAttribute('href');
      const hostname = getHostname();
      const servedFromHMRServer =
        hostname === 'localhost'
          ? new RegExp(
              '^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):' + getPort(),
            ).test(href)
          : href.indexOf(hostname + ':' + getPort());
      const absolute =
        /^https?:\/\//i.test(href) &&
        href.indexOf(location.origin) !== 0 &&
        !servedFromHMRServer;
      if (!absolute) {
        updateLink(links[i]);
      }
    }

    cssTimeout = null;
  }, 50);
}

/**
 * @param {HMRAsset} asset
 * @returns {Promise<HTMLScriptElement | void>}
 */
function hmrDownload(asset) {
  if (asset.type === 'js') {
    if (typeof document !== 'undefined') {
      const script = document.createElement('script');
      script.src = asset.url + '?t=' + Date.now();
      return new Promise((resolve, reject) => {
        script.onload = () => resolve(script);
        script.onerror = reject;
        document.head?.appendChild(script);
      });
    } else if (typeof importScripts === 'function') {
      // Worker scripts
      return new Promise((resolve, reject) => {
        try {
          /** @type {(string) => Promise<void>} */ __parcel__importScripts__(asset.url + '?t=' + Date.now());
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }
  }
}

/**
 * @param {Array<HMRAsset>} assets
 * @returns {Promise<void>}
 */
async function hmrApplyUpdates(assets) {
  global.parcelHotUpdate = Object.create(null);

  /** @type {?Array<HTMLScriptElement | void>} */
  let scriptsToRemove = null;
  try {
    // If sourceURL comments aren't supported in eval, we need to load
    // the update from the dev server over HTTP so that stack traces
    // are correct in errors/logs. This is much slower than eval, so
    // we only do it if needed (currently just Safari).
    // https://bugs.webkit.org/show_bug.cgi?id=137297
    // This path is also taken if a CSP disallows eval.
    if (!supportsSourceURL) {
      const promises = assets.map(asset =>
        hmrDownload(asset)?.catch(err => {
          throw err;
        }),
      );

      scriptsToRemove = await Promise.all(promises);
    }

    assets.forEach(function (asset) {
      hmrApply(module.bundle.root, asset);
    });
  } finally {
    delete global.parcelHotUpdate;

    if (scriptsToRemove) {
      scriptsToRemove.forEach(script => {
        if (script) {
          document.head?.removeChild(script);
        }
      });
    }
  }
}

/**
 * @param {ParcelRequire} bundle
 * @param {HMRAsset} asset
 * @returns {void}
 */
function hmrApply(bundle, asset) {
  const modules = bundle.modules;
  if (!modules) {
    return;
  }

  if (asset.type === 'css') {
    reloadCSS();
  } else if (asset.type === 'js') {
    const deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
    if (deps) {
      if (modules[asset.id]) {
        // Remove dependencies that are removed and will become orphaned.
        // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
        const oldDeps = modules[asset.id][1];
        for (const dep in oldDeps) {
          if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
            const id = oldDeps[dep];
            const parents = getParents(module.bundle.root, id);
            if (parents.length === 1) {
              hmrDelete(module.bundle.root, id);
            }
          }
        }
      }

      if (supportsSourceURL) {
        // Global eval. We would use `new Function` here but browser
        // support for source maps is better with eval.
        (0, eval)(asset.output);
      }

      const fn = global.parcelHotUpdate[asset.id];
      modules[asset.id] = [fn, deps];
    } else if (bundle.parent) {
      hmrApply(bundle.parent, asset);
    }
  }
}

/**
 * @param {ParcelRequire} bundle
 * @param {string} id
 * @returns {void}
 */
function hmrDelete(bundle, id) {
  const modules = bundle.modules;
  if (!modules) {
    return;
  }

  if (modules[id]) {
    // Collect dependencies that will become orphaned when this module is deleted.
    const deps = modules[id][1];
    const orphans = [];
    for (const dep in deps) {
      const parents = getParents(module.bundle.root, deps[dep]);
      if (parents.length === 1) {
        orphans.push(deps[dep]);
      }
    }

    // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
    delete modules[id];
    delete bundle.cache[id];

    // Now delete the orphans.
    orphans.forEach(id => {
      hmrDelete(module.bundle.root, id);
    });
  } else if (bundle.parent) {
    hmrDelete(bundle.parent, id);
  }
}

/**
 * @param {ParcelRequire} bundle
 * @param {string} id
 * @param {?{ [string]: { [string]: string } }} depsByBundle
 * @returns {boolean}
 */
function hmrAcceptCheck(bundle, id, depsByBundle,) {
  if (hmrAcceptCheckOne(bundle, id, depsByBundle)) {
    return true;
  }

  // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
  const parents = getParents(module.bundle.root, id);
  let accepted = false;
  while (parents.length > 0) {
    const v = parents.shift();
    const a = hmrAcceptCheckOne(v[0], v[1], null);
    if (a) {
      // If this parent accepts, stop traversing upward, but still consider siblings.
      accepted = true;
    } else {
      // Otherwise, queue the parents in the next level upward.
      const p = getParents(module.bundle.root, v[1]);
      if (p.length === 0) {
        // If there are no parents, then we've reached an entry without accepting. Reload.
        accepted = false;
        break;
      }
      parents.push(...p);
    }
  }

  return accepted;
}

/**
 * @param {ParcelRequire} bundle
 * @param {string} id
 * @param {?{ [string]: { [string]: string } }} depsByBundle
 * @returns {boolean}
 */
function hmrAcceptCheckOne(bundle, id, depsByBundle,) {
  const modules = bundle.modules;
  if (!modules) {
    return;
  }

  if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
    // If we reached the root bundle without finding where the asset should go,
    // there's nothing to do. Mark as "accepted" so we don't reload the page.
    if (!bundle.parent) {
      return true;
    }

    return hmrAcceptCheck(bundle.parent, id, depsByBundle);
  }

  if (checkedAssets[id]) {
    return true;
  }

  checkedAssets[id] = true;

  const cached = bundle.cache[id];
  assetsToDispose.push([bundle, id]);

  if (!cached || (cached.hot && cached.hot._acceptCallbacks.length)) {
    assetsToAccept.push([bundle, id]);
    return true;
  }
}

/**
 * @param {ParcelRequire} bundle
 * @param {string} id
 * @returns {void}
 */
function hmrDispose(bundle, id) {
  const cached = bundle.cache[id];
  bundle.hotData[id] = {};
  if (cached && cached.hot) {
    cached.hot.data = bundle.hotData[id];
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData[id]);
    });
  }

  delete bundle.cache[id];
}

/**
 * @param {ParcelRequire} bundle
 * @param {string} id
 * @returns {void}
 */
function hmrAccept(bundle, id) {
  // Execute the module.
  bundle(id);

  // Run the accept callbacks in the new version of the module.
  const cached = bundle.cache[id];
  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      const assetsToAlsoAccept = cb(function () {
        return getParents(module.bundle.root, id);
      });
      if (assetsToAlsoAccept && assetsToAccept.length) {
        assetsToAlsoAccept.forEach(function (a) {
          hmrDispose(a[0], a[1]);
        });

        assetsToAccept.push.apply(assetsToAccept, assetsToAlsoAccept);
      }
    });
  }
}
