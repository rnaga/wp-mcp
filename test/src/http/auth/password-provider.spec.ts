import { PasswordProvider } from "../../../../src/http/auth/password-provider";
import { getAuthSession } from "../../../../src/http/session/auth-session";

jest.mock("../../../../src/http/session/auth-session");

const mockGetAuthSession = getAuthSession as jest.MockedFunction<
  typeof getAuthSession
>;

test("should create PasswordProvider instance", () => {
  const mockAuthSession = {
    get: jest.fn(),
    set: jest.fn(),
  };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new PasswordProvider();
  expect(provider).toBeInstanceOf(PasswordProvider);
});

test("should return cached user when session exists", async () => {
  const mockUser = { id: 1, user_login: "testuser" };
  const mockAuthSession = {
    get: jest.fn().mockResolvedValue({ type: "password", user: mockUser }),
    set: jest.fn(),
  };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const provider = new PasswordProvider();
  const mockWp = {} as any;

  const result = await provider.authenticate(mockWp, "testuser", "password123");

  expect(result).toEqual(mockUser);
  expect(mockAuthSession.get).toHaveBeenCalledWith(
    "password",
    "testuser:password123"
  );
});

test("should authenticate and cache user when session does not exist", async () => {
  const mockUser = { id: 1, user_login: "testuser" };
  const mockAuthSession = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
  };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const mockWp = {
    utils: {
      applicationPasswords: {
        authenticate: jest.fn().mockResolvedValue({ props: mockUser }),
      },
    },
  } as any;

  const provider = new PasswordProvider();
  const result = await provider.authenticate(mockWp, "testuser", "password123");

  expect(result).toEqual(mockUser);
  expect(mockAuthSession.set).toHaveBeenCalledWith(
    "password",
    "testuser:password123",
    { type: "password", user: mockUser },
    600
  );
});

test("should return undefined when authentication fails", async () => {
  const mockAuthSession = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
  };
  mockGetAuthSession.mockReturnValue(mockAuthSession as any);

  const mockWp = {
    utils: {
      applicationPasswords: {
        authenticate: jest.fn().mockResolvedValue(null),
      },
    },
  } as any;

  const provider = new PasswordProvider();
  const result = await provider.authenticate(mockWp, "testuser", "wrongpass");

  expect(result).toBeUndefined();
  expect(mockAuthSession.set).not.toHaveBeenCalled();
});
