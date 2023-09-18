/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import icuParser from "@formatjs/icu-messageformat-parser";

/**
 * @param {string} content
 * @param {{ [key: string]: [string, { [key: string]: [number, number] }, number] }} reqTranslations
 * @param {{ [key: string]: icuParser.MessageFormatElement[] }} translations
 * @param {{ [key: string]: [string, string, number] }} reqRemoteFunctions
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
export default function preprocessStaticContent(content, reqTranslations, translations, reqRemoteFunctions = {}, start = 0, end = content.length) {
  let result = "";
  for (let i = start; i < end; i++) {
    if (i in reqTranslations) {
      const [translationId, params, children, end] = reqTranslations[i];
      const translationAST = translations[translationId];
      if (translationAST) {
        const preprocessedPrams = {};
        const preprocessedChildren = [];
        const compiledTranslation = [];
        let childIndexCaptured = false;
        for (const param in params) {
          const [paramStart, paramEnd] = params[param];
          preprocessedPrams[param] = preprocessStaticContent(content, reqTranslations, translations, reqRemoteFunctions, paramStart, paramEnd);
        }
        for (const child of children) {
          const [childStart, childEnd] = child;
          preprocessedChildren.push(preprocessStaticContent(content, reqTranslations, translations, reqRemoteFunctions, childStart, childEnd));
        }
        for (const node of translationAST) {
          if (node.type === icuParser.TYPE.literal) {
            compiledTranslation.push(JSON.stringify(node.value));
          } else if (node.type === icuParser.TYPE.argument) {
            const varName = node.value;
            if (isNaN(varName)) {
              compiledTranslation.push(preprocessedPrams[varName]);
            } else {
              if (!childIndexCaptured) {
                result += "[";
              }
              if (compiledTranslation.length) {
                result += compiledTranslation.join("+") + ",";
                compiledTranslation.length = 0;
              }
              if (varName in children) {
                result += preprocessedChildren[varName];
              } else {
                result += "undefined";
              }
              if (node !== translationAST[translationAST.length - 1]) {
                result += ",";
              }
              childIndexCaptured = true;
            }
          }
        }
        if (compiledTranslation.length) {
          result += compiledTranslation.join("+");
        }
        if (childIndexCaptured) {
          result += "]";
        }
      } else {
        result += JSON.stringify(translationId);
      }
      i = end - 1;
    } else if (i in reqRemoteFunctions) {
      const [functionId, functionName, end] = reqRemoteFunctions[i];
      data += JSON.stringify(`/__mango__/call?fn=${functionId + functionName}`);
      i = end - 1;
    } else {
      result += content[i];
    }
  }
  return result;
};
