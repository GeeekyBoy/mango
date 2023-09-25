/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import bcd from "@mdn/browser-compat-data/forLegacyNode";

/** @type { { [key: string]: string[] } } */
const element2Interface = {
  a: ["HTMLAnchorElement"],
  area: ["HTMLAreaElement"],
  audio: ["HTMLMediaElement", "HTMLAudioElement"],
  base: ["HTMLBaseElement"],
  body: ["HTMLBodyElement"],
  br: ["HTMLBRElement"],
  button: ["HTMLButtonElement"],
  canvas: ["HTMLCanvasElement"],
  data: ["HTMLDataElement"],
  datalist: ["HTMLDataListElement"],
  details: ["HTMLDetailsElement"],
  dialog: ["HTMLDialogElement"],
  dir: ["HTMLDirectoryElement"],
  div: ["HTMLDivElement"],
  dl: ["HTMLDListElement"],
  embed: ["HTMLEmbedElement"],
  fieldset: ["HTMLFieldSetElement"],
  form: ["HTMLFormElement"],
  hr: ["HTMLHRElement"],
  head: ["HTMLHeadElement"],
  h1: ["HTMLHeadingElement"],
  h2: ["HTMLHeadingElement"],
  h3: ["HTMLHeadingElement"],
  h4: ["HTMLHeadingElement"],
  h5: ["HTMLHeadingElement"],
  h6: ["HTMLHeadingElement"],
  html: ["HTMLHtmlElement"],
  iframe: ["HTMLIFrameElement"],
  img: ["HTMLImageElement"],
  input: ["HTMLInputElement"],
  label: ["HTMLLabelElement"],
  legend: ["HTMLLegendElement"],
  li: ["HTMLLIElement"],
  link: ["HTMLLinkElement"],
  map: ["HTMLMapElement"],
  media: ["HTMLMediaElement"],
  menu: ["HTMLMenuElement"],
  meta: ["HTMLMetaElement"],
  meter: ["HTMLMeterElement"],
  del: ["HTMLModElement"],
  ins: ["HTMLModElement"],
  object: ["HTMLObjectElement"],
  ol: ["HTMLOListElement"],
  optgroup: ["HTMLOptGroupElement"],
  option: ["HTMLOptionElement"],
  output: ["HTMLOutputElement"],
  p: ["HTMLParagraphElement"],
  picture: ["HTMLPictureElement"],
  pre: ["HTMLPreElement"],
  progress: ["HTMLProgressElement"],
  q: ["HTMLQuoteElement"],
  script: ["HTMLScriptElement"],
  select: ["HTMLSelectElement"],
  slot: ["HTMLSlotElement"],
  source: ["HTMLSourceElement"],
  span: ["HTMLSpanElement"],
  style: ["HTMLStyleElement"],
  caption: ["HTMLTableCaptionElement"],
  td: ["HTMLTableCellElement"],
  col: ["HTMLTableColElement"],
  table: ["HTMLTableElement"],
  tr: ["HTMLTableRowElement"],
  tbody: ["HTMLTableSectionElement"],
  template: ["HTMLTemplateElement"],
  textarea: ["HTMLTextAreaElement"],
  time: ["HTMLTimeElement"],
  title: ["HTMLTitleElement"],
  track: ["HTMLTrackElement"],
  ul: ["HTMLUListElement"],
  video: ["HTMLMediaElement", "HTMLVideoElement"],
  marquee: ["HTMLMarqueeElement"],
  font: ["HTMLFontElement"],
  frame: ["HTMLFrameElement"],
  frameset: ["HTMLFrameSetElement"],
  isindex: ["HTMLIsIndexElement"],
  menuitem: ["HTMLMenuItemElement"],
};

/**
 * @param {string} str
 * @returns {string}
 */
const dashed2CamelCase = (str) => str.replace(/-([a-z])/g, (m, w) => w.toUpperCase());

/**
 * @param {{ [key: string]: any }} data
 * @returns {{ [key: string]: string }}
 */
const makeNorm2Std = (data, camelCaseStd = false) =>
  Object.fromEntries(
    Object.keys(data)
      .filter((x) => !x.startsWith("_"))
      .map((x) => [
        x.replace(x.endsWith("_event") ? /-/g : /-|(_.*$)/g, "").toLowerCase(),
        camelCaseStd ? dashed2CamelCase(x) : x
      ])
  );

/**
 * @param {{ [key: string]: string }} props
 * @returns {{ [key: string]: string }}
 */
const extractEvents = (props) => {
  /** @type { { [key: string]: string } } */
  const events = {
    oncreate: "oncreate",
    ondestroy: "ondestroy",
  };
  for (const prop in props) {
    if (prop.endsWith("_event")) {
      const eventProp = "on" + prop.slice(0, -6);
      events[eventProp] = eventProp;
      delete props[prop];
    }
  }
  return events;
}

/**
 * @param {{ [key: string]: string }} attrs
 * @param {{ [key: string]: string }} props
 */
