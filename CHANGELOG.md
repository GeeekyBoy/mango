# Changelog

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
