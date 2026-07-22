import { Config, ConfigOptions } from "@rnaga/wp-mcp/config";
import { z } from "zod";

// Mock external dependencies
const mockKeyvInstance = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockKeyvSqlite = jest.fn();

jest.mock("keyv", () => {
  return jest.fn().mockImplementation(() => mockKeyvInstance);
});

jest.mock("@keyv/sqlite", () => {
  return jest.fn().mockImplementation(() => mockKeyvSqlite());
});

jest.mock("fs", () => ({
  writeFileSync: jest.fn(),
}));

jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
}));

jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

const fs = require("fs");
const dotenv = require("dotenv");

const testValidator = z.object({
  apiKey: z.string().optional(),
  database: z
    .object({
      host: z.string().optional(),
      port: z.number().optional(),
    })
    .optional(),
  enabled: z.boolean().optional(),
});

type TestConfig = z.infer<typeof testValidator>;

let configOptions: ConfigOptions<TestConfig>;

beforeEach(() => {
  jest.clearAllMocks();

  // Reset process.env
  delete process.env.TEST_API_KEY;
  delete process.env.TEST_DB_HOST;
  delete process.env.TEST_DB_PORT;
  delete process.env.TEST_ENABLED;
  delete process.env.CONFIG_SQLITE_DB_PATH;

  configOptions = {
    STORAGE_CONFIG: {
      sqlite: ["database.host", "database.port"],
      env: ["apiKey", "enabled"],
    },
    ENV_VAR_MAP: {
      apiKey: "TEST_API_KEY",
      enabled: "TEST_ENABLED",
      "database.host": "TEST_DB_HOST",
      "database.port": "TEST_DB_PORT",
    },
    validator: testValidator,
    dbPath: "/test/config.db",
    namespace: "test",
  };
});

test("should initialize with provided options", () => {
  const config = new Config(configOptions);
  expect(config).toBeDefined();
});

test("should use default dbPath from process.env if not provided", () => {
  process.env.CONFIG_SQLITE_DB_PATH = "/env/config.db";
  const options = { ...configOptions, dbPath: undefined };
  const config = new Config(options);
  expect(config).toBeDefined();
});

test("should use default namespace if not provided", () => {
  const options = { ...configOptions, namespace: undefined };
  const config = new Config(options);
  expect(config).toBeDefined();
});

test("getSync should throw error when SQLite storage is configured", () => {
  const config = new Config(configOptions);
  expect(() => config.getSync()).toThrow(
    "Cannot use getSync() when SQLite storage is configured. Use async get() instead."
  );
});

test("getSync should return config from env variables only", () => {
  process.env.TEST_API_KEY = "test-key";
  process.env.TEST_ENABLED = "true";

  const options = {
    ...configOptions,
    STORAGE_CONFIG: {
      sqlite: [],
      env: ["apiKey", "enabled"],
    },
  };

  const config = new Config(options);
  const result = config.getSync();

  expect(result).toEqual({
    apiKey: "test-key",
    enabled: true,
  });
});

test("getSync should parse numeric values from env", () => {
  process.env.TEST_DB_PORT = "5432";

  const options = {
    ...configOptions,
    STORAGE_CONFIG: {
      sqlite: [],
      env: ["database.port"],
    },
  };

  const config = new Config(options);
  const result = config.getSync();

  expect(result).toEqual({
    database: { port: 5432 },
  });
});

test("getSync should parse boolean values from env", () => {
  process.env.TEST_ENABLED = "false";

  const options = {
    ...configOptions,
    STORAGE_CONFIG: {
      sqlite: [],
      env: ["enabled"],
    },
  };

  const config = new Config(options);
  const result = config.getSync();

  expect(result).toEqual({
    enabled: false,
  });
});

test("get should load config from env and SQLite", async () => {
  process.env.TEST_API_KEY = "env-key";
  mockKeyvInstance.get.mockImplementation((key: string) => {
    if (key === "database.host") return Promise.resolve("localhost");
    if (key === "database.port") return Promise.resolve(5432);
    return Promise.resolve(undefined);
  });

  const config = new Config(configOptions);
  const result = await config.get();

  expect(result).toEqual({
    apiKey: "env-key",
    database: {
      host: "localhost",
      port: 5432,
    },
  });
});

test("get should prioritize SQLite values over env values for same keys", async () => {
  process.env.TEST_DB_HOST = "env-host";
  mockKeyvInstance.get.mockImplementation((key: string) => {
    if (key === "database.host") return Promise.resolve("db-host");
    return Promise.resolve(undefined);
  });

  const config = new Config(configOptions);
  const result = await config.get();

  expect(result).toEqual({
    database: {
      host: "db-host",
    },
  });
});

test("get should handle empty config", async () => {
  mockKeyvInstance.get.mockResolvedValue(undefined);

  const config = new Config(configOptions);
  const result = await config.get();

  expect(result).toEqual({});
});

test("save should save SQLite values to database", async () => {
  const config = new Config(configOptions);
  const testConfig: TestConfig = {
    database: {
      host: "localhost",
      port: 5432,
    },
  };

  await config.save(testConfig);

  expect(mockKeyvInstance.set).toHaveBeenCalledWith(
    "database.host",
    "localhost"
  );
  expect(mockKeyvInstance.set).toHaveBeenCalledWith("database.port", 5432);
});

test("save should update process.env for env variables", async () => {
  const config = new Config(configOptions);
  const testConfig: TestConfig = {
    apiKey: "new-key",
    enabled: true,
  };

  await config.save(testConfig);

  expect(process.env.TEST_API_KEY).toBe("new-key");
  expect(process.env.TEST_ENABLED).toBe("true");
});

