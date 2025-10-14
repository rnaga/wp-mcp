jest.mock("../../../src/secret-store");
jest.mock("../../../src/logger");

import { getConfig } from "@rnaga/wp-mcp/proxy/config";
import { getSecret, loadSecret } from "../../../src/secret-store";

beforeEach(() => {
  // Clear all environment variables
  delete process.env.REMOTE_URL;
  delete process.env.REMOTE_AUTH_TYPE;
  delete process.env.REMOTE_USERNAME;
  delete process.env.REMOTE_PASSWORD;
  delete process.env.REMOTE_CUSTOM_HEADERS;

  // Reset mocks
  jest.clearAllMocks();
});

test("should return config with remoteUrl from environment variable", async () => {
  process.env.REMOTE_URL = "https://example.com/api";

  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({});

  const config = await getConfig();

  expect(config.remoteUrl).toBe("https://example.com/api");
});

test("should return config with remoteUrl from secret store when env not set", async () => {
  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({
    remote: {
      auth_url: "https://secret.example.com",
    },
  });

  const config = await getConfig();

  expect(config.remoteUrl).toBe("https://secret.example.com/mcp");
});

test("should throw error when remoteUrl is not configured anywhere", async () => {
  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({});

  await expect(getConfig()).rejects.toThrow(
    "Remote URL is not configured. Please set MCP_REMOTE_URL environment variable or run 'remote login' command."
  );
});

test("should use username and password from environment variables", async () => {
  process.env.REMOTE_URL = "https://example.com/api";
  process.env.REMOTE_USERNAME = "testuser";
  process.env.REMOTE_PASSWORD = "testpass";

  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({});

  const config = await getConfig();

  expect(config.username).toBe("testuser");
  expect(config.password).toBe("testpass");
});

test("should use username and password from secret store when env not set", async () => {
  process.env.REMOTE_URL = "https://example.com/api";

  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({
    remote: {
      password: {
        username: "secretuser",
        password: "secretpass",
      },
    },
  });

  const config = await getConfig();

  expect(config.username).toBe("secretuser");
  expect(config.password).toBe("secretpass");
});

test("should prefer environment variables over secret store for credentials", async () => {
  process.env.REMOTE_URL = "https://example.com/api";
  process.env.REMOTE_USERNAME = "envuser";
  process.env.REMOTE_PASSWORD = "envpass";

  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({
    remote: {
      password: {
        username: "secretuser",
        password: "secretpass",
      },
    },
  });

  const config = await getConfig();

  expect(config.username).toBe("envuser");
  expect(config.password).toBe("envpass");
});

test("should handle authType from environment variable", async () => {
  process.env.REMOTE_URL = "https://example.com/api";
  process.env.REMOTE_AUTH_TYPE = "oauth";

  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({});

  const config = await getConfig();

  expect(config.authType).toBe("oauth");
});

test("should handle customHeaders as JSON string from environment variable", async () => {
  process.env.REMOTE_URL = "https://example.com/api";
  process.env.REMOTE_CUSTOM_HEADERS = '{"Authorization":"Bearer token"}';

  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({});

  const config = await getConfig();

  expect(config.customHeaders).toEqual({ Authorization: "Bearer token" });
});

test("should return config with all fields when fully configured", async () => {
  process.env.REMOTE_URL = "https://example.com/api";
  process.env.REMOTE_AUTH_TYPE = "password";
  process.env.REMOTE_USERNAME = "user123";
  process.env.REMOTE_PASSWORD = "pass123";

  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({});

  const config = await getConfig();

  expect(config).toEqual({
    remoteUrl: "https://example.com/api",
    authType: "password",
    username: "user123",
    password: "pass123",
    customHeaders: undefined,
  });
});

test("should call loadSecret before getting config", async () => {
  process.env.REMOTE_URL = "https://example.com/api";

  (loadSecret as jest.Mock).mockResolvedValue(undefined);
  (getSecret as jest.Mock).mockResolvedValue({});

  await getConfig();

  expect(loadSecret).toHaveBeenCalled();
  expect(getSecret).toHaveBeenCalled();
});
