Best default: start with a single public NPM package (monorepo only if you later add plugins), generate types per Moodle version into `src/generated/<ref>/…`, and expose them via package subpath exports (so consumers can pin imports to the Moodle line they run). TypeScript/Node tooling supports this style via `package.json` `exports` subpaths and type resolution. [hirok](https://hirok.io/posts/package-json-exports)

## Repo layout (simple, scalable)
```
moodle-ts/
  src/
    client/
      MoodleClient.ts
      call.ts
      serialize.ts
      errors.ts
    generated/
      MOODLE_405_STABLE/
        index.ts
        functions.ts
        types.ts
      MOODLE_500_STABLE/
        ...
    index.ts
  scripts/
    extract-ws.php
    codegen.mjs
  schemas/
    MOODLE_405_STABLE.json
    MOODLE_500_STABLE.json
  package.json
  tsup.config.ts
  .github/workflows/codegen.yml
```

## Packaging approach (what users import)
Use subpath exports so users can do:
- `import { MoodleClient } from "moodle-ts";`
- `import { core_course_get_courses } from "moodle-ts/moodle/MOODLE_500_STABLE";`

That pattern is what the `exports` field is designed for, including TypeScript’s ability to resolve types for subpaths. [typescriptlang](https://www.typescriptlang.org/docs/handbook/modules/reference.html)

## `package.json` skeleton (key bits)
```json
{
  "name": "moodle-ts",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./moodle/MOODLE_405_STABLE": {
      "types": "./dist/generated/MOODLE_405_STABLE/index.d.ts",
      "import": "./dist/generated/MOODLE_405_STABLE/index.js"
    },
    "./moodle/MOODLE_500_STABLE": {
      "types": "./dist/generated/MOODLE_500_STABLE/index.d.ts",
      "import": "./dist/generated/MOODLE_500_STABLE/index.js"
    }
  }
}
```
(You can generate those export entries in CI when you add/remove supported Moodle refs.) [hirok](https://hirok.io/posts/package-json-exports)

## Build tool and release defaults
- Build with `tsup` to emit ESM + `.d.ts` in one command; it’s commonly used for TS libraries and supports generating declaration files. [blog.logrocket](https://blog.logrocket.com/tsup/)
- Use Changesets for releases so your nightly codegen can open a PR and publishing becomes “merge PR → publish”; the `changesets/action` supports this workflow. [dev](https://dev.to/wdsebastian/simplest-way-to-publish-and-automate-npm-packages-d0c)

## CI strategy (what happens on day 1)
- `codegen.yml` runs on a schedule: for each Moodle ref, install Moodle, run `extract-ws.php` (which calls Moodle’s metadata API), write `schemas/<ref>.json`, run `codegen.mjs`, then commit changes on a bot PR. (This aligns with how Moodle exposes function metadata via `external_api` and uses it to build docs.) [phpdoc.moodledev](https://phpdoc.moodledev.io/4.1/d9/d0e/classexternal__api.html)
- `release.yml` runs on pushes to `main`: Changesets either opens/updates the release PR or publishes to NPM after the release PR is merged. [github](https://github.com/changesets/action)

If you want to support browser apps too, say so up front—then I’d recommend adding conditional exports (node vs browser) and making the default client use `fetch` while keeping Node-only conveniences optional. [reactnative](https://reactnative.dev/blog/2023/06/21/package-exports-support)