const intersectAttrsProps = (attrs, props) => {
  for (const prop in props) {
    if (prop in attrs) {
      delete attrs[prop];
    } else {
      delete props[prop];
    }
  }
};

const globalHtmlAttrs = makeNorm2Std(bcd.html.global_attributes);

const globalProps = makeNorm2Std(bcd.api.Element);

const globalEvents = extractEvents(globalProps);

const globalHtmlProps = makeNorm2Std(bcd.api.HTMLElement);

const globalHtmlEvents = extractEvents(globalHtmlProps);

globalProps.class = "className";

intersectAttrsProps(globalHtmlAttrs, globalProps);

intersectAttrsProps(globalHtmlAttrs, globalHtmlProps);

globalProps.classname = "className";
globalProps.innerhtml = "innerHTML";

/** @type {{ [key: string]: { attrs: { [key: string]: string }, props: { [key: string]: string }, events: { [key: string]: string } } }} */
const htmlElements = {};

for (const element in bcd.html.elements) {
  const attrs = makeNorm2Std(bcd.html.elements[element]);
  /** @type { { [key: string]: string } } */
  let props = {};
  /** @type { { [key: string]: string } } */
  let events = {};
  if (element in element2Interface) {
    const interfaces = element2Interface[element];
    for (const iface of interfaces) {
      props = { ...props, ...makeNorm2Std(bcd.api[iface]) };
      events = { ...events, ...extractEvents(bcd.api[iface]) };
    }
  }
  if (element === "label") props.for = "htmlFor";
  intersectAttrsProps(attrs, props);
  if (element === "label") props.htmlfor = "htmlFor";
  if (element === "input") props.value = "value";
  htmlElements[element] = { attrs, props, events };
}

/**  @type {{ [key: string]: { attrs: { [key: string]: string } } }} */
const svgElements = {};

for (const element in bcd.svg.elements) {
  const attrs = makeNorm2Std(bcd.svg.elements[element]);
  svgElements[element] = { attrs };
}

/**  @type {{ [key: string]: { attrs: { [key: string]: string } } }} */
const mathElements = {};

for (const element in bcd.mathml.elements) {
  const attrs = makeNorm2Std(bcd.mathml.elements[element]);
  mathElements[element] = { attrs };
}

const cssProps = makeNorm2Std(bcd.css.properties, true);
delete cssProps.alt;

/**
 * @param {string} tagName
 * @returns {0 | 1 | 2}
 */
const getNamespace = (tagName) => {
  if (tagName in svgElements) {
    return 1;
  } else if (tagName in mathElements) {
    return 2;
  } else {
    return 0;
  }
}

/**
 * @param {string} tagName
 * @param {0 | 1 | 2} namespace
 * @param {string} attrName
 * @returns {[string, "style" | "event" | "prop" | "attr" | "unknown"]}
 */
const getStdAttr = (tagName, namespace, attrName) => {
  const normAttrName = attrName.replace(/-/g, "").toLowerCase();
  if (tagName === "meta" && normAttrName === "content") {
    return ["content", "prop"];
  } else if (normAttrName in cssProps) {
    return [cssProps[normAttrName], "style"];
  } else if (namespace === 0) {
    if (normAttrName in globalEvents) {
      return [globalEvents[normAttrName], "event"];
    } else if (normAttrName in globalHtmlEvents) {
      return [globalHtmlEvents[normAttrName], "event"];
    } else if (normAttrName in globalProps) {
      return [globalProps[normAttrName], "prop"];
    } else if (normAttrName in globalHtmlProps) {
      return [globalHtmlProps[normAttrName], "prop"];
    } else if (normAttrName in htmlElements[tagName].props) {
      return [htmlElements[tagName].props[normAttrName], "prop"];
    } else if (normAttrName in globalHtmlAttrs) {
      return [globalHtmlAttrs[normAttrName], "attr"];
    } else if (normAttrName in htmlElements[tagName].attrs) {
      return [htmlElements[tagName].attrs[normAttrName], "attr"];
    } else if (normAttrName in htmlElements[tagName].events) {
      return [htmlElements[tagName].events[normAttrName], "event"];
    }
  } else if (namespace === 1) {
    if (normAttrName in globalEvents) {
      return [globalEvents[normAttrName], "event"];
    } else if (normAttrName === "class" || normAttrName === "classname") {
      return ["class", "attr"];
    } else if (normAttrName in globalProps) {
      return [globalProps[normAttrName], "prop"];
    } else if (normAttrName in svgElements[tagName].attrs) {
      return [svgElements[tagName].attrs[normAttrName], "attr"];
    }
  } else if (namespace === 2) {
    if (normAttrName in globalEvents) {
      return [globalEvents[normAttrName], "event"];
    } else if (normAttrName in globalProps) {
      return [globalProps[normAttrName], "prop"];
    } else if (normAttrName in mathElements[tagName].attrs) {
      return [mathElements[tagName].attrs[normAttrName], "attr"];
    }
  }
  return [attrName, "unknown"];
}

export { getNamespace, getStdAttr };
