import type { Response } from "../../../fetch";

import { AccessToken, UserInfo } from "@rnaga/wp-mcp/types";

import { logger } from "../../../logger";
import { getEnv } from "../../env";
import { OAuthProvider } from "../oauth-provider";

import type * as types from "../../../types";

export class GoogleProvider extends OAuthProvider {
  protected providerName = "google";
  protected config = {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    deviceUrl: "https://oauth2.googleapis.com/device/code",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: ["openid", "email", "profile"],
  };

  static getInstance(): OAuthProvider {
    if (!GoogleProvider.instance) {
      GoogleProvider.instance = new GoogleProvider();
    }
    return GoogleProvider.instance;
  }

  protected async fetchUserInfo(
    accessTokenString: string
  ): Promise<UserInfo<"oauth"> | undefined> {
    const response = await fetch(this.config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessTokenString}`,
      },
    });

    const data = await response.json();
    logger.debug("Google user data:", data, response);

    const userInfo: UserInfo = {
      type: "oauth",
      email: data.email,
      username: data.email, // Google doesn't have a username field, using email
      name: data.name,
      ttl: data.expires_in || 3600, // Google uses expires_in
    };

    this.authSessions.set(
      "oauth",
      accessTokenString,
      userInfo,
      data.expires_in || 3600
    );

    return userInfo;
  }

  protected async buildTokenParams(
    deviceCode: string
  ): Promise<Record<string, string>> {
    const env = getEnv();
    const clientId = env.clientId;
    const clientSecret = env.clientSecret;

    if (!clientId || !clientSecret) {
      throw new Error(
        `Missing client ID or client secret for Google. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.`
      );
    }

    return {
      client_id: clientId,
      client_secret: clientSecret, // Google requires client secret for device flow
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    };
  }

  protected validateDevicePollingResponse(
    response: Response,
    body: types.TokenResponse
  ): boolean {
    // Google accepts 400 and 428 status codes during polling
    return !!(
      ((response.status >= 200 && response.status < 300) ||
        response.status === 400 ||
        response.status === 428) &&
      body.access_token
    );
  }

  protected async fetchRevoke(accessTokenString: string): Promise<boolean> {
    const result = await fetch(this.config.revokeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token: accessTokenString,
      }),
    });

    logger.debug("Revoke response status:", result.status, await result.text());

    // Remove token from cache
    await this.authSessions.remove("oauth", accessTokenString);

    return result.status === 200;
  }
}
