import type { Response } from "../../../fetch";

import { AccessToken, UserInfo } from "@rnaga/wp-mcp/types";

import { logger } from "../../../logger";
import { getEnv } from "../../env";
import { OAuthProvider } from "../oauth-provider";

import type * as types from "../../../types";

export class Auth0Provider extends OAuthProvider {
  protected providerName = "google";
  protected config = {
    authUrl: "https://AUTH_DOMAIN/authorize",
    tokenUrl: "https://AUTH_DOMAIN/oauth/token",
    deviceUrl: "https://AUTH_DOMAIN/oauth/device/code",
    revokeUrl: "https://AUTH_DOMAIN/oauth/revoke",
    userInfoUrl: "https://AUTH_DOMAIN/userinfo",
    scopes: ["openid", "email", "profile"],
  };

  static getInstance(): OAuthProvider {
    if (!Auth0Provider.instance) {
      try {
        Auth0Provider.instance = new Auth0Provider();
      } catch (error) {
        // Reset instance on error so subsequent calls will retry
        Auth0Provider.instance = null as any;
        throw error;
      }
    }
    return Auth0Provider.instance;
  }

  private constructor() {
    super();

    const env = getEnv();
    if (!env.authDomain) {
      throw new Error("Missing AUTH_DOMAIN environment variable");
    }

    // Check domain and throw error if it doesn't contain "auth0.com"
    if (!env.authDomain.includes("auth0.com")) {
      throw new Error("AUTH_DOMAIN must be an Auth0 domain");
    }

    // Replace AUTH_DOMAIN in URLs
    for (const key of [
      "authUrl",
      "tokenUrl",
      "deviceUrl",
      "revokeUrl",
      "userInfoUrl",
    ]) {
      const url = (this.config as any)[key] as string;
      (this.config as any)[key] = url.replace("AUTH_DOMAIN", env.authDomain!);
    }
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
    logger.debug("Auth0 user data:", data, response);

    const userInfo: UserInfo = {
      type: "oauth",
      email: data.email,
      username: data.name,
      name: data.name,
      ttl: 3600,
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
        `Missing client ID or client secret for Auth0. Set CLIENT_ID and CLIENT_SECRET environment variables.`
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

    return result.status === 200;
  }
}
