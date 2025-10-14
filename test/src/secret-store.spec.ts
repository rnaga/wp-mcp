import type * as types from "@rnaga/wp-mcp/types";

const mockConfigInstance = {
  get: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  deleteAll: jest.fn(),
  loadFromEnvFile: jest.fn(),
};

// Mock the Config class before importing secret-store
jest.mock("@rnaga/wp-mcp/config", () => {
  return {
    Config: jest.fn().mockImplementation(() => mockConfigInstance),
  };
});

// Mock fs to avoid file system operations
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

// Import after mocking
import { saveSecret, getSecret } from "@rnaga/wp-mcp/secret-store";

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to return empty by default
  mockConfigInstance.get.mockResolvedValue({});
  mockConfigInstance.loadFromEnvFile.mockResolvedValue({});
});

test("saveSecret - should save secret using Config", async () => {
  const secret: types.Secret = {
    remote: {
      auth_url: "https://example.com",
      oauth: {
        access_token: "access_token_value",
        refresh_token: "refresh_token_value",
        expires_at: 1700000000,
      },
      password: {
        username: "admin",
        password: "password_value",
      },
    },
    local: {
      db_host: "localhost",
      db_name: "test_db",
      db_user: "test_user",
      db_password: "test_password",
      db_environment: "development",
      db_port: 3306,
      multisite: false,
      default_blog_id: 1,
      default_site_id: 1,
      ssl_enabled: true,
      ssl_ca: "/path/to/ca.crt",
      ssl_cert: "/path/to/cert.crt",
      ssl_key: "/path/to/key.key",
    },
  };

  await saveSecret(secret);

  expect(mockConfigInstance.save).toHaveBeenCalledWith(
    secret,
    expect.stringContaining(".env.local"),
    0o600
  );
});

test("saveSecret - should merge with existing secret", async () => {
  const existingSecret: types.Secret = {
    remote: {
      auth_url: "https://existing.com",
    },
    local: {
      db_host: "existing_host",
      db_name: "existing_db",
      db_user: "existing_user",
      db_password: "existing_password",
      db_environment: "development",
      db_port: 3306,
      multisite: false,
      default_blog_id: 1,
      default_site_id: 1,
      ssl_enabled: false,
    },
  };

  mockConfigInstance.get.mockResolvedValue(existingSecret);

  const newSecret: types.Secret = {
    remote: {},
    local: {
      db_host: "localhost",
      db_name: "test_db",
      db_user: "test_user",
      db_password: "test_password",
      db_port: 3306,
      multisite: false,
      default_blog_id: 1,
      default_site_id: 1,
      db_environment: "development",
      ssl_enabled: true,
      ssl_ca: "/path/to/ca.crt",
      ssl_cert: "/path/to/cert.crt",
      ssl_key: "/path/to/key.key",
    },
  };

  await saveSecret(newSecret);

  expect(mockConfigInstance.save).toHaveBeenCalledWith(
    expect.objectContaining({
      remote: expect.objectContaining({
        auth_url: "https://existing.com", // Should keep existing
      }),
      local: newSecret.local, // Should use new local config
    }),
    expect.stringContaining(".env.local"),
    0o600
  );
});

test("getSecret - should return empty object when no secret exists", async () => {
  mockConfigInstance.get.mockResolvedValue({});

  const result = await getSecret();

  expect(result).toEqual({});
});

test("getSecret - should return parsed secret when valid", async () => {
  const secret: types.Secret = {
    local: {
      db_host: "localhost",
      db_name: "test_db",
      db_user: "test_user",
      db_password: "test_password",
      db_port: 3306,
      multisite: false,
      default_blog_id: 1,
      default_site_id: 1,
      db_environment: "development",
      ssl_enabled: true,
      ssl_ca: "/path/to/ca.crt",
      ssl_cert: "/path/to/cert.crt",
      ssl_key: "/path/to/key.key",
    },
  };

  mockConfigInstance.get.mockResolvedValue(secret);

  const result = await getSecret();

  expect(result).toEqual(secret);
});

test("getSecret - should return empty object when validation fails", async () => {
  // Return invalid data that won't pass validation
  mockConfigInstance.get.mockResolvedValue({
    invalid: "data",
  });

  const result = await getSecret();

  expect(result).toEqual({});
});
