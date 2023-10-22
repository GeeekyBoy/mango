/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/transformer-html
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { hashString } from '@parcel/rust';
import PostHTML from "posthtml";

/** @typedef {import("posthtml").Node} PostHTMLNode */
/** @typedef {import("@parcel/types").AST} AST */
/** @typedef {import("@parcel/types").MutableAsset} MutableAsset */
/** @typedef {import("@parcel/types").TransformerResult} TransformerResult */

const SCRIPT_TYPES = {
  "application/javascript": "js",
  "text/javascript": "js",
  "application/json": false,
  "application/ld+json": "jsonld",
  "text/html": false,
  module: "js",
};

/**
 * @param {MutableAsset} asset
 * @param {AST} ast
 * @returns {{ assets: Array<TransformerResult> }}
 */
export default function extractInlineAssets(asset, ast) {
  /** @type {PostHTMLNode} */
  const program = ast.program;
  let key = 0;

  // Extract inline <script> and <style> tags for processing.
  /** @type {Array<TransformerResult>} */
  const parts = [];
  PostHTML().walk.call(program, /** @type {(node: PostHTMLNode) => PostHTMLNode} */ (node) => {
    const parcelKey = hashString(`${asset.id}:${key++}`);
    if (node.tag === "script" || node.tag === "style") {
      const value = node.content && node.content.join("");
      if (value != null) {
        let type, env;

        if (node.tag === "style") {
          if (node.attrs && node.attrs.type != null) {
            type = node.attrs.type.split("/")[1];
          } else {
            type = "css";
          }
        } else if (node.attrs && node.attrs.type != null) {
          // Skip JSON
          if (SCRIPT_TYPES[node.attrs.type] === false) {
            return node;
          }

          if (SCRIPT_TYPES[node.attrs.type]) {
            type = SCRIPT_TYPES[node.attrs.type];
          } else {
            type = node.attrs.type.split("/")[1];
          }

          const attrs = node.attrs;
          const sourceType = attrs.type === "module" ? "module" : "script";

          if (sourceType === "module") {
            delete attrs.type;
          }

          const loc = node.location ? {
            filePath: asset.filePath,
            start: node.location.start,
            end: node.location.end,
          } : undefined;

          env = {
            sourceType,
            outputFormat: "global",
            loc,
          };
        } else {
          const loc = node.location ? {
            filePath: asset.filePath,
            start: node.location.start,
            end: node.location.end,
          } : undefined;

          type = "js";
          env = {
            sourceType: "script",
            loc,
          };
        }

        if (!type) {
          return node;
        }

        if (!node.attrs) {
          node.attrs = {};
        }

        // allow a script/style tag to declare its key
        if (node.attrs["data-parcel-key"]) {
          parcelKey = node.attrs["data-parcel-key"];
        }

        // Inform packager to remove type, since CSS and JS are the defaults.
        if (node.attrs?.type && node.tag === "style") {
          delete node.attrs.type;
        }

        // insert parcelId to allow us to retrieve node during packaging
        node.attrs["data-parcel-key"] = parcelKey;
        asset.setAST(ast); // mark dirty

        asset.addDependency({
          specifier: parcelKey,
          specifierType: "esm",
        });

        parts.push({
          type,
          content: value,
          uniqueKey: parcelKey,
          bundleBehavior: "inline",
          env,
          meta: {
            type: "tag",
            node,
            startLine: node.location?.start.line,
          },
        });
      }
    }

    // Process inline style attributes.
    const attrs = node.attrs;
    const style = attrs?.style;
    if (attrs != null && style != null) {
      attrs.style = asset.addDependency({
        specifier: parcelKey,
        specifierType: "esm",
      });
      asset.setAST(ast); // mark dirty

      parts.push({
        type: "css",
        content: style,
        uniqueKey: parcelKey,
        bundleBehavior: "inline",
        meta: {
          type: "attr",
          node,
        },
      });
    }

    return node;
  });

  return { assets: parts };
}
