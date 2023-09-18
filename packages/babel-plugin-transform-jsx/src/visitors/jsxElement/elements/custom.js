/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import sysPath from "path";
import { types as t } from "@babel/core";
import { globSync } from "glob";
import * as util from "../../../util/index.js";
import runtimeMethods from "../../../util/constants/runtimeMethods.js";

/**
 * @param {import('@babel/traverse').NodePath<t.JSXElement>} path
 * @param {t.JSXIdentifier | t.JSXMemberExpression} tagName
 * @param {t.JSXAttribute[]} attrs
 * @param {t.Expression[]} children
 * @param {import("@parcel/types").MutableAsset} asset
 * @param {{ [key: string]: string }} optimizedProps
 * @param {boolean} isLocalized
 */
const custom = (path, tagName, attrs, children, asset, optimizedProps, isLocalized) => {
  /** @type {{ [key: string]: t.Expression }} */
  const props = {};
  /** @type {{ [key: string]: t.Expression }} */
  const boundProps = {};
  /** @type {{ [key: string]: t.Identifier[] }} */
  const propsStates = {};
  /** @type {{ [key: string]: ["style" | "event", t.Expression, boolean] }} */
  const foundAttrs = {};
  const isLazy = t.isJSXIdentifier(tagName) && tagName.name === "lazy";
  let refIdentifier = null;
  let onCreateHandler = null;
  let lazyComponentPath = null;
  let lazyComponentPathGlob = null;
  let lazyComponentLoader = null;
  let lazyComponentFallback = null;
  for (const attr of attrs) {
    if (t.isJSXNamespacedName(attr.name)) {
      const directiveName = attr.name.namespace.name;
      const propName = attr.name.name.name;
      const propValue = util.attrs.getValue(attr);
      if (directiveName === "style" || directiveName === "event") {
        const [stdAttr, attrType] = util.mdn.getStdAttr("svg", 1, propName);
        if (attrType === directiveName) {
          util.attrs.stackValue(stdAttr, directiveName, propValue, foundAttrs);
        } else {
          util.attrs.stackValue(propName, directiveName, propValue, foundAttrs);
        }
      } else if (directiveName === "bind") {
        if (propName === "this") {
          if (!t.isIdentifier(propValue)) {
            throw path.buildCodeFrameError("References to DOM elements must be stored in variables.")
          }
          if (refIdentifier) {
            throw path.buildCodeFrameError("DOM element can't have multiple references.")
          }
          refIdentifier = propValue;
        }
        const optimizedPropName = optimizedProps[propName] || propName;
        propValue.extra = { raw: true };
        boundProps[optimizedPropName] = propValue;
      } else if (directiveName === "lazy") {
        if (!isLazy) {
          throw path.buildCodeFrameError("Lazy directive can only be used on lazy components.");
        }
        if (propName === "src") {
          lazyComponentPath = propValue;
        } else if (propName === "glob") {
          if (!t.isStringLiteral(propValue)) {
            throw path.buildCodeFrameError(`Lazy component's path glob must be a string literal.`);
          }
          lazyComponentPathGlob = propValue;
        } else if (propName === "loader") {
          lazyComponentLoader = propValue;
        } else if (propName === "fallback") {
          lazyComponentFallback = propValue;
        }
      }
    } else {
      const propName = attr.name.name;
      const propValue = util.attrs.getValue(attr);
      if (props[propName] !== undefined) {
        throw path.buildCodeFrameError(`'${tagName}' does not the following duplicate property names: '${propName}'.`);
      }
      if (propName === "children") {
        throw path.buildCodeFrameError(`'${tagName}' does not the following reserved property names: 'children'.`);
      }
      if (util.types.isState(t.identifier(propName))) {
        let processedPropValue = propValue;
        if (!(t.isIdentifier(propValue) && util.types.isState(propValue))) {
          processedPropValue = t.callExpression(t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.createState)), [propValue]);
        }
        const optimizedPropName = optimizedProps[propName] || propName;
        processedPropValue.extra = { raw: true };
        boundProps[optimizedPropName] = processedPropValue;
      } else {
        const optimizedPropName = optimizedProps[propName] || propName;
        props[optimizedPropName] = propValue;
        if (util.deps.shouldHave(propValue)) {
          propsStates[optimizedPropName] = util.deps.find(propValue, path.scope);
        }
      }
    }
  }
  const parsedProps =
    Object.keys(props).map((key) => {
      if (propsStates[key]) {
        const propStatesExp = t.arrayExpression(propsStates[key]);
        propStatesExp.extra = { isDepsArray: true };
        return t.objectProperty(
          t.identifier(key),
          t.callExpression(t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.createState)), [
            t.functionExpression(null, [], t.blockStatement([t.returnStatement(props[key])])),
            propStatesExp,
          ])
        );
      } else {
        return t.objectProperty(
          t.identifier(key),
          t.callExpression(t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.createState)), [props[key]])
        );
      }
    });
  const parsedBoundProps = Object.keys(boundProps).map((key) => t.objectProperty(t.identifier(key), boundProps[key]));
  const parsedChildren = [t.objectProperty(t.identifier(optimizedProps["children"] || "children"), t.arrayExpression(children))];
  const args = t.objectExpression(parsedProps.concat(parsedBoundProps).concat(parsedChildren));
  let componentCallee = null;
  if (t.isJSXIdentifier(tagName)) {
    componentCallee = t.identifier(isLazy ? "c" : tagName.name);
  } else if (t.isJSXMemberExpression(tagName)) {
    /** @type {t.Identifier[]} */
    const properties = [];
    /** @type {t.JSXMemberExpression | t.JSXIdentifier} */
    let object = tagName;
    while (t.isJSXMemberExpression(object)) {
      properties.unshift(t.identifier(object.property.name));
      object = object.object;
    }
    properties.unshift(t.identifier(object.name));
    while (properties.length > 1) {
      componentCallee = t.memberExpression(
        componentCallee || /** @type {t.Identifier} */ (properties.shift()),
        /** @type {t.Identifier} */ (properties.shift())
      );
    }
  }
  if (foundAttrs["oncreate"]?.[0] === "event") {
    onCreateHandler = foundAttrs["oncreate"][1];
    delete foundAttrs["oncreate"];
  }
  /** @type {t.Expression} */
  let initilizerExpression = t.callExpression(/** @type {t.Identifier | t.MemberExpression} */ (componentCallee), [args]);
  /** @type {{ [key: string]: [("style" | "event" | "prop" | "attr" | "unknown"), string, t.Expression, boolean][] }} */
  const deps2attrs = {};
  for (const attrName in foundAttrs) {
    const [attrType, attrValue] = foundAttrs[attrName];
    const deps = util.deps.shouldHave(attrValue) ? util.deps.find(attrValue, path.scope).map(x => x.name).toString() : "";
    if (!deps2attrs[deps]) deps2attrs[deps] = [];
    deps2attrs[deps].push([attrType, attrName, attrValue, false]);
  }
  const attrArray = util.mutators.fromDeps2Attrs(deps2attrs, path.scope);
  if (attrArray.length) {
    const propsAppendCallee = t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.appendPropsToElement));
    initilizerExpression = t.callExpression(propsAppendCallee, [initilizerExpression, t.arrayExpression(attrArray)]);
  }
  if (refIdentifier) {
    initilizerExpression = t.assignmentExpression("=", refIdentifier, initilizerExpression);
  }
  if (onCreateHandler) {
    initilizerExpression = t.callExpression(onCreateHandler, [initilizerExpression]);
  }
  if (isLazy) {
    const lazyCallee = t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.createLazyComponent));
    if (!lazyComponentPath) {
      throw path.buildCodeFrameError(`Lazy component must have a 'component' attribute.`);
    }
    /** @type {t.Expression} */
    let lazyComponentPathExpression;
    if (lazyComponentPathGlob) {
      const fileNames = globSync(lazyComponentPathGlob.value, { cwd: sysPath.dirname(asset.filePath) });
      for (const fileName of fileNames) {
        asset.invalidateOnFileChange(sysPath.join(sysPath.dirname(asset.filePath), fileName));
        asset.addURLDependency(fileName + "?component", {
          priority: asset.env.shouldOptimize ? "lazy" : "parallel",
          bundleBehavior: 'isolated',
          needsStableName: true,
          env: {
            sourceType: "module",
            outputFormat: "global",
            isLibrary: true,
            loc: {
              filePath: asset.filePath,
              start: { line: 0, column: 0 },
              end: { line: 0, column: 0 },
            },
          },
        })
      }
      const componentsPath = t.stringLiteral("/components");
      const componentsExtension = t.stringLiteral(".js");
      const componentPathWithoutExtension = t.binaryExpression("+", componentsPath, lazyComponentPath);
      const componentPath = t.binaryExpression("+", componentPathWithoutExtension, componentsExtension);
      lazyComponentPathExpression = isLocalized
        ? t.binaryExpression("+", componentPath, t.binaryExpression("+", t.stringLiteral("."), t.memberExpression(t.identifier("window"), t.identifier("$l"))))
        : componentPath;
    } else {
      if (!t.isStringLiteral(lazyComponentPath)) {
        throw path.buildCodeFrameError(`Lazy component's 'component' attribute must be a string literal.`);
      }
      const componentPath = t.stringLiteral(asset.addURLDependency(lazyComponentPath.value + "?component", {
        priority: asset.env.shouldOptimize ? "lazy" : "parallel",
        bundleBehavior: 'isolated',
        needsStableName: true,
        env: {
          sourceType: "module",
          outputFormat: "global",
          isLibrary: true,
          loc: {
            filePath: asset.filePath,
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 },
          },
        },
      }));
      lazyComponentPathExpression = isLocalized
        ? t.binaryExpression("+", componentPath, t.binaryExpression("+", t.stringLiteral("."), t.memberExpression(t.identifier("window"), t.identifier("$l"))))
        : componentPath;
    }
    const componentInitializer = t.functionExpression(null, [t.identifier("c")], t.blockStatement([t.returnStatement(initilizerExpression)]));
    /** @type {t.Expression[]} */
    const lazyArguments = [lazyComponentPathExpression, componentInitializer];
    if (lazyComponentLoader) {
      lazyArguments.push(lazyComponentLoader);
    }
    if (lazyComponentFallback) {
      if (!lazyComponentLoader) {
        lazyArguments.push(t.identifier("undefined"));
      }
      lazyArguments.push(lazyComponentFallback);
    }
    const lazyCallExpression = t.callExpression(lazyCallee, lazyArguments);
    path.replaceWith(lazyCallExpression);
  } else {
    path.replaceWith(initilizerExpression);
  }
}

export default custom;
