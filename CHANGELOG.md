# Changelog

## [1.0.0-alpha.29] - 2023-11-25

### Fixed

- Remote functions were crashing in development mode.

## [1.0.0-alpha.28] - 2023-10-27

### Fixed

- Fix a bug where URL objects can't be transferred directly to workers because they are no longer serializable since NodeJS v21.0. This is fixed by converting URL objects to strings before transferring them to workers and then converting them back to URL objects inside workers.

## [1.0.0-alpha.27] - 2023-10-22

### Added

- Introducing customizable error pages.

### Changed

- Use acorn to extract dynamics.
- Remove some redundant AST generations.

### Fixed

- Dev server crashed on editing translations.
- Web Components were not working.

## [1.0.0-alpha.26] - 2023-09-22

### Fixed

- `postcss` was not added as a dependency to the `package.json` file of `@mango-js/parcel-packager-css` package.

## [1.0.0-alpha.25] - 2023-09-22

### Fixed

- Parcel production configuration files were not published to NPM. This is fixed by adding them to the `files` field in `package.json` file of `@mango-js/scripts` package.

## [1.0.0-alpha.24] - 2023-09-22

### Added

- Catch APIs and SSR functions errors and log them to the console. In the past, errors thrown by APIs and SSR functions were not being caught and were causing the server to crash.
- Allow defining components using any type of function. In the past, arrow functions weren't working when defining components that have props.

### Changed

- Polish bundler console logs. All colored logs are now bold and error logs are logged through `console.error` instead of `console.log`.

### Fixed

- Keep variables declarations that are exported from a function.
- Resolve some race conditions in dev server.
- Some built pages not written to disk. Only some situations were causing this bug to appear.
- Building process was failing on Netlify.

## [1.0.0-alpha.23] - 2023-09-18

### Fixed

- Published `dev-prelude.js` in `@mango-js/packager-js` package was empty.
- SVG viewBox attribute was stripped by SVGO.

## [1.0.0-alpha.22] - 2023-09-18

### Added

- Introducing localization support. It's now possible to create multilingual websites with Mango without having to use any third-party library.
- Component props names minification. This allows the use of long names for component props without worrying about the size of the bundle.
- Defining a page is now more elegant. Instead of appending the page manually to the DOM, page's root component is exported as `default`. Mango will take care of the rest by appending the page to the element whose id is `root` or to the body if there is no element with that id.
- Bound values support for file input field.
- Bound values support for select & textarea elements.
- Ability to import raw files in functions.
- Ability to pass nonreactive vars as bound props.
- Add typings for raw and JSON files imports.

### Changed

- Improve transformation of JSX fragments. After this change, a JSX fragment is transformed to an array of elements.
- Ditch the use of all patches used to patch Parcel.
- Remove redundant Parcel plugins that are unsupported by Mango.

### Fixed

- Set type of mango's template to module.
- State not read when being used as a value in a JSON object.
- Async SSR functions were crashing in development mode.
- Functions can't use vars whose names are already exported.
- Checkbox value not bound correctly.
- States weren't usable as objects accessors.
- Dynamic texts couldn't be separated by a space.
- Async functions were not working as effects.
- Incorrect matching of pages to functions.
- Building fails when public directory is deep.
- Allow functions circular imports in development mode.

## [1.0.0-alpha.21] - 2023-07-02

### Fixed

- Boilerplate `package-lock.json` file was not being built on publishing a new version to NPM. This is fixed by separating publishing `@mango-js/create` package from publishing other packages.


## [1.0.0-alpha.20] - 2023-07-01

### Added

- Mango app boilerplate is now distributed with a prebuilt `package-lock.json` file. This reduces the initialization time of a new project.

### Fixed

- Increase the accuracy of the generated source maps. They still need some work to be perfect.

## [1.0.0-alpha.19] - 2023-06-23

### Fixed

- `import.meta.url` used in the `URL` constructor was kept as it is in the production code. This resulted in an error thrown by the browser because `import.meta` is available inside modules only. This is fixed by replacing the `URL` constructor with a path represented as a string literal.

## [1.0.0-alpha.18] - 2023-06-23

### Changed

- `firstChild` and `nextSibling` properties are used together instead of `childNodes` to get the children of an element while cleaning up removed elements. This change improves the performance of removing elements by 40% according to `js-framework-benchmark`.

## [1.0.0-alpha.17] - 2023-06-14

### Added

- Add `ignore:` URL scheme which allows you to prevent bundler from processing the specified path. This is useful when you want to serve a file from a URL relative to that of the website but not a part of the source code.

### Fixed

- Some paths to the website resources were not POSIX-compliant.

- `parcel` was not being patched when it is installed in a `node_modules` directory that is not in the root directory of the repository. This is fixed by applying patches while the current working directory is set to the root directory of the repository.

## [1.0.0-alpha.16] - 2023-06-12

### Fixed

- Published packages were empty as a result of some breaking changes introduced by Lerna v7.0.0.

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
