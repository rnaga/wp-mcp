import mockFetch from "../../../__mocks__/node-fetch";

const mockSaveSecret = jest.fn();
const mockGetSecret = jest.fn();

jest.mock("@rnaga/wp-mcp/secret-store", () => ({
  saveSecret: mockSaveSecret,
  getSecret: mockGetSecret,
}));

jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

import { RemoteConnector } from "@rnaga/wp-mcp/cli/remote-connector";

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSecret.mockResolvedValue({});
});

test("setAuthUrl should save auth URL to secret store", async () => {
  const connector = new RemoteConnector();
  await connector.setAuthUrl("https://example.com/auth");

  expect(mockSaveSecret).toHaveBeenCalledWith({
    remote: {
      auth_url: "https://example.com/auth",
    },
  });
});

test("getAuthUrl should return auth URL from secret store", async () => {
  mockGetSecret.mockResolvedValue({
    remote: {
      auth_url: "https://example.com/auth",
    },
  });

  const connector = new RemoteConnector();
  const authUrl = await connector.getAuthUrl();

  expect(authUrl).toBe("https://example.com/auth");
});

test("getAuthUrl should return undefined when no auth URL exists", async () => {
  mockGetSecret.mockResolvedValue({});

  const connector = new RemoteConnector();
  const authUrl = await connector.getAuthUrl();

  expect(authUrl).toBeUndefined();
});

test("performPasswordAuth should authenticate and save credentials", async () => {
  mockGetSecret.mockResolvedValue({
    remote: { auth_url: "https://example.com" },
  });

  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ id: 1, username: "testuser" }),
  } as any);

  const connector = new RemoteConnector();
  const result = await connector.performPasswordAuth("testuser", "testpass");

  expect(result).toBe(true);
  expect(mockFetch).toHaveBeenCalledWith(
    "https://example.com/auth/password",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ username: "testuser", password: "testpass" }),
    })
  );
  expect(mockSaveSecret).toHaveBeenCalledWith({
    remote: {
      password: {
        username: "testuser",
        password: "testpass",
      },
    },
  });
});

test("performPasswordAuth should throw error on failed authentication", async () => {
  mockGetSecret.mockResolvedValue({
    remote: { auth_url: "https://example.com" },
  });

  mockFetch.mockResolvedValue({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
  } as any);

  const connector = new RemoteConnector();

  await expect(
    connector.performPasswordAuth("baduser", "badpass")
  ).rejects.toThrow("Password authentication failed: 401 Unauthorized");
});

test("revokeToken should revoke token and remove from secret store", async () => {
  mockGetSecret.mockResolvedValue({
    remote: {
      auth_url: "https://example.com",
      oauth: {
        access_token: "test_token",
        refresh_token: "refresh_token",
        expires_at: Date.now() + 3600000,
      },
      password: { username: "user", password: "pass" },
    },
  });

  mockFetch.mockResolvedValue({
    ok: true,
  } as any);

  const connector = new RemoteConnector();
  await connector.revokeToken();

  expect(mockFetch).toHaveBeenCalledWith(
    "https://example.com/auth/revoke",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ access_token: "test_token" }),
    })
  );
  expect(mockSaveSecret).toHaveBeenCalledWith({
    remote: {
      auth_url: "https://example.com",
      password: { username: "user", password: "pass" },
    },
  });
});

test("refreshToken should update access token when refresh token is available", async () => {
  mockGetSecret.mockResolvedValue({
    remote: {
      auth_url: "https://example.com",
      oauth: {
        access_token: "old_token",
        refresh_token: "refresh_token",
        expires_at: Date.now() + 1000,
      },
    },
  });

  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      access_token: "new_token",
      refresh_token: "new_refresh_token",
      expires_at: 3600,
    }),
  } as any);

  const connector = new RemoteConnector();
  await connector.refreshToken();

  expect(mockFetch).toHaveBeenCalledWith(
    "https://example.com/auth/refresh",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ refresh_token: "refresh_token" }),
    })
  );
  expect(mockSaveSecret).toHaveBeenCalledWith({
    remote: {
      oauth: {
        access_token: "new_token",
        refresh_token: "new_refresh_token",
        expires_at: expect.any(Number),
      },
    },
  });
});

test("refreshToken should return early when no refresh token is available", async () => {
  mockGetSecret.mockResolvedValue({
    remote: { auth_url: "https://example.com" },
  });

  const connector = new RemoteConnector();
  await connector.refreshToken();

  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockSaveSecret).not.toHaveBeenCalled();
});