test("save should write to .env file when filePath is provided", async () => {
  mockKeyvInstance.get.mockResolvedValue(undefined);
  dotenv.config.mockImplementation(() => {});

  const config = new Config(configOptions);
  const testConfig: TestConfig = {
    apiKey: "file-key",
    enabled: false,
  };

  await config.save(testConfig, "/test/.env");

  expect(dotenv.config).toHaveBeenCalledWith({ path: "/test/.env" });
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    "/test/.env",
    expect.stringContaining("TEST_API_KEY=file-key"),
    expect.objectContaining({ mode: 0o644 })
  );
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    "/test/.env",
    expect.stringContaining("TEST_ENABLED=false"),
    expect.objectContaining({ mode: 0o644 })
  );
});

test("save should merge with existing config when filePath is provided", async () => {
  process.env.TEST_API_KEY = "existing-key";
  mockKeyvInstance.get.mockResolvedValue(undefined);
  dotenv.config.mockImplementation(() => {
    process.env.TEST_API_KEY = "existing-key";
  });

  const config = new Config(configOptions);
  const testConfig: TestConfig = {
    enabled: true,
  };

  await config.save(testConfig, "/test/.env");

  expect(process.env.TEST_API_KEY).toBe("existing-key");
  expect(process.env.TEST_ENABLED).toBe("true");
});

test("update should update SQLite values", async () => {
  const config = new Config(configOptions);
  const updates = {
    database: {
      host: "updated-host",
    },
  };

  await config.update(updates);

  expect(mockKeyvInstance.set).toHaveBeenCalledWith(
    "database.host",
    "updated-host"
  );
});

test("update should update env values in process.env", async () => {
  const config = new Config(configOptions);
  const updates = {
    apiKey: "updated-key",
  };

  await config.update(updates);

  expect(process.env.TEST_API_KEY).toBe("updated-key");
});

test("update should handle partial nested updates", async () => {
  const config = new Config(configOptions);
  const updates = {
    database: {
      port: 3306,
    },
  };

  await config.update(updates);

  expect(mockKeyvInstance.set).toHaveBeenCalledWith("database.port", 3306);
  expect(mockKeyvInstance.set).not.toHaveBeenCalledWith(
    "database.host",
    expect.anything()
  );
});

test("del should delete SQLite keys", async () => {
  const config = new Config(configOptions);

  await config.del(["database.host", "database.port"]);

  expect(mockKeyvInstance.delete).toHaveBeenCalledWith("database.host");
  expect(mockKeyvInstance.delete).toHaveBeenCalledWith("database.port");
});

test("del should delete env keys from process.env", async () => {
  process.env.TEST_API_KEY = "to-delete";
  process.env.TEST_ENABLED = "true";

  const config = new Config(configOptions);
  await config.del(["apiKey", "enabled"]);

  expect(process.env.TEST_API_KEY).toBeUndefined();
  expect(process.env.TEST_ENABLED).toBeUndefined();
});

test("del should handle mixed keys", async () => {
  process.env.TEST_API_KEY = "to-delete";

  const config = new Config(configOptions);
  await config.del(["apiKey", "database.host"]);

  expect(mockKeyvInstance.delete).toHaveBeenCalledWith("database.host");
  expect(process.env.TEST_API_KEY).toBeUndefined();
});

test("deleteAll should delete all SQLite keys", async () => {
  const config = new Config(configOptions);

  await config.deleteAll();

  expect(mockKeyvInstance.delete).toHaveBeenCalledWith("database.host");
  expect(mockKeyvInstance.delete).toHaveBeenCalledWith("database.port");
});

test("deleteAll should delete all env keys from process.env", async () => {
  process.env.TEST_API_KEY = "to-delete";
  process.env.TEST_ENABLED = "true";

  const config = new Config(configOptions);
  await config.deleteAll();

  expect(process.env.TEST_API_KEY).toBeUndefined();
  expect(process.env.TEST_ENABLED).toBeUndefined();
});

test("loadFromEnvFile should load config from specified env file", async () => {
  dotenv.config.mockImplementation(() => {
    process.env.TEST_API_KEY = "loaded-key";
    process.env.TEST_ENABLED = "true";
  });
  mockKeyvInstance.get.mockResolvedValue(undefined);

  const config = new Config(configOptions);
  const result = await config.loadFromEnvFile("/test/.env");

  expect(dotenv.config).toHaveBeenCalledWith({ path: "/test/.env" });
  expect(result).toEqual({
    apiKey: "loaded-key",
    enabled: true,
  });
});

test("should handle empty and null values in valueToString", async () => {
  const config = new Config(configOptions);
  const testConfig: TestConfig = {
    apiKey: "",
  };

  await config.save(testConfig);

  expect(process.env.TEST_API_KEY).toBe("");
});

test("should handle nested object cleanup", async () => {
  mockKeyvInstance.get.mockResolvedValue(undefined);

  const config = new Config(configOptions);
  const result = await config.get();

  // Should not include empty nested objects
  expect(result.database).toBeUndefined();
});

test("should flatten nested objects correctly", async () => {
  const config = new Config(configOptions);
  const updates = {
    database: {
      host: "host1",
      port: 3306,
    },
  };

  await config.update(updates);

  expect(mockKeyvInstance.set).toHaveBeenCalledWith("database.host", "host1");
  expect(mockKeyvInstance.set).toHaveBeenCalledWith("database.port", 3306);
});
