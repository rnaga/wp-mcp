import { OAuthProvider } from "../../../../src/http/auth/oauth-provider";
import { getAuthSession } from "../../../../src/http/session/auth-session";
import { getEnv } from "../../../../src/http/env";
import * as fetchModule from "../../../../src/fetch";

jest.mock("../../../../src/http/session/auth-session");
jest.mock("../../../../src/http/env");
jest.mock("../../../../src/fetch");
jest.mock("../../../../src/logger");

const mockGetAuthSession = getAuthSession as jest.MockedFunction<
  typeof getAuthSession
>;
const mockGetEnv = getEnv as jest.MockedFunction<typeof getEnv>;
const mockFetch = fetchModule.default as jest.MockedFunction<typeof fetchModule.default>;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset singleton instance
  (TestOAuthProvider as any).instance = null;
});

class TestOAuthProvider extends OAuthProvider {
  protected providerName = "test";
  protected config = {
    authUrl: "https://test.com/auth",
    deviceUrl: "https://test.com/device",
    tokenUrl: "https://test.com/token",
    userInfoUrl: "https://test.com/userinfo",
    scopes: ["read", "write"],
  };

  static getInstance(): OAuthProvider {
    if (!TestOAuthProvider.instance) {
      TestOAuthProvider.instance = new TestOAuthProvider();
    }
    return TestOAuthProvider.instance;
  }

  protected async fetchUserInfo(accessTokenString: string) {
    // Mock implementation for testing
    return {
      type: "oauth" as const,
      ttl: 3600,
      username: "testuser",
      email: "test@example.com",
    };
  }

  protected async buildTokenParams(deviceCode: string) {
    return { device_code: deviceCode, grant_type: "device_code" };
  }

  protected validateDevicePollingResponse() {
    return true;
  }
}

test("should create OAuthProvider instance", () => {
  const mockAuthSession = { get: jest.fn(), set: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = TestOAuthProvider.getInstance();
  expect(provider).toBeInstanceOf(OAuthProvider);
});

test("should authenticate with cached user info", async () => {
  const mockUserInfo = {
    type: "oauth" as const,
    ttl: 3600,
    username: "testuser",
    email: "test@example.com",
  };
  const mockWpUser = { id: 1, user_email: "test@example.com" };
  const mockAuthSession = {
    get: jest.fn().mockResolvedValue(mockUserInfo),
    set: jest.fn(),
  };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const mockWp = {
    utils: {
      user: {
        get: jest.fn().mockResolvedValue({ props: mockWpUser }),
      },
    },
  } as any;

  const provider = TestOAuthProvider.getInstance();
  const result = await provider.authenticate(mockWp, "token123");

  expect(result).toEqual(mockWpUser);
  expect(mockAuthSession.get).toHaveBeenCalledWith("oauth", "token123");
});

test("should return undefined when user has no email", async () => {
  const mockUserInfo = {
    type: "oauth" as const,
    ttl: 3600,
    username: "testuser",
    // No email field
  };
  const mockAuthSession = {
    get: jest.fn().mockResolvedValue(null), // No cached user info
    set: jest.fn(),
  };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = TestOAuthProvider.getInstance();

  // Spy on fetchUserInfo to return user info without email
  jest.spyOn(provider as any, 'fetchUserInfo').mockResolvedValue(mockUserInfo);

  const result = await provider.authenticate({} as any, "token123");

  expect(result).toBeUndefined();
});

test("should request device code successfully", async () => {
  const mockDeviceCode = {
    device_code: "device123",
    user_code: "USER123",
    verification_uri: "https://test.com/verify",
    interval: 5,
  };
  mockGetEnv.mockReturnValue({ clientId: "client123" } as any);
  mockFetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(mockDeviceCode),
  } as any);

  const mockAuthSession = { get: jest.fn(), set: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = TestOAuthProvider.getInstance();
  const result = await provider.requestDeviceCode();

  expect(result).toEqual(mockDeviceCode);
  expect(mockFetch).toHaveBeenCalledWith(
    "https://test.com/device",
    expect.objectContaining({ method: "POST" })
  );
});

test("should throw error when requesting device code without client ID", async () => {
  mockGetEnv.mockReturnValue({} as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = TestOAuthProvider.getInstance();

  await expect(provider.requestDeviceCode()).rejects.toThrow(
    "Client ID is not set"
  );
});

test("should check if token is expired", () => {
  const mockAuthSession = { get: jest.fn(), set: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = TestOAuthProvider.getInstance();
  const futureToken = {
    access_token: "token",
    expires_at: Date.now() + 10 * 60 * 1000,
    token_type: "Bearer",
  };
  const expiredToken = {
    access_token: "token",
    expires_at: Date.now() - 1000,
    token_type: "Bearer",
  };

  expect(provider.isTokenExpired(futureToken)).toBe(false);
  expect(provider.isTokenExpired(expiredToken)).toBe(true);
});

test("should store token in auth session", async () => {
  const mockAuthSession = {
    get: jest.fn(),
    set: jest.fn(),
  };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = TestOAuthProvider.getInstance();
  const accessToken = {
    access_token: "token123",
    expires_at: Date.now() + 3600000,
    token_type: "Bearer",
  };
  const userInfo = {
    type: "oauth" as const,
    ttl: 3600,
    username: "testuser",
    email: "test@example.com",
  };

  await provider.storeToken(accessToken, userInfo);

  expect(mockAuthSession.set).toHaveBeenCalledWith(
    "oauth",
    "token123",
    userInfo,
    expect.any(Number)
  );
});
