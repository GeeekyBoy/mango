/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/transformer-html
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PostHTML from "posthtml";
import { parseSrcset, stringifySrcset } from "srcset";

/** @typedef {import("posthtml").Node} PostHTMLNode */
/** @typedef {import("posthtml").Node<Location>} PostHTMLLocationNode */
/** @typedef {import("@parcel/types").AST} AST */
/** @typedef {import("@parcel/types").MutableAsset} MutableAsset */
/** @typedef {import("@parcel/types").FilePath} FilePath */

// A list of all attributes that may produce a dependency
// Based on https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
const ATTRS = {
  src: [
    "script",
    "img",
    "audio",
    "video",
    "source",
    "track",
    "iframe",
    "embed",
    "amp-img",
  ],
  // Using href with <script> is described here: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/script
  href: ["link", "a", "use", "script", "image"],
  srcset: ["img", "source"],
  imagesrcset: ["link"],
  poster: ["video"],
  "xlink:href": ["use", "image", "script"],
  content: ["meta"],
  data: ["object"],
};

// A list of metadata that should produce a dependency
// Based on:
// - http://schema.org/
// - http://ogp.me
// - https://developer.twitter.com/en/docs/tweets/optimize-with-cards/overview/markup
// - https://msdn.microsoft.com/en-us/library/dn255024.aspx
// - https://vk.com/dev/publications
const META = {
  property: [
    "og:image",
    "og:image:url",
    "og:image:secure_url",
    "og:audio",
    "og:audio:secure_url",
    "og:video",
    "og:video:secure_url",
    "vk:image",
  ],
  name: [
    "twitter:image",
    "msapplication-square150x150logo",
    "msapplication-square310x310logo",
    "msapplication-square70x70logo",
    "msapplication-wide310x150logo",
    "msapplication-TileImage",
    "msapplication-config",
  ],
  itemprop: [
    "image",
    "logo",
    "screenshot",
    "thumbnailUrl",
    "contentUrl",
    "downloadUrl",
  ],
};

const FEED_TYPES = new Set(["application/rss+xml", "application/atom+xml"]);

// Options to be passed to `addDependency` for certain tags + attributes
const OPTIONS = {
  a: {
    href: { needsStableName: true },
  },
  iframe: {
    src: { needsStableName: true },
  },
  link(attrs) {
    if (attrs.rel === "stylesheet") {
      return {
        // Keep in the same bundle group as the HTML.
        priority: "parallel",
        pipeline: "htmlStyleSheet",
      };
    }
  },
};

function collectSrcSetDependencies(asset, srcset, opts) {
  const parsed = parseSrcset(srcset).map(({ url, ...v }) => ({
    url:
      url.substring(0, 7) !== "ignore:"
        ? asset.addURLDependency(url, opts)
        : url,
    ...v,
  }));
  return stringifySrcset(parsed);
}

function getAttrDepHandler(attr) {
  if (attr === "srcset" || attr === "imagesrcset") {
    return collectSrcSetDependencies;
  }

  return (asset, src, opts) =>
    src.substring(0, 7) !== "ignore:" ? asset.addURLDependency(src, opts) : src;
}

/**
 * @param {MutableAsset} asset
 * @param {AST} ast
 */
export default function collectDependencies(asset, ast) {
  let isDirty = false;
  const seen = new Set();
  /** @type {Array<{ message: string, filePath: FilePath, loc: PostHTMLLocationNode }>} */
  const errors = [];
  PostHTML().walk.call(ast.program, /** @type {(node: PostHTMLNode) => PostHTMLNode} */ (node) => {
    const { tag, attrs } = node;
    if (!attrs || seen.has(node)) {
      return node;
    }

    seen.add(node);

    if (tag === "meta") {
      const isMetaDependency = Object.keys(attrs).some(attr => {
        const values = META[attr];
        return (
          values &&
          values.includes(attrs[attr]) &&
          attrs.content !== "" &&
          attrs.content.substring(0, 7) !== "ignore:" &&
          !(attrs.name === "msapplication-config" && attrs.content === "none")
        );
      });
      if (isMetaDependency) {
        const metaAssetUrl = attrs.content;
        if (metaAssetUrl) {
          attrs.content = asset.addURLDependency(attrs.content, {
            needsStableName: !(
              attrs.name && attrs.name.includes("msapplication")
            ),
          });
          isDirty = true;
          asset.setAST(ast);
        }
      }
      return node;
    }

    if (
      tag === "link" &&
      (attrs.rel === "canonical" ||
        attrs.rel === "manifest" ||
        (attrs.rel === "alternate" && FEED_TYPES.has(attrs.type))) &&
      attrs.href &&
      attrs.href.substring(0, 7) !== "ignore:"
    ) {
      let href = attrs.href;
      if (attrs.rel === "manifest") {
        // A hack to allow manifest.json rather than manifest.webmanifest.
        // If a custom pipeline is used, it is responsible for running @parcel/transformer-webmanifest.
        if (!href.includes(":")) {
          href = "webmanifest:" + href;
        }
      }

      attrs.href = asset.addURLDependency(href, {
        needsStableName: true,
      });
      isDirty = true;
      asset.setAST(ast);
      return node;
    }

    if (tag === "script" && attrs.src && attrs.src.substring(0, 7) !== "ignore:") {
      const sourceType = attrs.type === "module" ? "module" : "script";
      const loc = node.location
        ? {
            filePath: asset.filePath,
            start: node.location.start,
            end: {
              line: node.location.end.line,
              // PostHTML's location is inclusive
              column: node.location.end.column + 1,
            },
          }
        : undefined;

      if (sourceType === "module") {
        delete attrs.type;
      }

      attrs.src = asset.addURLDependency(attrs.src, {
        // Keep in the same bundle group as the HTML.
        priority: "parallel",
        // If the script is async it can be executed in any order, so it cannot depend
        // on any sibling scripts for dependencies. Keep all dependencies together.
        // Also, don't share dependencies between classic scripts and nomodule scripts
        // because nomodule scripts won't run when modules are supported.
        bundleBehavior:
          sourceType === "script" || attrs.async != null
            ? "isolated"
            : undefined,
        env: {
          sourceType,
          outputFormat: "global",
          loc,
        },
      });

      asset.setAST(ast);
      return node;
    }

    for (const attr in attrs) {
      // Check for virtual paths
      if (tag === "a" && attrs[attr].split("#")[0].lastIndexOf(".") < 1) {
        continue;
      }

      // Check for id references
      if (attrs[attr][0] === "#") {
        continue;
      }

      const elements = ATTRS[attr];
      if (elements && elements.includes(node.tag)) {
        // Check for empty string
        if (attrs[attr].length === 0) {
          errors.push({
            message: `"${attr}" should not be empty string`,
            filePath: asset.filePath,
            loc: node.location,
          });
        }

        const depHandler = getAttrDepHandler(attr);
        const depOptionsHandler = OPTIONS[node.tag];
        const depOptions =
          typeof depOptionsHandler === "function"
            ? depOptionsHandler(attrs, asset.env)
            : depOptionsHandler && depOptionsHandler[attr];
        attrs[attr] = depHandler(asset, attrs[attr], depOptions);
        isDirty = true;
      }
    }

    if (isDirty) {
      asset.setAST(ast);
    }

    return node;
  });

  if (errors.length > 0) {
    throw errors;
  }
}
