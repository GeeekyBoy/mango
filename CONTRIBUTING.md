# Contributor Handbook

Thanks for your interest in contributing to Mango! We're excited to have you on board. In this document, we'll outline the guidelines for contributing to Mango. These guidelines are designed to make it as easy as possible to get involved.

## Table of Contents

- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)
- [Code Contribution Guidelines](#code-contribution-guidelines)
  - [Development Setup](#development-setup)
  - [Codebase](#codebase)
  - [Commit Message Style](#commit-message-style)
  - [Pull Requests Rules](#pull-requests-rules)

## Reporting Bugs

This section guides you through submitting a bug report for Mango. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

### Before Submitting A Bug Report

- **Make sure you're using the latest version of Mango**. The latest version of Mango might have the bug you're experiencing fixed already.
- **Check the [documentation](https://mangojs.geeekyboy.com/docs)**. You might be able to find the cause of the problem and fix things yourself.
- **Check the [issue tracker](https://github.com/GeeekyBoy/mango/issues?q=is%3Aissue)**. Someone might have already reported the same problem. If it's already reported **and the issue is still open**, add a comment to the existing issue instead of opening a new one.
- **Perform a cursory search on the internet**. This is a good way to see if the problem is a known issue with a known solution.

### How Do I Submit A (Good) Bug Report?

To make sure your bug report gets the attention it deserves, please follow these guidelines:

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as many details as possible.
- **Provide specific examples to demonstrate the steps**. Include links to files or GitHub projects, or copy/pasteable snippets, which you use in those examples. If you're providing snippets in the issue, use [Markdown code blocks](https://help.github.com/articles/markdown-basics/#multiple-lines).
- **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**

## Feature Requests

This section guides you through submitting a feature request for Mango. Following these guidelines helps maintainers and the community understand your suggestion and why it would be useful.

### Before Submitting An Enhancement Suggestion

- **Make sure you're using the latest version of Mango**. The latest version of Mango might have the feature you're requesting already.
- **Have a look at the [proposed features](https://github.com/GeeekyBoy/mango/discussions/categories/ideas)**. Someone might have already suggested the same thing.

### How Do I Submit A (Good) Feature Request?

To make sure your feature request gets the attention it deserves, please follow these guidelines:

- **Use a clear and descriptive title** for the dicussion to identify the suggestion.
- **Explain why this feature would be useful** to most Mango users.
- **Describe the solution you'd like**. Be specific and include details of your proposed implementation.
- **List some other projects where this feature exists**. This is a good way to get a feel for how it might work. This is not required, but it can help to get a better picture of what you're suggesting.
- **Describe alternatives you've considered**. This is important so that others can understand the trade-offs you might have thought of.
- **Include UML diagrams** if you think they would help to understand your suggestion.

## Code Contribution Guidelines

### Development Setup

Before you start working on Mango, you'll need to setup your development environment. Follow the steps below to get started:

1. Fork the Mango repository on GitHub.
2. Clone your fork locally:
    ```bash
    git clone <your-fork-url>
    cd mango
    ```
3. Install the dependencies:
    ```bash
    npm install
    npm run bootstrap
    ```
4. Run Mango website locally to test your changes:
    ```bash
    cd website
    npm run start
    ```
  
No need to work on a separate branch. Once you're done, create a pull request to the `main` branch. It's advisable to pull the latest changes from the `main` branch periodically to avoid merge conflicts.

### Codebase

The codebase is organized as a monorepo using [Lerna](https://lerna.js.org/). All packages are located in the `packages` directory. Below is a list of all the packages in the repository:

| Package | Description |
| ------- | ----------- |
| `@mango-js/runtime` | Basic functions required for running Mango applications. |
| `@mango-js/scripts` | Scripts required for building and testing Mango applications. |
| `@mango-js/create` | A CLI tool for creating new Mango applications with a single command. |
| `@mango-js/router` | A simple and fast router for the Mango framework. |
| `@mango-js/types` | TypeScript type definitions for Mango JSX. |
| `@mango-js/babel-plugin-transform-jsx` | Turns JSX into Mango function calls. |
| `@mango-js/parcel-transformer-function` | Parcel v2 function transformer for Mango. |
| `@mango-js/parcel-transformer-html` | Parcel v2 HTML transformer for Mango. |
| `@mango-js/parcel-transformer-jsx` | Parcel v2 JSX transformer for Mango. |
| `@mango-js/parcel-transformer-mdx` | Parcel v2 MDX transformer for Mango. |
| `@mango-js/parcel-optimizer-function` | Parcel v2 function optimizer for Mango. |
| `@mango-js/parcel-packager-function` | Parcel v2 function packager for Mango. |
| `@mango-js/parcel-reporter-development` | Parcel v2 development reporter for Mango. |
| `@mango-js/parcel-reporter-production` | Parcel v2 production reporter for Mango. |
| `@mango-js/parcel-namer` | Parcel v2 namer for Mango. |

### Commit Message Style

Mango commit message guidelines are derived from the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. Before proceeding, make sure you understand the specification. We add a few extra rules on top of the specification:

#### Format

The commit message must be in the following format. Please note that each line cannot be longer than 72 characters.

```
<type>[(optional scope)]: <subject> <emoji>

[optional body]

[optional footer(s)]
```

#### Type & Emoji

| Type | Description | Emoji |
| ---- | ----------- | ----- |
| `build` | Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm). This includes changes to the build scripts and package.json files. | 👷 |
| `ci` | Changes to our CI configuration files and scripts (examples: CircleCi, SauceLabs) | 👷 |
| `docs` | Documentation only changes. This includes changes to the documentation, website, README, etc. | 📝 |
| `feat` | A new feature or enhancement that is not a bug fix. | ✨ |
| `fix` | A bug fix. | 🐛 |
| `perf` | A code change that improves performance | ⚡️ |
| `refactor` | A code change that neither fixes a bug nor adds a feature | ♻️ |
| `test` | Adding missing tests or correcting existing tests | 🧪 |
| `revert` | Reverting a previous commit. | ⏪ |
| `chore` | Changes that don't fit any of the above categories | [choose](https://gitmoji.dev/) |

#### Scope

Scope is optional. It can be anything specifying the place of the commit change. A common use case is when commiting a change in the README file where the commit message would be `docs(readme): <subject> 📝`.

#### Subject

- **Use the imperative, present tense**: "change" not "changed" nor "changes".
- **Capitalize the first letter**.
- **Don't end the subject with a period or any other punctuation**.
- **Initials must be uppercased**: `IE rejects CSS classes starting with _` not `ie rejects css classes starting with _`.

#### Body

- **Use the imperative, present tense**: "change" not "changed" nor "changes".
- **Capitalize the first letter of each sentence**.

### Pull Requests Rules

Here's some rules to follow when submitting a pull request. These rules are strictly enforced to ensure a high quality of the codebase.

- **One pull request per feature**. If you want to add multiple features, create multiple pull requests.
- **One pull request per bug fix**. If you want to fix multiple bugs, create multiple pull requests.
- **Don't commit changes to files that are irrelevant to your feature or bug fix**. For example, if you are working on a feature that only affects the `@mango-js/runtime` package, don't fix typos in the documentation. This will make it easier for the reviewer to focus on the changes that matter.
- **Don't bump the version number**. The version number will be bumped by the maintainer when a new version is published to NPM.
- **Don't manipulate the changelog**. The changelog will be updated by the maintainer when a new version is published to NPM.
- **Don't create a new package**. If you want to create a new package, please create a new discussion first to discuss the idea.
