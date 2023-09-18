/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Value currently held by a state.
 * @typedef {any} StateValue
 */

/**
 * Subscription data of a state which are stored like this:
 *
 * [node, mutator, mutator, node, mutator, null, genericFunction, ...]
 *
 * where node is the node to which the state is bound,
 * mutator is a function that mutates the first node preceding it,
 * and genericFunction is a function that is called when the state changes
 * but does not directly assigned to a node.
 * @typedef {(?MangoNode | Function)[]} StateSubscribers
 */

/**
 * An Observed variable that notifies its subscribers when it changes.
 * @typedef {[StateValue, ...StateSubscribers]} State
 */

/**
 * Function that mutates a node.
 * @typedef {(node: MangoNode) => void} NodeMutator
 */

/**
 * Children of an element node.
 * @typedef {(string | MangoNode | null | false | undefined | Children)[]} Children
 */

/**
 * Array containing the property setter and states it depends on.
 * @typedef {[NodeMutator, ...State[]]} ElementProp
 */

/**
 * Function that creates HTML node for a single item in a list view.
 * @typedef {(state: State, index: number) => (MangoNode | Children)} ItemNodeCreator
 */

/**
 * Function that initializes a given custom component.
 * @typedef {(component: (props: {}) => MangoNode) => MangoNode} ComponentInitializer
 */

/**
 * Shallowly observed array to be used in list views like tables.
 * @typedef {[State[], (MarkerNode | ItemNodeCreator)[]]} StatefulArray
 */

/**
 * An array holding a node creator and a predicate that determines whether
 * the node creator should be used by the switch to create a node.
 * @typedef {(() => (boolean | MangoNode))[]} ConditionsData
 */

/**
 * Special node that is used to mark the end of a region within the DOM.
 * A pointer to the node that marks the start of the region is stored in the marker's $sc property.
 * @typedef {Comment & { $sc: MarkerNode }} MarkerNodeTerminal
 */

/**
 * Special node that is used to mark the beginning of a region within the DOM.
 * A pointer to the node that marks the end of the region is stored in the marker's $ec property.
 * If the region is a dynamic view, $dv property holds a function that creates the dynamic view content.
 * @typedef {Comment & { $bs?: State[], $dv?: () => any, $ec: MarkerNodeTerminal }} MarkerNode
 */

/**
 * Special node that is used to teleport a node to a different location in the DOM.
 * @typedef {Comment & { $d: MangoNode }} TeleporterNode
 */

/**
 * A reference to track an effect and includes its dependencies.
 * @typedef {State[]} Effect
 */

/**
 * Extended version for Node that has additional properties used internally by Mango.
 * There are 3 possible internal properties:
 * $c - Function invoked when the node is removed from the DOM.
 * $bs - Array of states the node is subscribed to.
 * $sc - Pointer to the node that marks the start of the region. Used only for marker node terminals.
 * $ec - Pointer to the node that marks the end of the region. Used only for marker nodes.
 * $dv - Function that creates the dynamic view content. Used only for marker nodes.
 * $d - Pointer to the node that the teleporter node is teleporting. Used only for teleporter nodes.
 * $ru - Name of recently updated property via two-way binding when the update was triggered by the element.
 * @typedef {Node & {
 *  $c?: Function,
 *  $bs?: State[],
 *  $sc?: MarkerNode,
 *  $ec?: MarkerNodeTerminal,
 *  $dv?: () => any,
 *  $d?: MangoNode,
 *  $ru?: null | string
 * }} MangoNode
 */

