import { GoogleProvider } from "../../../../../src/http/auth/providers/google-provider";
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

test("GoogleProvider - should create instance with correct config", () => {
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = GoogleProvider.getInstance();

  expect(provider).toBeInstanceOf(GoogleProvider);
});

test("GoogleProvider - should fetch user info and cache it", async () => {
  const mockUserData = {
    email: "user@google.com",
    name: "Test User",
    expires_in: 3600,
  };
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);
  mockFetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(mockUserData),
  } as any);

  const provider = GoogleProvider.getInstance();
  const result = await (provider as any).fetchUserInfo("token123");

  expect(result).toEqual({
    type: "oauth",
    email: "user@google.com",
    username: "user@google.com",
    name: "Test User",
    ttl: 3600,
  });
  // fetchUserInfo should NOT call authSession.set directly
  // The base class authenticate() method handles caching via storeToken()
  expect(mockAuthSession.set).not.toHaveBeenCalled();
});

test("GoogleProvider - should build token params with client credentials", async () => {
  mockGetEnv.mockReturnValue({
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
  } as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = GoogleProvider.getInstance();
  const params = await (provider as any).buildTokenParams("device123");

  expect(params).toEqual({
    client_id: "google-client-id",
    client_secret: "google-client-secret",
    device_code: "device123",
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
});

test("GoogleProvider - should throw error when missing credentials", async () => {
  mockGetEnv.mockReturnValue({} as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = GoogleProvider.getInstance();

  await expect((provider as any).buildTokenParams("device123")).rejects.toThrow(
    "Missing client ID or client secret for Google"
  );
});

test("GoogleProvider - should validate device polling response correctly", () => {
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = GoogleProvider.getInstance();
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

test("GoogleProvider - should revoke token successfully", async () => {
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);
  mockFetch.mockResolvedValue({
    status: 200,
    text: jest.fn().mockResolvedValue(""),
  } as any);

  const provider = GoogleProvider.getInstance();
  const result = await (provider as any).fetchRevoke("token123");

  expect(result).toBe(true);
  // fetchRevoke should NOT call authSession.remove directly
  // The base class revokeToken() method handles removing from cache
  expect(mockAuthSession.remove).not.toHaveBeenCalled();
});
