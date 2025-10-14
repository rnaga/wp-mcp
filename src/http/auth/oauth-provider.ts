import { Context } from "@rnaga/wp-node/core/context";

import fetch, { Response } from "../../fetch";
import { logger } from "../../logger";
import * as vals from "../../validators";
import { getEnv } from "../env";
import { AuthSession, getAuthSession } from "../session/auth-session";

import type * as types from "../../types";
import type * as wpCoreTypes from "@rnaga/wp-node/types";

export abstract class OAuthProvider {
  protected abstract providerName: string;
  protected abstract config: types.ProviderConfig;
  protected authSessions: AuthSession;

  protected static instance: OAuthProvider;

  protected constructor() {
    this.authSessions = getAuthSession();
  }

  protected async fetchUserInfo(
    accessTokenString: string
  ): Promise<types.UserInfo<"oauth"> | undefined> {
    throw new Error("fetchUserInfo not implemented for this provider");
  }

  protected async fetchRevoke(accessTokenString: string): Promise<boolean> {
    throw new Error("Revoke not implemented for this provider");
  }

  protected static getInstance(): OAuthProvider {
    throw new Error("getInstance must be implemented by subclass");
  }

  async authenticate(
    wp: Context,
    accessTokenString: string
  ): Promise<wpCoreTypes.WpUsers | undefined> {
    const sessionUserInfo = (await this.authSessions.get(
      "oauth",
      accessTokenString
    )) as types.UserInfo | null;

    const userInfo =
      sessionUserInfo || (await this.fetchUserInfo(accessTokenString));

    if (!userInfo || userInfo.type !== "oauth") {
      return undefined;
    }

    // Get WP User via WP Context

    // Only allow login with email for now
    if (!userInfo.email) {
      logger.debug("No email found in user info:", userInfo);
      return undefined;
    }

    logger.debug("Looking up user by email:", userInfo.email);
    const wpUser = await wp.utils.user.get(userInfo.email);

    if (!wpUser?.props) {
      logger.debug("User not found for info:", userInfo);
      return undefined;
    }

    return wpUser.props;
  }

  async requestDeviceCode(): Promise<types.DeviceCodeResponse> {
    const env = getEnv();

    if (!env.clientId) {
      throw new Error("Client ID is not set");
    }
    const response = await fetch(this.config.deviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: env.clientId,
        scope: this.config.scopes.join(" "),
      }),
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

  async pollForDeviceToken(deviceCode: string): Promise<types.TokenData> {
    const tokenParams = await this.buildTokenParams(deviceCode);

    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(tokenParams),
    });

    const rawResponse = await response.json();

    logger.debug("Raw token response:", rawResponse);

    const tokenResponse = vals.oauthTokenResponse.safeParse(rawResponse);

    if (!tokenResponse.success) {
      throw new Error(`Token request failed: ${JSON.stringify(tokenResponse)}`);
    }

    const isValid = this.validateDevicePollingResponse(
      response,
      tokenResponse.data
    );

    logger.debug("Is valid polling response:", response.status, isValid);

    return {
      success: isValid,
      data: tokenResponse.data,
    };
  }

  protected abstract buildTokenParams(
    deviceCode: string
  ): Promise<Record<string, string>>;

  protected abstract validateDevicePollingResponse(
    response: Response,
    body: types.TokenResponse
  ): boolean;

  async refreshToken(refreshToken: string): Promise<types.AccessToken> {
    const tokenParams = await this.buildRefreshTokenParams(refreshToken);

    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!response.ok) {
      throw new Error(
        `Token refresh failed: ${response.status} ${response.statusText}`
      );
    }

    const tokenData: types.TokenResponse =
      (await response.json()) as types.TokenResponse;

    if (!tokenData.access_token) {
      throw new Error(
        `Token refresh failed: ${tokenData.error} - ${tokenData.error_description}`
      );
    }

    const accessToken: types.AccessToken = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
      token_type: tokenData.token_type || "Bearer",
    };

    return accessToken;
  }

  protected async buildRefreshTokenParams(
    refreshToken: string
  ): Promise<Record<string, string>> {
    const env = getEnv();
    const clientId = env?.clientId;
    const clientSecret = env?.clientSecret;

    if (!clientId || !clientSecret) {
      throw new Error("Client ID is not set");
    }

    return {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      ...(clientSecret && {
        client_secret: clientSecret,
      }),
    };
  }

  async storeToken(
    accessToken: types.AccessToken,
    userInfo: types.UserInfo
  ): Promise<void> {
    // Calculate TTL for cache based on expiry
    let ttl: number | undefined = undefined;
    if (accessToken.expires_at) {
      const expiresInMs = accessToken.expires_at - Date.now();
      ttl = Math.floor(expiresInMs / 1000); // Convert to seconds
    }

    const identifier = accessToken.access_token;
    await this.authSessions.set("oauth", identifier, userInfo, ttl);
  }

  isTokenExpired(token: types.AccessToken): boolean {
    // Add 5 minute buffer before actual expiry
    const bufferMs = 5 * 60 * 1000;
    return Date.now() >= token.expires_at - bufferMs;
  }

  async revokeToken(accessTokenString: string): Promise<void> {
    logger.info("🚀 Revoking token...", accessTokenString);
    // Call provider-specific revoke endpoint if available
    const result = await this.fetchRevoke(accessTokenString);

    await this.authSessions.remove("oauth", accessTokenString);
  }
}
