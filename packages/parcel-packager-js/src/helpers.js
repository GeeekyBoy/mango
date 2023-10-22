/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/packager-js
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const prelude = () => `\
var $parcel$modules = {};
var $parcel$inits = {};

var parcelRequire = $parcel$global["parcelRequire"];
if (parcelRequire == null) {
  parcelRequire = function(id) {
    if (id in $parcel$modules) {
      return $parcel$modules[id].exports;
    }
    if (id in $parcel$inits) {
      var init = $parcel$inits[id];
      delete $parcel$inits[id];
      var module = {id: id, exports: {}};
      $parcel$modules[id] = module;
      init.call(module.exports, module, module.exports);
      return module.exports;
    }
    var err = new Error("Cannot find module '" + id + "'");
    err.code = "MODULE_NOT_FOUND";
    throw err;
  };

  parcelRequire.register = function register(id, init) {
    $parcel$inits[id] = init;
  };

  $parcel$global["parcelRequire"] = parcelRequire;
}

var parcelRegister = parcelRequire.register;
`;

const $parcel$export = `\
function $parcel$export(e, n, v, s) {
  var r=v();r&&"register"!==n&&"resolve"!==n&&"getBundleURL"!==n?e[n]=r:e[n]=v;
}
`;

const $parcel$exportWildcard = `\
function $parcel$exportWildcard(dest, source) {
  Object.keys(source).forEach(function(key) {
    if (key === "default" || key === "__esModule" || dest.hasOwnProperty(key)) {
      return;
    }

    Object.defineProperty(dest, key, {
      enumerable: true,
      get: function get() {
        return source[key];
      }
    });
  });

  return dest;
}
`;

const $parcel$interopDefault = `\
function $parcel$interopDefault(a) {
  return a && a.__esModule ? a["default"] : a;
}
`;

const $parcel$global_self = `var $parcel$global = self;`;
const $parcel$global_window = `var $parcel$global = window;`;

const $parcel$defineInteropFlag = `\
function $parcel$defineInteropFlag(a) {
  Object.defineProperty(a, "__esModule", {value: true, configurable: true});
}
`;

export const helpers = {
  $parcel$export,
  $parcel$exportWildcard,
  $parcel$interopDefault,
  $parcel$global_self,
  $parcel$global_window,
  $parcel$defineInteropFlag,
};
