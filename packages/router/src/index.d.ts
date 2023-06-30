/**
 * Route parameters determined by the route pattern.
 *
 * @example
 * // Assuming the current URL is "/foo/bar/baz"
 * // And the route pattern is "/foo/:bar/:baz"
 * $routeParams.bar // "bar"
 * $routeParams.baz // "baz"
 * $routeParams.qux // undefined
 * $routeParams["*"] // undefined
 * @example
 * // Assuming the current URL is "/foo/bar/baz/qux/quux"
 * // And the route pattern is "/foo/:bar/:baz/*"
 * $routeParams.bar // "bar"
 * $routeParams.baz // "baz"
 * $routeParams["*"] // "/qux/quux"
 */
export var $routeParams: {
    [x: string]: string;
};

/**
 * Query parameters determined by the query string after the "?".
 *
 * @example
 * // Assuming the current URL is "/?foo=bar&baz=qux"
 * $routeQuery.foo // "bar"
 * $routeQuery.baz // "qux"
 */
export var $routeQuery: {
    [x: string]: string;
};

/**
 * Pathname of the current URL determined by the string before the "?" and "#".
 *
 * @example
 * // Assuming the current URL is "/foo/bar?baz=qux#quux"
 * $routePath // "/foo/bar"
 */
export var $routePath: string;

/**
 * Hash of the current URL determined by the string after the "#".
 *
 * @example
 * // Assuming the current URL is "/?foo=bar#baz"
 * $routeHash // "baz"
 */
export var $routeHash: string;

/**
 * Route pattern that matched the current URL.
 *
 * @example
 * // Assuming the current URL is "/foo/bar/baz"
 * // And the route pattern is "/foo/:bar/:baz"
 * $routePattern // "/foo/[bar]/[baz]"
 */
export var $routePattern: string;

/**
 * Navigates to a new path.
 *
 * @param {string | number} nextPath - Path to navigate to or a number to go back/forward in history.
 * @param {boolean} shouldReplace - Whether to replace the current history entry or not.
 */
export function navigate(nextPath: string | number, shouldReplace: boolean): void;
