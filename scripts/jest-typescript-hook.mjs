/**
 * ts-jest's internal module loader (ts-jest/dist/utils/importer.js) resolves
 * "typescript" via `require.resolve(mod, { paths: [process.cwd(), __dirname] })`,
 * checking the project root first. That always finds the root `typescript`
 * package (TS7 / the native tsgo compiler), whose classic Program/
 * LanguageService API ts-jest depends on isn't stable yet. Placing a
 * different "typescript" package inside ts-jest's own node_modules has no
 * effect, since process.cwd() is checked before __dirname and short-circuits
 * the lookup.
 *
 * This hook redirects every `require("typescript")` in this process to
 * `@typescript/typescript6` (the official TS6-API compatibility package), so
 * `npm test` runs against a compiler ts-jest actually supports. It's loaded
 * only via the `test` script's `--import`, so `npm run build`'s `tsc`
 * invocation is unaffected and keeps using TS7.
 */

import { createRequire } from "node:module";
import Module from "node:module";

const require = createRequire(import.meta.url);
const redirectTarget = require.resolve("@typescript/typescript6");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  if (request === "typescript") {
    return redirectTarget;
  }

  return originalResolveFilename.call(this, request, ...rest);
};
