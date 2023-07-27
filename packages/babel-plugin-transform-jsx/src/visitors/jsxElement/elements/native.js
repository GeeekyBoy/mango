/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { traverse } from "@babel/core";
import t from "@babel/types";
import * as util from "../../../util/index.js";
import runtimeMethods from "../../../util/constants/runtimeMethods.js";

/**
 * @param {import('@babel/traverse').NodePath<t.JSXElement>} path
 * @param {string} tagName
 * @param {t.JSXAttribute[]} attrs
 * @param {t.Expression[]} children
 */
const native = (path, tagName, attrs, children) => {
  const namespace = util.mdn.getNamespace(tagName);
  const args = [];
  let refIdentifier = null;
  let onCreateHandler = null;
  args.push(t.stringLiteral(tagName));
  const attrArray = [];
  /** @type {{ [key: string]: ["style" | "event" | "prop" | "attr" | "unknown", t.Expression, boolean] }} */
  const foundAttrs = {};
  for (var i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (t.isJSXNamespacedName(attr.name)) {
      const directiveName = attr.name.namespace.name;
      if (directiveName === "bind") {
        const boundAttr = attr.name.name.name;
        const boundState = util.attrs.getValue(attr);
        // if (!util.types.isState(boundState) && !util.types.isBoundProp(boundState)) {
        if (!t.isIdentifier(boundState)) {
          throw path.buildCodeFrameError(`Bound property '${boundState}' must be a state or a bound property.`);
        }
        if (boundAttr === "this") {
          if (!t.isIdentifier(boundState)) {
            throw path.buildCodeFrameError("References to DOM elements must be stored in variables.")
          }
          if (refIdentifier) {
            throw path.buildCodeFrameError("DOM element can't have multiple references.")
          }
          refIdentifier = boundState;
        } else if (boundAttr === "value") {
          if (tagName === "input") {
            const typeAttr = attrs.find((attr) => t.isJSXIdentifier(attr.name) && attr.name.name === "type");
            let type = "text";
            if (typeAttr) {
              const typeAttrValue = util.attrs.getValue(typeAttr);
              if (t.isStringLiteral(typeAttrValue)) {
                type = typeAttrValue.value;
              }
            }
            const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
            if (
              type === "text" || type === "password" || type === "search" ||
              type === "tel" || type === "url" || type === "email" ||
              type === "date" || type === "month" || type === "week" ||
              type === "time" || type === "datetime-local" || type === "datetime" ||
              type === "color"
            ) {
              const propAccessor = t.memberExpression(elemAccessor, t.identifier("value"));
              const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
              stateUpdater.extra = { binder: elemAccessor };
              const recentUpdateAccessor = t.memberExpression(elemAccessor, t.identifier("$ru"));
              const recentUpdateUpdater = t.assignmentExpression("=", recentUpdateAccessor, t.stringLiteral(boundAttr));
              util.attrs.stackValue("oninput", "event", recentUpdateUpdater, foundAttrs, true);
              util.attrs.stackValue("oninput", "event", stateUpdater, foundAttrs, true);
              foundAttrs[boundAttr] = ["prop", boundState, true];
            } else if (type === "number" || type === "range") {
              const propAccessor = t.memberExpression(elemAccessor, t.identifier("value"));
              const convertedValue = t.callExpression(t.identifier("parseFloat"), [propAccessor]);
              const stateUpdater = t.assignmentExpression("=", boundState, convertedValue);
              stateUpdater.extra = { binder: elemAccessor };
              const recentUpdateAccessor = t.memberExpression(elemAccessor, t.identifier("$ru"));
              const recentUpdateUpdater = t.assignmentExpression("=", recentUpdateAccessor, t.stringLiteral(boundAttr));
              util.attrs.stackValue("oninput", "event", recentUpdateUpdater, foundAttrs, true);
              util.attrs.stackValue("oninput", "event", stateUpdater, foundAttrs, true);
              foundAttrs[boundAttr] = ["prop", boundState, true];
            } else if (type === "checkbox") {
              const propAccessor = t.memberExpression(elemAccessor, t.identifier("checked"));
              const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
              stateUpdater.extra = { binder: elemAccessor };
              const recentUpdateAccessor = t.memberExpression(elemAccessor, t.identifier("$ru"));
              const recentUpdateUpdater = t.assignmentExpression("=", recentUpdateAccessor, t.stringLiteral(boundAttr));
              util.attrs.stackValue("onclick", "event", recentUpdateUpdater, foundAttrs, true);
              util.attrs.stackValue("onclick", "event", stateUpdater, foundAttrs, true);
              foundAttrs["checked"] = ["prop", boundState, true];
            } else if (type === "file") {
              const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
              const propAccessor = t.memberExpression(elemAccessor, t.identifier("files"));
              const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
              util.attrs.stackValue("oninput", "event", stateUpdater, foundAttrs, true);
            }
          }
        } else if (boundAttr === "duration") {
          const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
          const propAccessor = t.memberExpression(elemAccessor, t.identifier("duration"));
          const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
          util.attrs.stackValue("ondurationchange", "event", stateUpdater, foundAttrs, true);
        } else if (boundAttr === "ended") {
          const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
          const propAccessor = t.memberExpression(elemAccessor, t.identifier("ended"));
          const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
          util.attrs.stackValue("onended", "event", stateUpdater, foundAttrs, true);
        } else if (boundAttr === "seeking") {
          const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
          const propAccessor = t.memberExpression(elemAccessor, t.identifier("seeking"));
          const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
          util.attrs.stackValue("onseeking", "event", stateUpdater, foundAttrs, true);
          util.attrs.stackValue("onseeked", "event", stateUpdater, foundAttrs, true);
        } else if (boundAttr === "volume") {
          const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
          const propAccessor = t.memberExpression(elemAccessor, t.identifier("volume"));
          const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
          stateUpdater.extra = { binder: elemAccessor };
          const recentUpdateAccessor = t.memberExpression(elemAccessor, t.identifier("$ru"));
          const recentUpdateUpdater = t.assignmentExpression("=", recentUpdateAccessor, t.stringLiteral(boundAttr));
          util.attrs.stackValue("onvolumechange", "event", recentUpdateUpdater, foundAttrs, true);
          util.attrs.stackValue("onvolumechange", "event", stateUpdater, foundAttrs, true);
          foundAttrs[boundAttr] = ["prop", boundState, true];
        } else if (boundAttr === "muted") {
          const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
          const propAccessor = t.memberExpression(elemAccessor, t.identifier("muted"));
          const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
          stateUpdater.extra = { binder: elemAccessor };
          const recentUpdateAccessor = t.memberExpression(elemAccessor, t.identifier("$ru"));
          const recentUpdateUpdater = t.assignmentExpression("=", recentUpdateAccessor, t.stringLiteral(boundAttr));
          util.attrs.stackValue("onvolumechange", "event", recentUpdateUpdater, foundAttrs, true);
          util.attrs.stackValue("onvolumechange", "event", stateUpdater, foundAttrs, true);
          foundAttrs[boundAttr] = ["prop", boundState, true];
        } else if (boundAttr === "playbackRate") {
          const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
          const propAccessor = t.memberExpression(elemAccessor, t.identifier("playbackRate"));
          const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
          stateUpdater.extra = { binder: elemAccessor };
          const recentUpdateAccessor = t.memberExpression(elemAccessor, t.identifier("$ru"));
          const recentUpdateUpdater = t.assignmentExpression("=", recentUpdateAccessor, t.stringLiteral(boundAttr));
          util.attrs.stackValue("onratechange", "event", recentUpdateUpdater, foundAttrs, true);
          util.attrs.stackValue("onratechange", "event", stateUpdater, foundAttrs, true);
          foundAttrs[boundAttr] = ["prop", boundState, true];
        } else if (boundAttr === "paused") {
          const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
          const propAccessor = t.memberExpression(elemAccessor, t.identifier("paused"));
          const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
          stateUpdater.extra = { binder: elemAccessor };
          const recentUpdateAccessor = t.memberExpression(elemAccessor, t.identifier("$ru"));
          const recentUpdateUpdater = t.assignmentExpression("=", recentUpdateAccessor, t.stringLiteral(boundAttr));
          util.attrs.stackValue("onpause", "event", recentUpdateUpdater, foundAttrs, true);
          util.attrs.stackValue("onpause", "event", stateUpdater, foundAttrs, true);
          util.attrs.stackValue("onplay", "event", recentUpdateUpdater, foundAttrs, true);
          util.attrs.stackValue("onplay", "event", stateUpdater, foundAttrs, true);
          foundAttrs[boundAttr] = ["prop", boundState, true];
        } else if (boundAttr === "currentTime") {
          const elemAccessor = t.memberExpression(t.identifier("e"), t.identifier("target"));
          const propAccessor = t.memberExpression(elemAccessor, t.identifier("currentTime"));
          const intervalIdAccessor = t.memberExpression(elemAccessor, t.identifier("$di"));
          const stateUpdater = t.assignmentExpression("=", boundState, propAccessor);
          stateUpdater.extra = { binder: elemAccessor };
          const recentUpdateAccessor = t.memberExpression(elemAccessor, t.identifier("$ru"));
          const recentUpdateUpdater = t.assignmentExpression("=", recentUpdateAccessor, t.stringLiteral(boundAttr));
          const intervalClbkBlock = t.blockStatement([t.expressionStatement(recentUpdateUpdater), t.expressionStatement(stateUpdater)]);
          const intervalClbk = t.functionExpression(null, [], intervalClbkBlock);
          const intervalInvoker = t.callExpression(t.identifier("setInterval"), [intervalClbk, t.numericLiteral(30)]);
          const intervalIdSetter = t.assignmentExpression("=", intervalIdAccessor, intervalInvoker);
          const noSetInterval = t.unaryExpression("!", intervalIdAccessor);
          const intervalIdConditioned = t.ifStatement(noSetInterval, t.blockStatement([t.expressionStatement(intervalIdSetter)]));
          const intervalClearer = t.callExpression(t.identifier("clearInterval"), [intervalIdAccessor]);
          const intervalIdClearer = t.assignmentExpression("=", intervalIdAccessor, t.nullLiteral());
          const isPausedCond = t.memberExpression(elemAccessor, t.identifier("paused"));
          const intervalClearerConditioned = t.ifStatement(isPausedCond, t.blockStatement([t.expressionStatement(intervalClearer), t.expressionStatement(intervalIdClearer)]));
          util.attrs.stackValue("onplay", "event", intervalIdConditioned, foundAttrs, true);
          util.attrs.stackValue("onpause", "event", intervalClearer, foundAttrs, true);
          util.attrs.stackValue("onpause", "event", intervalIdClearer, foundAttrs, true);
          util.attrs.stackValue("onseeking", "event", intervalIdConditioned, foundAttrs, true);
          util.attrs.stackValue("onseeked", "event", intervalClearerConditioned, foundAttrs, true);
          foundAttrs["currentTime"] = ["prop", boundState, true];
        }
      } else if (directiveName === "style" || directiveName === "prop" || directiveName === "attr" || directiveName === "event") {
        const propName = attr.name.name.name;
        const propValue = util.attrs.getValue(attr);
        const [stdAttr, attrType] = util.mdn.getStdAttr(tagName, namespace, propName);
        if (attrType === directiveName) {
          util.attrs.stackValue(stdAttr, directiveName, propValue, foundAttrs);
        } else {
          util.attrs.stackValue(propName, directiveName, propValue, foundAttrs);
        }
      }
    } else {
      const [attrName] = util.mdn.getStdAttr(tagName, namespace, attr.name.name);
      const attrValue = util.attrs.getValue(attr);
      if (attrName === "ref") {
        if (!t.isIdentifier(attrValue)) {
          throw path.buildCodeFrameError("References to DOM elements must be stored in variables.")
        }
        if (refIdentifier) {
          throw path.buildCodeFrameError("DOM element can't have multiple references.")
        }
        refIdentifier = attrValue;
      } else if (attrName === "style" && t.isObjectExpression(attrValue)) {
        /** @type {import('@babel/traverse').Visitor} */
        const visitor = {
          ObjectExpression(path) {
            path.node.properties.forEach((prop) => {
              if (t.isObjectMethod(prop)) {
                throw path.buildCodeFrameError("Style objects cannot contain methods.");
              } else if (t.isSpreadElement(prop)) {
                throw path.buildCodeFrameError("Style objects cannot contain spread elements.");
              } else {
                let propName = null;
                if (t.isStringLiteral(prop.key)) {
                  propName = prop.key.value;
                } else if (t.isIdentifier(prop.key)) {
                  propName = prop.key.name;
                } else {
                  throw path.buildCodeFrameError("Style objects can't contain computed properties.");
                }
                if (!t.isExpression(prop.value)) {
                  throw path.buildCodeFrameError("Style object values must be expressions.");
                }
                const [stdAttr, attrType] = util.mdn.getStdAttr(tagName, namespace, propName);
                foundAttrs[stdAttr] = [attrType, prop.value, false];
              }
            });
          },
        }
        if (attr.value) {
          traverse(attr.value, visitor, path.scope);
        }
      } else {
        const [stdAttr, attrType] = util.mdn.getStdAttr(tagName, namespace, attrName);
        util.attrs.stackValue(stdAttr, attrType, attrValue, foundAttrs);
      }
    }
  }
  if (foundAttrs["oncreate"]?.[0] === "event") {
    onCreateHandler = foundAttrs["oncreate"][1];
    delete foundAttrs["oncreate"];
  }
  /** @type {{ [key: string]: [("style" | "event" | "prop" | "attr" | "unknown"), string, t.Expression, boolean][] }} */
  const deps2attrs = {};
  for (const attrName in foundAttrs) {
    const [attrType, attrValue, isBound] = foundAttrs[attrName];
    const deps = util.deps.shouldHave(attrValue) ? util.deps.find(attrValue, path.scope).map(x => x.name).toString() : "";
    if (!deps2attrs[deps]) deps2attrs[deps] = [];
    deps2attrs[deps].push([attrType, attrName, attrValue, isBound]);
  }
  attrArray.push(...util.mutators.fromDeps2Attrs(deps2attrs, path.scope));
  if (namespace) {
    if (attrArray.length) {
      args.push(t.arrayExpression(attrArray));
    } else {
      args.push(t.identifier("undefined"));
    }
    if (children.length) {
      if (
        children.length === 1 &&
        t.isCallExpression(children[0]) &&
        t.isMemberExpression(children[0].callee) &&
        t.isIdentifier(children[0].callee.object) &&
        children[0].callee.object.name === "Mango" &&
        t.isIdentifier(children[0].callee.property) &&
        children[0].callee.property.name === runtimeMethods.createDynamicView &&
        children[0].arguments.length === 2 &&
        t.isFunctionExpression(children[0].arguments[0]) &&
        t.isArrayExpression(children[0].arguments[1])
      ) {
        const fn = t.functionExpression(
          null,
          [],
          t.blockStatement([
            t.returnStatement(t.arrayExpression([
              children[0].arguments[0],
              children[0].arguments[1],
            ])),
          ])
        );
        args.push(fn);
      } else {
        args.push(t.arrayExpression(children));
      }
    } else {
      args.push(t.identifier("undefined"));
    }
    args.push(t.numericLiteral(namespace));
  } else {
    if (children.length) {
      if (attrArray.length) {
        args.push(t.arrayExpression(attrArray));
      } else {
        args.push(t.identifier("undefined"));
      }
      if (
        children.length === 1 &&
        t.isCallExpression(children[0]) &&
        t.isMemberExpression(children[0].callee) &&
        t.isIdentifier(children[0].callee.object) &&
        children[0].callee.object.name === "Mango" &&
        t.isIdentifier(children[0].callee.property) &&
        children[0].callee.property.name === runtimeMethods.createDynamicView &&
        children[0].arguments.length === 2 &&
        t.isFunctionExpression(children[0].arguments[0]) &&
        t.isArrayExpression(children[0].arguments[1])
      ) {
        const fn = t.functionExpression(
          null,
          [],
          t.blockStatement([
            t.returnStatement(t.arrayExpression([
              children[0].arguments[0],
              children[0].arguments[1],
            ])),
          ])
        );
        args.push(fn);
      } else {
        args.push(t.arrayExpression(children));
      }
    } else if (attrArray.length) {
      args.push(t.arrayExpression(attrArray));
    }
  }
  const callee = t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.createElement));
  /** @type {t.Expression} */
  let initializerExpression = t.callExpression(callee, args);
  if (refIdentifier) {
    initializerExpression = t.assignmentExpression("=", refIdentifier, initializerExpression);
  }
  if (onCreateHandler) {
    initializerExpression = t.callExpression(onCreateHandler, [initializerExpression]);
  }
  path.replaceWith(initializerExpression);
}

export default native;
