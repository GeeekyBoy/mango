/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/transformer-html
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transformer } from "@parcel/plugin";
import { parser as parse } from "posthtml-parser";
import nullthrows from "nullthrows";
import { render } from "posthtml-render";
import semver from "semver";
import parcelDiagnostic from "@parcel/diagnostic";
import collectDependencies from "./dependencies.js";
import extractInlineAssets from "./inline.js";
import injectRoutes from "./routes.js";

const { default: ThrowableDiagnostic } = parcelDiagnostic;

/** @typedef {import("posthtml").Node} PostHTMLNode */
/** @typedef {import("posthtml").Expression} PostHTMLExpression */
/** @typedef {import("@parcel/types").AST} AST */
/** @typedef {import("@parcel/types").MutableAsset} MutableAsset */
/** @typedef {import("@parcel/types").TransformerResult} TransformerResult */

export default new Transformer({
  canReuseAST({ ast }) {
    return ast.type === "posthtml" && semver.satisfies(ast.version, "^0.4.0");
  },

  async parse({ asset }) {
    return {
      type: "posthtml",
      version: "0.4.1",
      program: parse(await asset.getCode(), {
        lowerCaseTags: true,
        lowerCaseAttributeNames: true,
        sourceLocations: true,
        xmlMode: asset.type === "xhtml",
      }),
    };
  },

  async transform({ asset, options }) {
    asset.type = "html";
    asset.bundleBehavior = "isolated";

    const ast = nullthrows(await asset.getAST());

    await injectRoutes(asset, ast, options);
    try {
      collectDependencies(asset, ast);
    } catch (errors) {
      if (Array.isArray(errors)) {
        throw new ThrowableDiagnostic({
          diagnostic: errors.map(error => ({
            message: error.message,
            origin: "@parcel/transformer-html",
            codeFrames: [
              {
                filePath: error.filePath,
                language: "html",
                codeHighlights: [error.loc],
              },
            ],
          })),
        });
      }
      throw errors;
    }

    const { assets: inlineAssets } = extractInlineAssets(asset, ast);

    const result = [asset, ...inlineAssets];

    return result;
  },

  generate({ast, asset}) {
    return {
      content: render(ast.program, {
        closingSingleTag: asset.type === "xhtml" ? "slash" : undefined,
      }),
    };
  },
});
