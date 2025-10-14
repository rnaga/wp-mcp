import { exec } from "child_process";

import fetch from "../../fetch";
import { logger, mcpLogger } from "../../logger";
import { getSecret, saveSecret } from "../../secret-store";

import type * as types from "../../types";
import type * as wpCoreTypes from "@rnaga/wp-node/types";

export class RemoteConnector {
  private endpoints = {
    deviceStartUrl: "/auth/device/start",
    devicePollUrl: "/auth/device/poll",
    revokeUrl: "/auth/revoke",
    refreshToken: "/auth/refresh",
    password: "/auth/password",
  } as const;

  async setAuthUrl(url: string) {
    // Save it to secret store
    await saveSecret({
      remote: {
        auth_url: url,
      },
    });
  }

  async getAuthUrl(): Promise<string | undefined> {
    const secret = await getSecret();
    const authUrl = secret.remote?.auth_url;

    return authUrl;
  }

  async performDeviceFlow(): Promise<boolean> {
    logger.console.log("🚀 Starting device authorization flow...");

    try {
      // Step 1: Request device code
      const deviceAuth = await this.requestDeviceCode();

      logger.console.log("✅ Device code obtained...");

      logger.console.log("\n📱 Please visit this URL:");
      // Google uses verification_url, others use verification_uri
      logger.console.log(
        `🔗 ${deviceAuth.verification_uri || deviceAuth.verification_url}`
      );
      logger.console.log("\n🔢 And enter this code:");
      logger.console.log(`📋 ${deviceAuth.user_code}`);

      if (deviceAuth.verification_uri_complete) {
        logger.console.log("\n🎯 Or click this direct link:");
        logger.console.log(`🔗 ${deviceAuth.verification_uri_complete}`);
      }

      logger.console.log("\n⏱️  Waiting for authorization...");

      // Open browser automatically
      const urlToOpen =
        deviceAuth.verification_uri_complete ||
        deviceAuth.verification_uri ||
        deviceAuth.verification_url;
      exec(`open "${urlToOpen}"`);

      // Step 2: Poll for token
      const tokenData = await this.pollForDeviceToken(deviceAuth);

      // Examine if expires_in is present, if so, calculate expires_at
      let expiresAt = tokenData.expires_at;
      if (tokenData.expires_in) {
        expiresAt = Date.now() + tokenData.expires_in * 1000;
      }

      // Store token securely
      await this.storeToken({
        ...tokenData,
        expires_at: expiresAt,
      });

      logger.console.log(
        "✅ Authorization successful and access token stored!"
      );
      return true;
    } catch (error) {
      logger.console.error("❌ Device flow failed:", `${error}`);
      return false;
    }
  }

