import { GitHubProvider } from "../../../../../src/http/auth/providers/github-provider";
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

test("GitHubProvider - should create instance with correct config", () => {
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new GitHubProvider();

  expect(provider).toBeInstanceOf(GitHubProvider);
});

test("GitHubProvider - should fetch user info and cache it", async () => {
  const mockUserData = {
    email: "user@github.com",
    login: "testuser",
    name: "Test User",
    ttl: 7200,
  };
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);
  mockFetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(mockUserData),
  } as any);

  const provider = new GitHubProvider();
  const result = await (provider as any).fetchUserInfo("token123");

  expect(result).toEqual({
    type: "oauth",
    email: "user@github.com",
    username: "testuser",
    name: "Test User",
    ttl: 7200,
  });
  expect(mockAuthSession.set).toHaveBeenCalledWith(
    "oauth",
    "token123",
    expect.objectContaining({ email: "user@github.com" }),
    7200
  );
});

test("GitHubProvider - should throw error when fetch fails", async () => {
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);
  mockFetch.mockResolvedValue({
    ok: false,
    status: 401,
  } as any);

  const provider = new GitHubProvider();

  await expect((provider as any).fetchUserInfo("invalid-token")).rejects.toThrow(
    "Failed to fetch user info"
  );
});

test("GitHubProvider - should build token params with client id", async () => {
  mockGetEnv.mockReturnValue({
    clientId: "github-client-id",
  } as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new GitHubProvider();
  const params = await (provider as any).buildTokenParams("device123");

  expect(params).toEqual({
    client_id: "github-client-id",
    device_code: "device123",
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
});

test("GitHubProvider - should throw error when missing client id", async () => {
  mockGetEnv.mockReturnValue({} as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new GitHubProvider();

  await expect((provider as any).buildTokenParams("device123")).rejects.toThrow(
    "Missing client ID for GitHub"
  );
});

test("GitHubProvider - should validate device polling response correctly", () => {
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new GitHubProvider();
  const validResponse = { status: 200 } as any;
  const invalidResponse = { status: 400 } as any;
  const tokenBody = { access_token: "token123" };
  const emptyBody = {};

  expect(
    (provider as any).validateDevicePollingResponse(validResponse, tokenBody)
  ).toBe(true);
  expect(
    (provider as any).validateDevicePollingResponse(invalidResponse, tokenBody)
  ).toBe(false);
  expect(
    (provider as any).validateDevicePollingResponse(validResponse, emptyBody)
  ).toBe(false);
});

test("GitHubProvider - should revoke token successfully", async () => {
  mockGetEnv.mockReturnValue({
    clientId: "github-client-id",
    clientSecret: "github-client-secret",
  } as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);
  mockFetch.mockResolvedValue({
    status: 204,
    text: jest.fn().mockResolvedValue(""),
  } as any);

  const provider = new GitHubProvider();
  const result = await (provider as any).fetchRevoke("token123");

  expect(result).toBe(true);
  expect(mockAuthSession.remove).toHaveBeenCalledWith("oauth", "token123");
});

test("GitHubProvider - should throw error when revoking without client id", async () => {
  mockGetEnv.mockReturnValue({} as any);
  const mockAuthSession = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new GitHubProvider();

  await expect((provider as any).fetchRevoke("token123")).rejects.toThrow(
    "Missing client ID for GitHub"
  );
});
