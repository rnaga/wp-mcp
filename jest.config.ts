/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 *
 * @jest-config-loader esbuild-register
 */

import type { Config } from "jest";

const config: Config = {
  moduleNameMapper: {
    "^@rnaga/wp-mcp/(.*)$": "<rootDir>/src/$1",
    "^_wp/(.*)$": "<rootDir>/test/_wp/$1",
    "^@/test/(.*)$": "<rootDir>/test/$1",
  },
  // exclude dist folders to avoid collision error - jest-haste-map: Haste module naming collision
  modulePathIgnorePatterns: ["<rootDir>/dist"],

  setupFilesAfterEnv: ["<rootDir>/test/bootstrap.ts"],
  //setupFiles: ["./test-next/jest.setup.ts"],
  coverageProvider: "v8",
  testMatch: ["**/?(*.)+(spec|test).+(ts|tsx|js)"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "test/tsconfig.json" }],
  },

  // Transform node_modules that are ES modules
  transformIgnorePatterns: ["node_modules/(?!(node-fetch)/)"],
};

export default config;
