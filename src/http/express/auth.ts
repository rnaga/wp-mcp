// POST /auth/device/start
import express from "express";

import Application from "@rnaga/wp-node/application";

import { logger } from "../../logger";
import { PasswordProvider } from "../auth/password-provider";
import { getOAuthProvider } from "../auth/providers";

export const useDeviceAuth = (app: express.Express) => {
  app.post("/auth/device/start", async (req, res) => {
    const provider = getOAuthProvider();

    const response = await provider?.requestDeviceCode();
    if (!response) {
      res.status(401).json({ error: "OAuth provider not configured" });
      return;
    }

    logger.debug("Device code response:", response);

    res.json(response);
  });

  // POST /auth/device/poll
  app.post("/auth/device/poll", async (req, res) => {
    logger.debug("Polling for device token with body:", req.body);
    const { device_code } = req.body;

    if (!device_code) {
      res.status(400).json({ error: "Missing device_code in request body" });
      return;
    }

    const provider = getOAuthProvider();

    try {
      const tokenResponse = await provider?.pollForDeviceToken(device_code);
      if (!tokenResponse) {
        res.status(401).json({ error: "OAuth provider not configured" });
        return;
      }

      logger.debug("Token response:", tokenResponse);

      res.json(tokenResponse);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /auth/revoke
  app.post("/auth/revoke", async (req, res) => {
    logger.debug("Revoking token with body:", req.body);
    const { access_token } = req.body;

    if (!access_token) {
      res.status(400).json({ error: "Missing access_token in request body" });
      return;
    }

    const provider = getOAuthProvider();

    try {
      const success = await provider?.revokeToken(access_token);
      if (!success) {
        res.status(400).json({ error: "Failed to revoke token" });
        return;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get user info
  app.get("/auth/userinfo", async (req, res) => {
    const wp = req.wp;
    const authHeader = req.headers.authorization;
    if (
      !authHeader ||
      (!authHeader.startsWith("Bearer ") && !authHeader.startsWith("Basic "))
    ) {
      res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const accessToken = authHeader.substring("Bearer ".length);

    const provider = getOAuthProvider();

    const wpUser = await provider?.authenticate(wp, accessToken);

    // return response
    if (!wpUser) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    res.json(wpUser);
  });

  // Refresh token endpoint (if needed)
  app.post("/auth/refresh", async (req, res) => {
    const { refresh_token: refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: "Missing refresh_token in request body" });
      return;
    }

    const provider = getOAuthProvider();

    try {
      const newToken = await provider?.refreshToken(refreshToken);
      if (!newToken) {
        res.status(401).json({ error: "OAuth provider not configured" });
        return;
      }

      logger.debug("Refreshed token response:", newToken);

      res.json(newToken);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Endpoint to get user by username and password (for testing)
  app.post("/auth/password", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res
        .status(400)
        .json({ error: "Missing username or password in request body" });
      return;
    }

    const provider = new PasswordProvider();

    // Initialize application context
    const wp = await Application.getContext();

    const user = await provider.authenticate(wp, username, password);
    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    res.json({ user });
  });
};