  private async requestDeviceCode(): Promise<types.DeviceCodeResponse> {
    const authUrl = await this.getAuthUrl();
    logger.console.log("Using auth URL:", authUrl);

    const url = new URL(this.endpoints.deviceStartUrl, authUrl).toString();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Device code request failed: ${response.status} ${response.statusText}`
      );
    }

    const data: types.DeviceCodeResponse =
      (await response.json()) as types.DeviceCodeResponse;
    return data;
  }

  private async pollForDeviceToken(
    deviceAuth: types.DeviceCodeResponse
  ): Promise<types.TokenResponse> {
    const startTime = Date.now();
    const expiresAt = startTime + deviceAuth.expires_in * 1000;
    let pollInterval = (deviceAuth.interval + 1) * 1000; // Convert to milliseconds

    const authUrl = await this.getAuthUrl();
    const url = new URL(this.endpoints.devicePollUrl, authUrl).toString();

    while (Date.now() < expiresAt) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ device_code: deviceAuth.device_code }),
      });

      logger.debug("Polling response:", response.status, response.statusText);

      const tokenData: types.TokenData =
        (await response.json()) as types.TokenData;

      if (tokenData.success) {
        return tokenData.data;
      }

      if (tokenData.data?.error === "authorization_pending") {
        // Continue polling
        continue;
      }

      if (tokenData.data?.error === "slow_down") {
        // Increase polling interval by 5 seconds
        pollInterval += 5000;
        process.stdout.write("⏳");
        continue;
      }
    }

    throw new Error("Device code expired - please try again");
  }

  private async storeToken(tokenData: types.TokenResponse): Promise<void> {
    await saveSecret({
      remote: {
        token_type: (tokenData.token_type || "Bearer") as NonNullable<
          types.Secret["remote"]
        >["token_type"],
        oauth: {
          access_token: tokenData.access_token!,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
        },
      },
    });
  }

  async revokeToken(): Promise<void> {
    try {
      const secret = await getSecret();
      const storedToken = secret.remote?.oauth;

      // Get authUrl from secret store if not set
      const authUrl = await this.getAuthUrl();
      const url = new URL(this.endpoints.revokeUrl, authUrl).toString();

      if (storedToken?.access_token) {
        logger.console.log("🚀 Revoking token...", storedToken, url);

        // Call provider-specific revoke endpoint if available
        const result = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            access_token: storedToken.access_token,
          }),
        });

        if (!result) {
          logger.console.warn(
            "⚠️  Revoke endpoint not available for this provider."
          );
          return;
        }

        // Remove oauth from secret store
        await saveSecret({
          remote: {
            auth_url: secret.remote?.auth_url,
            password: secret.remote?.password,
          },
        });
        logger.console.log("✅ Token revoked and removed from secret store");
      }
    } catch (error) {
      logger.console.error("❌ Failed to revoke token:", `${error}`);
      throw error;
    }
  }

  async performPasswordAuth(username: string, password: string) {
    logger.console.log("🚀 Performing password authentication...");

    try {
      const authUrl = await this.getAuthUrl();
      const url = new URL(this.endpoints.password, authUrl).toString();

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      logger.debug(
        "Password auth response:",
        url,
        JSON.stringify({ username, password }),
        response.status,
        response.statusText
      );

      if (!response.ok) {
        throw new Error(
          `Password authentication failed: ${response.status} ${response.statusText}`
        );
      }

      const user: wpCoreTypes.WpUsers =
        (await response.json()) as wpCoreTypes.WpUsers;

      logger.console.log("✅ Password authentication successful!");

      // Store username and password securely in secret store
      await saveSecret({
        remote: {
          password: {
            username,
            password,
          },
        },
      });

      return true;
    } catch (error) {
      logger.console.error("❌ Password authentication failed:", `${error}`);
      throw error;
    }
  }

  // Check periodically and refresh token if needed
  async checkAndRefreshToken(): Promise<void> {
    const secret = await getSecret();
    const oauth = secret.remote?.oauth;

    if (!oauth?.access_token || !oauth?.refresh_token || !oauth?.expires_at) {
      mcpLogger.warn("⚠️  No access token or refresh token available.");
      return;
    }

    const now = Date.now();
    if (oauth.expires_at - now < 5 * 60 * 1000) {
      mcpLogger.info("Access token is expiring soon, refreshing...");
      await this.refreshToken();
    } else {
      mcpLogger.debug("Access token is still valid.");
    }

    mcpLogger.debug("Next token check in 5 minutes.");

    // Set interval to check again in 5 minutes
    setTimeout(() => this.checkAndRefreshToken(), 5 * 60 * 1000);
  }

  // Called during proxy startup to check and refresh token if needed
  async refreshToken(): Promise<void> {
    mcpLogger.info("Checking and refreshing access token if needed...");
    const secret = await getSecret();

    // Check and get refresh token
    const refreshToken = secret.remote?.oauth?.refresh_token;
    if (!refreshToken) {
      mcpLogger.warn("⚠️  No refresh token available.");
      return;
    }

    const authUrl = await this.getAuthUrl();
    if (!authUrl) {
      throw new Error("Auth URL is not configured.");
    }

    mcpLogger.debug("Using auth URL:", authUrl);
    const url = new URL(this.endpoints.refreshToken, authUrl).toString();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      mcpLogger.error(
        `Token refresh failed: ${response.status} ${response.statusText}`
      );
      return;
    }

    const accessToken = (await response.json()) as types.AccessToken;

    mcpLogger.debug("Refresh token response:", response.status, accessToken);

    if (!accessToken.access_token) {
      mcpLogger.error(`Token refresh failed`);
      return;
    }

    // Update token in secret store
    await saveSecret({
      remote: {
        oauth: {
          access_token: accessToken.access_token,
          refresh_token: accessToken.refresh_token || refreshToken, // Use new refresh token if provided
          expires_at: Date.now() + (accessToken.expires_at || 3600) * 1000,
        },
      },
    });

    mcpLogger.info("✅ Access token refreshed and stored.");
  }
}
