/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import icuParser from "@formatjs/icu-messageformat-parser";

/**
 * @param {string} content
 * @param {{ [key: string]: [string, { [key: string]: [number, number] }, [number, number][], number] }} reqTranslations
 * @param {{ [key: string]: [string, string, number] }} reqFunctions
 * @param {{ [key: string]: [string, string, number] }} reqRemoteFunctions
 * @param {{ [key: string]: icuParser.MessageFormatElement[] }[]} allTranslations
 * @param {number} start
 * @param {number} end
 * @param {boolean} isDeep
 * @returns {string | string[]}
 */
export default function preprocessDynamicContent(
  content,
  reqTranslations,
  reqFunctions,
  reqRemoteFunctions,
  allTranslations,
  start = 0,
  end = content.length,
  isDeep = false
) {
  const data = [];
  let buffer = "";
  for (let i = start; i < end; i++) {
    if (i in reqTranslations) {
      const [translationId, params, children, end] = reqTranslations[i];
      if (buffer) {
        data.push(JSON.stringify(buffer));
        buffer = "";
      }
      if (allTranslations.length > 1) {
        buffer += "[";
      }
      for (const translations of allTranslations) {
        const translationAST = translations[translationId];
        if (translationAST) {
          const preprocessedPrams = {};
          const preprocessedChildren = [];
          const translationData = [];
          let translationBuffer = "";
          let childIndexCaptured = false;
          let shouldConcatenate = false;
          for (const param in params) {
            const [paramStart, paramEnd] = params[param];
            preprocessedPrams[param] = preprocessDynamicContent(content, reqTranslations, reqFunctions, reqRemoteFunctions, [translations], paramStart, paramEnd, true);
          }
          for (const child of children) {
            const [childStart, childEnd] = child;
            preprocessedChildren.push(preprocessDynamicContent(content, reqTranslations, reqFunctions, reqRemoteFunctions, [translations], childStart, childEnd, true));
          }
          for (const node of translationAST) {
            if (node.type === icuParser.TYPE.literal) {
              if (shouldConcatenate) {
                translationBuffer += "+";
                shouldConcatenate = false;
              }
              translationBuffer += JSON.stringify(node.value);
              shouldConcatenate = true;
            } else if (node.type === icuParser.TYPE.argument) {
              const varName = node.value;
              if (isNaN(varName)) {
                if (shouldConcatenate) {
                  translationBuffer += "+";
                  shouldConcatenate = false;
                }
                if (translationBuffer) {
                  translationData.push(JSON.stringify(translationBuffer));
                  translationBuffer = "";
                }
                translationData.push(...preprocessedPrams[varName]);
                shouldConcatenate = true;
              } else {
                if (!childIndexCaptured) {
                  translationData.unshift(JSON.stringify("["));
                }
                if (varName in children) {
                  if (shouldConcatenate) {
                    translationBuffer += ",";
                    shouldConcatenate = false;
                  }
                  if (translationBuffer) {
                    translationData.push(JSON.stringify(translationBuffer));
                    translationBuffer = "";
                  }
                  translationData.push(...preprocessedChildren[varName]);
                } else {
                  translationBuffer += JSON.stringify("undefined");
                }
                if (node !== translationAST[translationAST.length - 1]) {
                  translationBuffer += ",";
                }
                childIndexCaptured = true;
              }
            }
          }
          if (childIndexCaptured) {
            translationBuffer += "]";
          }
          if (translationBuffer) {
            translationData.push(JSON.stringify(translationBuffer));
          }
          buffer += translationData.reduce((acc, curr) => {
            if (!curr.startsWith("J") && acc[acc.length - 1] && !acc[acc.length - 1].startsWith("J")) {
              acc[acc.length - 1] = JSON.stringify(JSON.parse(acc[acc.length - 1]) + JSON.parse(curr));
            } else {
              acc.push(curr);
            }
            return acc;
          }, []).join("+");
        } else {
          buffer += JSON.stringify(JSON.stringify(translationId));
        }
        if (translations !== allTranslations[allTranslations.length - 1]) {
          buffer += ",";
        }
      }
      if (allTranslations.length > 1) {
        buffer += "][localeIndex]";
      }
      data.push(buffer);
      buffer = "";
      i = end - 1;
    } else if (i in reqFunctions) {
      const [functionId, functionResultName, end] = reqFunctions[i];
      if (buffer) {
        data.push(JSON.stringify(buffer));
        buffer = "";
      }
      data.push(`" " + JSON.stringify(fn${functionId}_res.data[${JSON.stringify(functionResultName)}]) + " "`);
      i = end - 1;
    } else if (i in reqRemoteFunctions) {
      const [functionId, functionName, end] = reqRemoteFunctions[i];
      buffer += JSON.stringify(`/__mango__/call?fn=${functionId + functionName}`);
      i = end - 1;
    } else {
      buffer += content[i];
    }
  }
  if (buffer) {
    data.push(JSON.stringify(buffer));
  }
  return isDeep ? data : data.join("+");
}
