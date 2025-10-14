// Mock dependencies before imports
jest.mock("node-fetch");
jest.mock("@rnaga/wp-node/application");
jest.mock("../../../../src/logger");
jest.mock("../../../../src/http/auth/password-provider");
jest.mock("../../../../src/http/auth/providers");
jest.mock("../../../../src/http/auth/oauth-provider");

import express from "express";
import request from "supertest";
import { useDeviceAuth } from "../../../../src/http/express/auth";
import Application from "@rnaga/wp-node/application";
import { PasswordProvider } from "../../../../src/http/auth/password-provider";
import { getOAuthProvider } from "../../../../src/http/auth/providers";

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.wp = {} as any;
    next();
  });
  useDeviceAuth(app);
  return app;
};

test("should start device auth and return device code", async () => {
  const mockProvider = {
    requestDeviceCode: jest.fn().mockResolvedValue({
      device_code: "device123",
      user_code: "USER123",
    }),
  };
  (getOAuthProvider as jest.Mock).mockReturnValue(mockProvider);

  const app = createApp();
  const response = await request(app).post("/auth/device/start");

  expect(mockProvider.requestDeviceCode).toHaveBeenCalled();
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    device_code: "device123",
    user_code: "USER123",
  });
});

test("should return 401 when OAuth provider not configured for device start", async () => {
  (getOAuthProvider as jest.Mock).mockReturnValue(null);

  const app = createApp();
  const response = await request(app).post("/auth/device/start");

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: "OAuth provider not configured" });
});

test("should poll for device token successfully", async () => {
  const mockProvider = {
    pollForDeviceToken: jest.fn().mockResolvedValue({
      access_token: "token123",
    }),
  };
  (getOAuthProvider as jest.Mock).mockReturnValue(mockProvider);

  const app = createApp();
  const response = await request(app)
    .post("/auth/device/poll")
    .send({ device_code: "device123" });

  expect(mockProvider.pollForDeviceToken).toHaveBeenCalledWith("device123");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ access_token: "token123" });
});

test("should return 400 when device_code is missing in poll", async () => {
  const app = createApp();
  const response = await request(app).post("/auth/device/poll").send({});

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ error: "Missing device_code in request body" });
});

test("should revoke token successfully", async () => {
  const mockProvider = {
    revokeToken: jest.fn().mockResolvedValue(true),
  };
  (getOAuthProvider as jest.Mock).mockReturnValue(mockProvider);

  const app = createApp();
  const response = await request(app)
    .post("/auth/revoke")
    .send({ access_token: "token123" });

  expect(mockProvider.revokeToken).toHaveBeenCalledWith("token123");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ success: true });
});

test("should return 400 when access_token is missing in revoke", async () => {
  const app = createApp();
  const response = await request(app).post("/auth/revoke").send({});

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ error: "Missing access_token in request body" });
});

test("should get user info with valid token", async () => {
  const mockProvider = {
    authenticate: jest.fn().mockResolvedValue({ id: 1, username: "testuser" }),
  };
  (getOAuthProvider as jest.Mock).mockReturnValue(mockProvider);

  const app = createApp();
  const response = await request(app)
    .get("/auth/userinfo")
    .set("Authorization", "Bearer token123");

  expect(mockProvider.authenticate).toHaveBeenCalledWith({}, "token123");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ id: 1, username: "testuser" });
});

test("should return 401 when authorization header is missing", async () => {
  const app = createApp();
  const response = await request(app).get("/auth/userinfo");

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: "Missing or invalid Authorization header" });
});

test("should refresh token successfully", async () => {
  const mockProvider = {
    refreshToken: jest.fn().mockResolvedValue({ access_token: "newtoken123" }),
  };
  (getOAuthProvider as jest.Mock).mockReturnValue(mockProvider);

  const app = createApp();
  const response = await request(app)
    .post("/auth/refresh")
    .send({ refresh_token: "refresh123" });

  expect(mockProvider.refreshToken).toHaveBeenCalledWith("refresh123");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ access_token: "newtoken123" });
});

test("should authenticate with password successfully", async () => {
  const mockUser = { id: 1, username: "testuser" };
  (PasswordProvider as jest.Mock).mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue(mockUser),
  }));
  (Application.getContext as jest.Mock).mockResolvedValue({});

  const app = createApp();
  const response = await request(app)
    .post("/auth/password")
    .send({ username: "testuser", password: "password123" });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ user: mockUser });
});

test("should return 400 when username or password is missing", async () => {
  const app = createApp();
  const response = await request(app)
    .post("/auth/password")
    .send({ username: "testuser" });

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ error: "Missing username or password in request body" });
});
