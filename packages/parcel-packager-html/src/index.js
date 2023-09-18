/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/packager-html
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert';
import { Readable } from 'stream';
import { Packager } from '@parcel/plugin';
import posthtml from 'posthtml';
import parcelUtils from "@parcel/utils";

const { bufferStream, replaceInlineReferences, replaceURLReferences, urlJoin, setDifference } = parcelUtils;

/** @typedef {import("posthtml").Node} PostHTMLNode */
/** @typedef {import("@parcel/types").Bundle} Bundle */
/** @typedef {import("@parcel/types").NamedBundle} NamedBundle */
/** @typedef {import("@parcel/types").BundleGraph<NamedBundle>} BundleGraph */

// https://www.w3.org/TR/html5/dom.html#metadata-content-2
const metadataContent = new Set([
  'base',
  'link',
  'meta',
  'noscript',
  // 'script', // retain script order (somewhat)
  'style',
  'template',
  'title',
]);

export default new Packager({
  async package({ bundle, bundleGraph, getInlineBundleContents }) {
    const assets = [];
    bundle.traverseAssets(asset => {
      assets.push(asset);
    });

    assert.equal(assets.length, 1, 'HTML bundles must only contain one asset');

    const asset = assets[0];
    const code = await asset.getCode();

    // Add bundles in the same bundle group that are not inline. For example, if two inline
    // bundles refer to the same library that is extracted into a shared bundle.
    const referencedBundles = [
      ...setDifference(
        new Set(bundleGraph.getReferencedBundles(bundle)),
        new Set(bundleGraph.getReferencedBundles(bundle, {recursive: false})),
      ),
    ];

    const { html } = await posthtml([
      tree => insertBundleReferences(referencedBundles, tree),
      tree => replaceInlineAssetContent(bundleGraph, getInlineBundleContents, tree),
    ]).process(code, {
      xmlMode: bundle.type === 'xhtml',
      closingSingleTag: bundle.type === 'xhtml' ? 'slash' : undefined,
    });

    const { contents, map } = replaceURLReferences({
      bundle,
      bundleGraph,
      contents: html,
      relative: false,
      getReplacement: (contents) =>
        contents.match(/\/pages\/page\.((?:HASH_REF_.{16})|(?:.{8}))\.js/)?.[1] ||
        contents.replace(/"/g, "&quot;"),
    });

    return replaceInlineReferences({
      bundle,
      bundleGraph,
      contents,
      getInlineBundleContents,
      getInlineReplacement: (dep, inlineType, contents) => ({
        from: dep.id,
        to: contents.replace(/"/g, '&quot;').trim(),
      }),
      map,
    });
  },
});

/**
 * @param {BundleGraph} bundleGraph
 * @param {(arg0: Bundle, arg1: BundleGraph<NamedBundle>) => Promise<{ contents: Blob; }>} getInlineBundleContents
 * @param {string} assetId
 * @returns {Promise<?{ bundle: Bundle; contents: string; }>}
 */
async function getAssetContent(bundleGraph, getInlineBundleContents, assetId) {
  /** @type {?Bundle} */
  let inlineBundle;
  bundleGraph.traverseBundles((bundle, context, {stop}) => {
    const entryAssets = bundle.getEntryAssets();
    if (entryAssets.some(a => a.uniqueKey === assetId)) {
      inlineBundle = bundle;
      stop();
    }
  });

  if (inlineBundle) {
    const bundleResult = await getInlineBundleContents(inlineBundle, bundleGraph);

    return { bundle: inlineBundle, contents: bundleResult.contents };
  }

  return null;
}

/**
 * @param {BundleGraph} bundleGraph
 * @param {(arg0: Bundle, arg1: BundleGraph<NamedBundle>) => Promise<{ contents: Blob; }>} getInlineBundleContents
 * @param {PostHTMLNode} tree
 * @returns {Promise<PostHTMLNode>}
 */
async function replaceInlineAssetContent(bundleGraph, getInlineBundleContents, tree) {
  const inlineNodes = [];
  tree.walk(node => {
    if (node.attrs && node.attrs['data-parcel-key']) {
      inlineNodes.push(node);
    }
    return node;
  });

  for (let node of inlineNodes) {
    const newContent = await getAssetContent(
      bundleGraph,
      getInlineBundleContents,
      node.attrs['data-parcel-key'],
    );

    if (newContent != null) {
      const { contents } = newContent;
      node.content = (
        contents instanceof Readable ? await bufferStream(contents) : contents
      ).toString();

      // Escape closing script tags and HTML comments in JS content.
      // https://www.w3.org/TR/html52/semantics-scripting.html#restrictions-for-contents-of-script-elements
      // Avoid replacing </script with <\/script as it would break the following valid JS: 0</script/ (i.e. regexp literal).
      // Instead, escape the s character.
      if (node.tag === 'script') {
        node.content = node.content
          .replace(/<!--/g, '<\\!--')
          .replace(/<\/(script)/gi, '</\\$1');
      }

      // Escape closing style tags in CSS content.
      if (node.tag === 'style') {
        node.content = node.content.replace(/<\/(style)/gi, '<\\/$1');
      }

      // remove attr from output
      delete node.attrs['data-parcel-key'];
    }
  }

  return tree;
}

function insertBundleReferences(siblingBundles, tree) {
  const bundles = [];

  for (const bundle of siblingBundles) {
    if (bundle.type === 'css') {
      bundles.push({
        tag: 'link',
        attrs: {
          rel: 'stylesheet',
          href: urlJoin(bundle.target.publicUrl, bundle.name),
        },
      });
    }
  }

  addBundlesToTree(bundles, tree);
}

function addBundlesToTree(bundles, tree) {
  const main = find(tree, 'head') || find(tree, 'html');
  const content = main ? main.content || (main.content = []) : tree;
  const index = findBundleInsertIndex(content);

  content.splice(index, 0, ...bundles);
}

function find(tree, tag) {
  let res;
  tree.match({tag}, node => {
    res = node;
    return node;
  });

  return res;
}

function findBundleInsertIndex(content) {
  // HTML document order (https://html.spec.whatwg.org/multipage/syntax.html#writing)
  //   - Any number of comments and ASCII whitespace.
  //   - A DOCTYPE.
  //   - Any number of comments and ASCII whitespace.
  //   - The document element, in the form of an html element.
  //   - Any number of comments and ASCII whitespace.
  //
  // -> Insert before first non-metadata (or script) element; if none was found, after the doctype

  let doctypeIndex;
  for (let index = 0; index < content.length; index++) {
    const node = content[index];
    if (node && node.tag && !metadataContent.has(node.tag)) {
      return index;
    }
    if (
      typeof node === 'string' &&
      node.toLowerCase().startsWith('<!doctype')
    ) {
      doctypeIndex = index;
    }
  }

  return doctypeIndex ? doctypeIndex + 1 : 0;
}

