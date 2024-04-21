/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { parse } from "acorn";
import { simple } from "acorn-walk";

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
  simple(parse(code, { ecmaVersion: "latest", sourceType: "script", preserveParens: true }), {
    CallExpression(node) {
      const callee = node.callee;
      if (callee.type === "Identifier" && callee.name.startsWith("MANGO_TRANSLATION")) {
        const [arg0, arg1, ...rest] = node.arguments;
        if (arg0.type === "Literal") {
          const translationId = arg0.value;
          const childrenRanges = rest
            .filter((node) => !(node.type === "Literal" && node.value === " "))
            .map((node) => [node.start, node.end]);
          const params = {};
          reqTranslations[node.start] = [translationId, params, childrenRanges, node.end];
          if (arg1?.type === "ObjectExpression") {
            for (const prop of arg1.properties) {
              if (prop.type === "Property" && !prop.method) {
                const key = prop.key;
                if (key.type === "Identifier" && !key.computed) {
                  params[key.name] = [prop.value.start, prop.value.end];
                } else if (key.type === "Literal") {
                  params[key.value] = [prop.value.start, prop.value.end];
                }
              }
            }
          }
        }
      } else if (callee.type === "Identifier" && callee.name == "MANGO_FUNCTION") {
        const [arg0] = node.arguments;
        if (arg0.type === "Literal") {
          const [, functionId, functionResultName] = FUNCTION_RE.exec(arg0.value);
          reqFunctions[node.start] = [functionId, functionResultName, node.end];
        }
      } else if (callee.type === "Identifier" && callee.name == "MANGO_REMOTE_FUNCTION") {
        const [arg0] = node.arguments;
        if (arg0.type === "Literal") {
          const [, functionId, functionName] = REMOTE_FUNCTION_RE.exec(arg0.value);
          reqRemoteFunctions[node.start] = [functionId, functionName, node.end]
        }
      }
    },
  });
  return [reqTranslations, reqFunctions, reqRemoteFunctions];
}
