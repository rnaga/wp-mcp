import Application from "@rnaga/wp-node/application";
import * as helpers from "./helpers";

jest.setTimeout(30000);
jest.mock<any>("fs");

// Mock sqlite3 packages to avoid native binding errors
jest.mock("@keyv/sqlite", () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  }));
});

jest.mock("keyv", () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  }));
});

Application.config = helpers.getAppConfigs()["multi"];

afterAll(() => {
  process.env.USERNAME = undefined;
  Application.terminate();
});
