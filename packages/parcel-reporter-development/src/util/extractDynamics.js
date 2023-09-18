/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import babel, { types as t } from "@babel/core";

const FUNCTION_RE = /^\/__mango__\/functions\/function\.([\da-z]{8})\.js\#(.*)$/;
const REMOTE_FUNCTION_RE = /^\/__mango__\/functions\/function\.([\da-z]{8})\.js\@(.*)$/;

/**
 * @param {string} code
 * @returns {Promise<[
 *  { [key: string]: [string, { [key: string]: [number, number] }, [number, number][], number] },
 *  { [key: string]: [string, string, number] },
 *  { [key: string]: [string, string, number] }
 * ]>}
 */
export default async function extractDynamics(code) {
  /** @type {{ [key: string]: [string, { [key: string]: [number, number] }, [number, number][], number] }} */
  const reqTranslations = {};
  /** @type {{ [key: string]: [string, string, number] }} */
  const reqFunctions = {};
  /** @type {{ [key: string]: [string, string, number] }} */
  const reqRemoteFunctions = {};
  babel.traverse(await babel.parseAsync(code), {
    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name.startsWith("MANGO_TRANSLATION")) {
        const [arg0, arg1, ...rest] = path.node.arguments;
        if (t.isStringLiteral(arg0)) {
          const translationId = arg0.value;
          const childrenRanges = rest
            .filter((node) => !(t.isStringLiteral(node) && node.value === " "))
            .map((node) => [node.start, node.end]);
          const params = {};
          reqTranslations[path.node.start] = [translationId, params, childrenRanges, path.node.end];
          if (t.isObjectExpression(arg1)) {
            for (const prop of arg1.properties) {
              if (t.isObjectProperty(prop)) {
                const key = prop.key;
                if (t.isIdentifier(key)) {
                  params[key.name] = [prop.value.start, prop.value.end];
                } else if (t.isStringLiteral(key)) {
                  params[key.value] = [prop.value.start, prop.value.end];
                }
              }
            }
          }
        }
      }
    },
    StringLiteral(path) {
      const { value } = path.node;
      if (FUNCTION_RE.test(value)) {
        const [, functionId, functionResultName] = FUNCTION_RE.exec(value);
        reqFunctions[path.node.start] = [functionId, functionResultName, path.node.end]
      } else if (REMOTE_FUNCTION_RE.test(value)) {
        const [, functionId, functionName] = REMOTE_FUNCTION_RE.exec(value);
        reqRemoteFunctions[path.node.start] = [functionId, functionName, path.node.end]
      }
    }
  });
  return [reqTranslations, reqFunctions, reqRemoteFunctions];
}
