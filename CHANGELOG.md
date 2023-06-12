# Changelog

## [1.0.0-alpha.15] - 2023-06-12

### Fixed

- Variable `i` was reserved for elements mutators. This caused problems when using `i` as a variable name in a component.

## [1.0.0-alpha.14] - 2023-05-19

### Fixed

- `@parcel/reporter-dev-server` sometimes can't be resolved. This is fixed by adding `@parcel/reporter-dev-server` as a dependency to the `package.json` file of `@mango-js/scripts` package.

### Security

- Server-side code was exposed to public. This means that anyone could see the code of your SSR functions and API endpoints. This is fixed by moving the server-side code to a separate file that is not served to the client.

## [1.0.0-alpha.13] - 2023-05-18

### Fixed

- `.parcelrc.compression` was missing from the published `@mango-js/scripts` package.
- Routes were prioritized over static files. This means that if a static file exists at the same path as a route, the route was being served instead of the static file. This only affected self-hosted applications.

## [1.0.0-alpha.12] - 2023-05-17

### Added

- Hot Module Replacement (HMR) for Mango components. This enables you to see the changes you make to your components without having to reload the page.

- Introduce remote functions. They are JavaScript functions imported like any other function but they are executed on the server under the hood.

### Changed

- `synckit` isn't used anymore for SSG stuff. The main reason for this change is that executing asynchronous functions as synchronous functions inside a Babel transformer is not a good idea and is thought to affect the performance of the compiler. Instead, Mango now uses `worker_threads` to execute SSG functions in a separate thread created by the JSX parcel transformer.

### Fixed

- Some altered files were not being detected by Parcel's watcher. They are basically the dependencies added throughout the build process.
- Assigned or declared reactive variables were detected as dependencies.
- Setting a state had a synchronization problem. This happens because subscribers may be added or removed while the subscribers array is being iterated over. To fix this, the subscribers array is copied before iterating over it.
- Built-in Node modules were being detected as dependencies when they are imported in files executed on the server.

## [1.0.0-alpha.11] - 2023-03-17

### Changed

- Disable build time compression of static files. This is because the compression is already done by Netlify on the fly.

### Fixed

- Fix path from where service worker is loaded when the application is built for production.
- When an API endpoint has multiple methods, only one method was functional.
- Body of the API request was being parsed incorrectly when the application is deployed to Netlify.
- Static files were not being served if their paths are covered by a route in _redirects file. This only affects applications deployed to Netlify.

## [1.0.0-alpha.10] - 2023-03-16

### Fixed

- Make reporters resolved from the running script directory instead of the project root directory in `@mango-js/scripts` package.

## [1.0.0-alpha.9] - 2023-03-16

### Fixed

- Add `@parcel/compressor-raw` as a dependency to the `package.json` file of `@mango-js/scripts` package. This should fix the issue where Parcel complains about missing `@parcel/compressor-raw` package when building an application.

## [1.0.0-alpha.8] - 2023-03-15

### Fixed

- Only one dependency was being added to `package.json` file when building an application even if there were multiple dependencies.

## [1.0.0-alpha.7] - 2023-03-15

### Fixed

- Prop fallback values were being passed to the dependency arrays.
- SSR function could not access environment variables defined in the `.env` file.
- If the name of the HTML element is the same as the name of a prop, the whole element was being considered as an instance of a component.
- Element specific events were not being extracted from MDN data.
- Falsy values like `undefined` and `null` were being set as class names instead of being ignored by replacing them with an empty string.
- Public files were being served by the dev server from the wrong directory.

## [1.0.0-alpha.6] - 2023-03-13

### Fixed

- In SSR functions, when the import source has more than the dependency name, the whole path was being used as the dependency name.
- In SSR functions in dev mode, when the import source has non-alphanumeric characters, it was being skipped when substituting it with the absolute module path.
- Files in the `public` folder were not being served by the dev server.
- Components properties were not being treated as reactive variables.
- Some input types did not support bound values.

## [1.0.0-alpha.5] - 2023-02-12

### Fixed

- To see any updates you make to the SSG functions, it was necessary to restart the dev server.

### Security

- Use execFileSync to apply patches instead of execSync.

## [1.0.0-alpha.4] - 2023-02-11

### Added

- Make production server default port configurable.
- External dependencies used by SSR functions and API endpoints are now added to the `package.json` file of the exported application.
- Add @mango-js/types as a dev dependency to the `package.json` file of the template.

### Changed

- Runtime is now served as a separate file instead of being bundled with every page and lazy component. It can be self-hosted or served from either jsDelivr or unpkg.
- Change the default port of the development server to `4000`.

### Fixed

- Prevent non-mango scripts from being processed by Mango compiler. All jsx/tsx/mdx files are processed by Mango compiler by default. To mark a js/ts file as a Mango script, add `// @mango` or `/* @mango */` comment anywhere before the first line of code.

## [1.0.0-alpha.3] - 2023-02-10

### Changed

- Packages are minified before publishing to reduce the size of the package.

### Fixed

- Add a polyfill for `document.createComment` to make Mango work in IE5.
- Fix a bug where some versions of IE ignore some CSS classes because their names start with an underscore.

## [1.0.0-alpha.2] - 2023-02-08

### Removed

- Remove `exports` field from all `package.json` files because `main` field is sufficient.

### Fixed

- `@parcel/reporter-dev-server` was crashing randomly on starting the dev server or building an application.
- Hide error messages coming from `git patch` when applying Parcel patches.
- Fix a potential race condition where the process of building may start before the process of patching is finished.

## [1.0.0-alpha.1] - 2023-02-06

### Changed

- Versions of sibling dependencies are now specified explicitly instead of using `*`.

### Fixed

- The `netlify.toml` file was being created in the `dist` folder instead of the root folder.
