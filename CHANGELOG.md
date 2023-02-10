# Changelog

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