(function () {

if (!document.createComment) {
  // @ts-ignore
  document.createComment = function () {
    return document.createElement("div")
  };
}

/** @type {(number | State)[]} */
var statesNeedingSubscriber = [];

/**
 * Unsubscribes node and all of its children
 * from all states they are subscribed to,
 * and does any other necessary cleaning stuff.
 * @param {MangoNode} node - Node to clean up.
 * @param {boolean} [selfCalled] - Whether the function was called recursively.
 * @returns {MangoNode} Cleaned up node.
 */
 function cleanUpNode(node, selfCalled) {
  if (node.$sc) return cleanUpNode(node.$sc);
  if (node.$d) return cleanUpNode(node.$d, selfCalled);
  if (node.$c) node.$c(node);
  if (node.$bs) {
    for (var i = 0; i < node.$bs.length; i++) {
      unsubscribe(node.$bs[i], node);
    }
  }
  if (node.$ec) {
    if (!selfCalled) {
      emptyElement(node);
      node.parentNode.removeChild(node.$ec);
    }
  } else {
    var elem = node.firstChild;
    if (elem) do cleanUpNode(elem, true);
    while (elem = elem.nextSibling);
  }
  return node;
}

/**
 * Creates a new state with an initial value and optional dependencies.
 * @param {StateValue} value - Initial value of the state being created.
 * @param {State[]} [deps] - States that the new state depends on.
 * @returns {State} Newly created state.
 */
function createState(value, deps) {
  if (deps) {
    /** @type {State} */
    var state = [value()];
    var consumer = function() { setState(state, value()); }
    for (var i = 0; i < deps.length; i++) {
      attachSubscriberPlaceholder(deps[i]);
      attachConsumer(deps[i], consumer);
    }
    return state;
  }
  return [value];
}

/**
 * Binds a state to a node.
 * @param {State} state - State to be bound to the node.
 * @param {MangoNode|Effect|null} subscriber - Node or effect to subscribe to the state.
 */
function attachSubscriber(state, subscriber) {
  state.push(subscriber);
}

/**
 * Binds a state to a node once available.
 * @param {State} state - State to be bound to a node once available.
 */
function attachSubscriberPlaceholder(state) {
  for (var i = 1; i < statesNeedingSubscriber.length; i += 2) {
    if (statesNeedingSubscriber[i] === state) {
      return;
    }
  }
  statesNeedingSubscriber.push(state.push(null) - 1, state);
}

/**
 * Binds all states waiting for a subscriber to a node.
 * @param {MangoNode} node - Node whose mutatators will be attached to the state.
 * @param {State[]} boundStates - Array to track states bound to the passed node.
 */
function attachMissingSubscriber(node, boundStates) {
  while (statesNeedingSubscriber.length) {
    boundStates.push(/** @type {State} */ (statesNeedingSubscriber.pop()));
    boundStates[boundStates.length - 1][/** @type {number} */ (statesNeedingSubscriber.pop())] = node;
  }
}

/**
 * Attaches a consumer to a state, so that it is invoked every time the state changes.
 * @param {State} state - State whose value is consumed by the consumer.
 * @param {Function} consumer - Function consuming the state's value.
 */
function attachConsumer(state, consumer) {
  state.push(consumer);
}

/**
 * Unbinds a state from a node and removes every mutator of that node
 * from the state subscription data.
 * @param {State} state - State to be unbound from the node.
 * @param {MangoNode|Effect} subscriber - Node or effect to unsubscribe from the state.
 */
function unsubscribe(state, subscriber) {
  for (var i = 1; i < state.length; i++) {
    if (state[i] === subscriber) {
      var j = 1;
      while (typeof state[i + j] === 'function') j++;
      state.splice(i, j);
      break;
    }
  }
}

/**
 * Retrieves value currently held by a state.
 * @param {State} [state] - State whose value to be retrieved.
 * @returns {StateValue} Current value of the state.
 */
function getState(state) {
  return state ? state[0] : undefined;
}

/**
 * Updates value of a state.
 * @param {State} state - State whose value to be set.
 * @param {StateValue} value - New value of the state.
 * @param {MangoNode} [binder] - Node that triggered the state update.
 * @returns {StateValue} Newly set value.
 */
function setState(state, value, binder) {
  if (state[0] !== value) {
    state[0] = value;
    state = /** @type {State} */ (state.slice());
    var i = 1;
    while (i < state.length) {
      var j = 1;
      while (typeof state[i + j] === 'function') {
        /** @type {Function} */ (state[i + j])(state[i]);
        j++;
      }
      i += j;
    }
  } else if (binder) {
    binder.$ru = null;
  }
  return value;
}

/**
 * Append properties to an element.
 * @param {MangoNode} node - Node of the element to be updated.
 * @param {ElementProp[]} props - Element properties data.
 * @returns {MangoNode} Node of the updated element.
 */
function appendPropsToElement(node, props) {
  var boundStates = node.$bs || [];
  if (!boundStates.length) {
    attachMissingSubscriber(node, boundStates);
  }
  for (var i = 0; i < props.length; i++) {
    for (var j = 1; j < props[i].length; j++) {
      if (props[i][j]) {
        var stateRegistered = false;
        for (var k = 0; k < boundStates.length; k++) {
          if (boundStates[k] === props[i][j]) {
            stateRegistered = true;
            break;
          }
        }
        if (!stateRegistered) {
          boundStates.push(/** @type {State} */ (props[i][j]));
          attachSubscriber(/** @type {State} */ (props[i][j]), node);
        }
        attachConsumer(/** @type {State} */ (props[i][j]), props[i][0]);
      }
    }
    props[i][0](node);
  }
  if (boundStates.length) {
    node.$bs = boundStates;
  }
  return node;
}

/**
 * Append children to an element.
 * @param {MangoNode} node - Node of the element to which children will be appended.
 * @param {Children} children - Element children, either nodes or strings.
 */
function appendChildrenToElement(node, children) {
  for (var i = 0; i < children.length; i++) {
    if (children[i] !== null && children[i] !== undefined && children[i] !== false) {
      // @ts-ignore
      if (children[i].nodeType) {
        appendToElement(node, /** @type {MangoNode} */ (children[i]));
      // @ts-ignore
      } else if (children[i].push) {
        appendChildrenToElement(node, /** @type {Children} */ (children[i]));
      } else {
        appendToElement(node, document.createTextNode(/** @type {string} */ (children[i])));
      }
    }
  }
}

/**
 * Appends children elements to head element.
 * @param {Children} children - Element children, either nodes or strings.
 * @returns {MangoNode} Teleporter node pointing to the marked region where children were appended to head.
 */
function createHeadElement(children) {
  var head = document.getElementsByTagName("head")[0];
  var markerNode = createMarkerNode();
  appendToElement(head, markerNode);
  appendChildrenToElement(head, children);
  appendToElement(head, markerNode.$ec);
  return createTeleporterNode(markerNode);
}

/**
 * Creates a new HTML node with the given data.
 * @param {string} tag - Valid HTML tag name or 'text' for creating text node.
 * @param {ElementProp[]} [props] - Element properties data.
 * @param {Children|(() => any)} [children] - Element children, either nodes or strings.
 * @param {number} [ns] - Namespace of the element.
 * @returns {MangoNode} Node of the newly created element.
 */
function createElement(tag, props, children, ns) {
  /** @type {MangoNode} */
  var node = ns && document.createElementNS
    ? document.createElementNS(ns === 1 ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1998/Math/MathML", tag)
    : document.createElement(tag);
  if (typeof children === 'function') {
    var dynamicData = /** @type {[() => any, [State]]} */ (children());
    appendChildrenToElement(node, [dynamicData[0]()]);
    node.$dv = dynamicData[0];
    subscribeToDynamicViewDeps(node, dynamicData[1]);
  } else if (children) {
    appendChildrenToElement(node, children);
  }
  if (props) appendPropsToElement(node, props);
  return node;
}

/**
 * Create a new teleporter node used as a pointer to another node.
 * @param {MangoNode} dest - Node to be teleported to.
 * @returns {TeleporterNode} Teleporter node.
 */
function createTeleporterNode(dest) {
  /** @type {TeleporterNode} */
  // @ts-ignore
  var teleporterNode = document.createComment("");
  teleporterNode.$d = dest;
  return teleporterNode;
}

/**
 * Creates a new marker node to be used for marking regions within the DOM.
 * @returns {MarkerNode} Marker node.
 */
function createMarkerNode() {
  /** @type {MarkerNode} */
  // @ts-ignore
  var markerNode = document.createComment('');
  // @ts-ignore
  markerNode.$ec = document.createComment('');
  markerNode.$ec.$sc = markerNode;
  return markerNode;
}

/**
 * Appends a node to a region marked by a marker node or as a last child of a parent node.
 * @param {MangoNode} parent - Node marking the region to be appended to or a parent node to which the node will be appended.
 * @param {MangoNode} node - Node to be appended.
 */
function appendToElement(parent, node) {
  if (parent.$ec) {
    parent.parentNode.insertBefore(node, parent.$ec);
  } else {
    parent.appendChild(node);
  }
}

/**
 * Empties a node of all its children.
 * @param {MangoNode} node - Node to be emptied.
 */
function emptyElement(node) {
  if (node.$ec) {
    while (node.nextSibling !== node.$ec) {
      node.parentNode.removeChild(cleanUpNode(node.nextSibling));
    }
  } else {
    while (node.lastChild) {
      node.removeChild(cleanUpNode(node.lastChild));
    }
  }
}

/**
 * Creates a new list view controlled by a stateful array.
 * @param {StatefulArray} statefulArray - Stateful array to be used as a data source.
 * @param {ItemNodeCreator} itemNodeCreator - HTML node creator for a single item.
 * @returns {Children} Initial contents of the list view.
 */
function createListView(statefulArray, itemNodeCreator) {
  var markerNode = createMarkerNode();
  /** @type {Children} */
  var children = [markerNode];
  statefulArray[1].push(markerNode, itemNodeCreator);
  for (var i = 0; i < statefulArray[0].length; i++) {
    var itemNode = itemNodeCreator(statefulArray[0][i], i);
    children.push(itemNode);
  }
  children.push(markerNode.$ec);
  return children;
}

/**
 * Subscribes a node to deps of a dynamic view.
 * @param {MangoNode} node - Node to which the dynamic view is assigned.
 * @param {State[]} deps - Dependencies of the dynamic view.
 */
function subscribeToDynamicViewDeps(node, deps) {
  if (deps) {
    for (var i = 0; i < deps.length; i++) {
      node.$bs = [];
      if (deps[i]) {
        attachSubscriber(deps[i], node);
        attachConsumer(deps[i], updateDynamicView);
        node.$bs.push(deps[i]);
      }
    }
  }
}

/**
 * Updates the contents of a dynamic view assigned to the given node.
 * @param {MangoNode} node - Node to which the dynamic view is assigned.
 */
function updateDynamicView(node) {
  var newElement = node.$dv();
  if (newElement === null || newElement === undefined || newElement === false) {
    emptyElement(node);
  } else if (newElement.push) {
    emptyElement(node);
    appendChildrenToElement(node, newElement);
  } else if (newElement.nodeType) {
    emptyElement(node);
    appendToElement(node, newElement);
  } else if (node.$ec && node.nextSibling.nodeType === 3 && node.nextSibling.nextSibling === node.$ec) {
    node.nextSibling.nodeValue = newElement;
  } else if (!node.$ec && node.firstChild && node.firstChild.nodeType === 3 && !node.firstChild.nextSibling) {
    node.firstChild.nodeValue = newElement;
  } else {
    emptyElement(node);
    appendToElement(node, document.createTextNode(newElement));
  }
}

/**
 * Creates a new switch view that rechecks the condition every time the value
 * of one of its dependencies changes.
 * @param {() => any} elementCreator - Stateful array to be used as a data source.
 * @param {State[]} deps - States whose changes will trigger the content recheck.
 * @returns {MangoNode[]} Initial contents of the dynamic view.
 */
function createDynamicView(elementCreator, deps) {
  var markerNode = createMarkerNode();
  markerNode.$dv = elementCreator;
  subscribeToDynamicViewDeps(markerNode, deps);
  return [markerNode, elementCreator(), markerNode.$ec];
}

/**
 * Creates a new stateful array with predefined initial items.
 * @param {Array} arr - Initial items of the stateful array.
 * @returns {StatefulArray} Newly created stateful array.
 */
function createStatefulArray(arr) {
  /** @type {StatefulArray} */
  var statefulArray = [[], []];
  for (var i = 0; i < arr.length; i++) {
    statefulArray[0].push(createState(arr[i]));
  }
  return statefulArray;
}

/**
 * Replaces items in a stateful array with new ones,
 * then applies changes to the DOM.
 * @param {StatefulArray} statefulArray - Items replacing old items in the stateful array.
 * @param {any[]} arr - Items replacing old items in the stateful array.
 */
function updateStatefulArray(statefulArray, arr) {
  for (var i = 0; i < statefulArray[0].length && i < arr.length; i++) {
    setState(statefulArray[0][i], arr[i]);
  }
  if (statefulArray[0].length < arr.length) {
    for (i = statefulArray[0].length; i < arr.length; i++) {
      statefulArray[0].push(createState(arr[i]));
      for (var j = 0; j < statefulArray[1].length; j += 2) {
        var itemNode = /** @type {ItemNodeCreator} */ (statefulArray[1][j + 1])(statefulArray[0][i], i);
        if (/** @type {Children} */ (itemNode).push) {
          appendChildrenToElement(/** @type {MarkerNode} */ (statefulArray[1][j]), /** @type {Children} */ (itemNode));
        } else {
          appendToElement(/** @type {MarkerNode} */ (statefulArray[1][j]), /** @type {MangoNode} */ (itemNode));
        }
      }
    }
  } else if (statefulArray[0].length > arr.length) {
    var statefulArrayLength = statefulArray[0].length;
    for (i = arr.length; i < statefulArrayLength; i++) {
      for (j = 0; j < statefulArray[1].length; j += 2) {
        /** @type {MarkerNode} */ (statefulArray[1][j]).parentNode.removeChild(
          cleanUpNode(/** @type {MarkerNode} */ (statefulArray[1][j]).$ec.previousSibling)
        );
      }
      statefulArray[0].pop();
    }
  }
}

/**
 * Invokes a function on changing value of any of the given states.
 * @param {Function} fn - Function to be invoked.
 * @param {State[]} deps - States invoking the function on changing their values.
 * @param {boolean} [immediate] - Whether function should be invoked on creating effect.
 * @returns {Effect} A reference to the newly created effect.
 */
function createEffect(fn, deps, immediate) {
  for (var i = 0; i < deps.length; i++) {
    attachSubscriber(deps[i], deps);
    attachConsumer(deps[i], fn);
  }
  if (immediate) fn();
  return deps;
}

/**
 * Destroys an effect and unsubscribes it from all of its dependencies.
 * @param {Effect} effect - Effect to be removed.
 */
function destroyEffect(effect) {
  for (var i = 0; i < effect.length; i++) {
    unsubscribe(effect[i], effect);
  }
}

/**
 * Loads a component from a given URL and initializes it.
 * @param {string} src - URL of the component to be loaded.
 * @param {ComponentInitializer} componentInitializer - Function initializing the loaded component.
 * @param {MangoNode} loader - Node to be displayed while the component is loading.
 * @param {() => MangoNode} fallback - Node to be displayed if the component fails to load.
 * @returns {MangoNode} Node displayed while the component is loading.
 */
function createLazyComponent(src, componentInitializer, loader, fallback) {
  loader = loader || document.createTextNode('');
  var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
  xhr.open('GET', src, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 400) {
      var loadedElem = componentInitializer(new Function("return " + xhr.responseText)());
      cleanUpNode(loader).parentNode.replaceChild(loadedElem, loader);
    } else {
      cleanUpNode(loader).parentNode.replaceChild(fallback(), loader);
    }
  }
  setTimeout(function () {
    xhr.send(null);
  }, 0);
  return loader;
}

/**
 * Creates a new server function invoker.
 * [Supported browsers](https://caniuse.com/promises)
 * @param {string} src - URL of the function to be invoked.
 * @returns {Function} Newly created server function invoker.
 */
function createServerFunctionInvoker(src) {
  /** @type {() => Promise<any>} */
  return function () {
    var args = Array.prototype.slice.call(arguments);
    // @ts-ignore
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', src, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 400) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          console.error(xhr.responseText);
          reject(JSON.parse(xhr.responseText));
        }
      }
      xhr.send(JSON.stringify(Array.prototype.slice.call(args)));
    });
  }
}

// @ts-ignore
window.mango = {
  a: createState,
  b: getState,
  c: setState,
  d: createStatefulArray,
  e: updateStatefulArray,
  f: createEffect,
  g: destroyEffect,
  h: createListView,
  i: createDynamicView,
  j: createElement,
  k: createHeadElement,
  l: appendPropsToElement,
  m: createLazyComponent,
  n: createServerFunctionInvoker,
  o: appendChildrenToElement
}

})();
