import { Auth0Provider } from "../../../../../src/http/auth/providers/auth0-provider";
import { getAuthSession } from "../../../../../src/http/session/auth-session";
import { getEnv } from "../../../../../src/http/env";
import fetch from "node-fetch";

jest.mock("../../../../../src/http/session/auth-session");
jest.mock("../../../../../src/http/env");
jest.mock("node-fetch");
jest.mock("../../../../../src/logger");

const mockGetAuthSession = getAuthSession as jest.MockedFunction<
  typeof getAuthSession
>;
const mockGetEnv = getEnv as jest.MockedFunction<typeof getEnv>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  jest.clearAllMocks();
});

test("Auth0Provider - should create instance and replace AUTH_DOMAIN", () => {
  mockGetEnv.mockReturnValue({ authDomain: "example.auth0.com" } as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new Auth0Provider();

  expect(provider).toBeInstanceOf(Auth0Provider);
});

test("Auth0Provider - should throw error when AUTH_DOMAIN is missing", () => {
  mockGetEnv.mockReturnValue({} as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  expect(() => new Auth0Provider()).toThrow(
    "Missing AUTH_DOMAIN environment variable"
  );
});

test("Auth0Provider - should fetch user info and cache it", async () => {
  mockGetEnv.mockReturnValue({ authDomain: "example.auth0.com" } as any);
  const mockUserData = {
    email: "user@example.com",
    name: "Test User",
    expires_in: 3600,
  };
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);
  mockFetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(mockUserData),
  } as any);

  const provider = new Auth0Provider();
  const result = await (provider as any).fetchUserInfo("token123");

  expect(result).toEqual({
    type: "oauth",
    email: "user@example.com",
    username: "Test User",
    name: "Test User",
    ttl: 3600,
  });
  expect(mockAuthSession.set).toHaveBeenCalledWith(
    "oauth",
    "token123",
    expect.objectContaining({ email: "user@example.com" }),
    3600
  );
});

test("Auth0Provider - should build token params with client credentials", async () => {
  mockGetEnv.mockReturnValue({
    authDomain: "example.auth0.com",
    clientId: "auth0-client-id",
    clientSecret: "auth0-client-secret",
  } as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new Auth0Provider();
  const params = await (provider as any).buildTokenParams("device123");

  expect(params).toEqual({
    client_id: "auth0-client-id",
    client_secret: "auth0-client-secret",
    device_code: "device123",
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
});

test("Auth0Provider - should throw error when missing credentials", async () => {
  mockGetEnv.mockReturnValue({ authDomain: "example.auth0.com" } as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new Auth0Provider();

  await expect((provider as any).buildTokenParams("device123")).rejects.toThrow(
    "Missing client ID or client secret for Google"
  );
});

test("Auth0Provider - should validate device polling response correctly", () => {
  mockGetEnv.mockReturnValue({ authDomain: "example.auth0.com" } as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new Auth0Provider();
  const validResponse = { status: 200 } as any;
  const pendingResponse400 = { status: 400 } as any;
  const pendingResponse428 = { status: 428 } as any;
  const tokenBody = { access_token: "token123" };
  const emptyBody = {};

  expect(
    (provider as any).validateDevicePollingResponse(validResponse, tokenBody)
  ).toBe(true);
  expect(
    (provider as any).validateDevicePollingResponse(
      pendingResponse400,
      tokenBody
    )
  ).toBe(true);
  expect(
    (provider as any).validateDevicePollingResponse(
      pendingResponse428,
      tokenBody
    )
  ).toBe(true);
  expect(
    (provider as any).validateDevicePollingResponse(validResponse, emptyBody)
  ).toBe(false);
});

test("Auth0Provider - should revoke token successfully", async () => {
  mockGetEnv.mockReturnValue({ authDomain: "example.auth0.com" } as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);
  mockFetch.mockResolvedValue({
    status: 200,
    text: jest.fn().mockResolvedValue(""),
  } as any);

  const provider = new Auth0Provider();
  const result = await (provider as any).fetchRevoke("token123");

  expect(result).toBe(true);
  expect(mockAuthSession.remove).toHaveBeenCalledWith("oauth", "token123");
});
