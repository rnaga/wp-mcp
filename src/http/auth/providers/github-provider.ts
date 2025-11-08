import type { Response } from "../../../fetch";

import { UserInfo } from "@rnaga/wp-mcp/types";

import { logger } from "../../../logger";
import { getEnv } from "../../env";
import { OAuthProvider } from "../oauth-provider";

import type * as types from "../../../types";

export class GitHubProvider extends OAuthProvider {
  protected providerName = "github";
  protected config = {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    deviceUrl: "https://github.com/login/device/code",
    revokeUrl: "https://api.github.com/applications/:client_id/token",
    userInfoUrl: "https://api.github.com/user",
    scopes: ["read:user", "repo"],
  };

  static getInstance(): OAuthProvider {
    if (!GitHubProvider.instance) {
      GitHubProvider.instance = new GitHubProvider();
    }
    return GitHubProvider.instance;
  }

  protected async fetchUserInfo(
    accessTokenString: string
  ): Promise<UserInfo<"oauth"> | undefined> {
    // Implement GitHub-specific token fetching logic here
    const response = await fetch(this.config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessTokenString}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user info");
    }

    const data = await response.json();
    logger.debug("GitHub user data:", data);

    const userInfo: UserInfo = {
      type: "oauth",
      email: data.email,
      username: data.login,
      name: data.name,
      ttl: data.ttl || 3600, // Example TTL, adjust as needed
    };

    this.authSessions.set(
      "oauth",
      accessTokenString,
      userInfo,
      data.ttl || 3600
    );

    return userInfo;
  }

  protected async buildTokenParams(
    deviceCode: string
  ): Promise<Record<string, string>> {
    const env = getEnv();
    const clientId = env.clientId;

    if (!clientId) {
      throw new Error(
        `Missing client ID for GitHub. Set GITHUB_CLIENT_ID environment variable.`
      );
    }

    return {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    };
  }

  protected validateDevicePollingResponse(
    response: Response,
    body: types.TokenResponse
  ): boolean {
    // GitHub accepts 400 status codes during polling
    return !!(
      response.status >= 200 &&
      response.status < 300 &&
      body.access_token
    );
  }

  protected async fetchRevoke(accessTokenString: string): Promise<boolean> {
    const env = getEnv();
    const clientId = env.clientId;
    const clientSecret = env.clientSecret;

    if (!clientId) {
      throw new Error(
        `Missing client ID for GitHub. Set GITHUB_CLIENT_ID environment variable.`
      );
    }

    const revokeUrl = this.config.revokeUrl!.replace(
      ":client_id",
      clientId || ""
    );

    const result = await fetch(revokeUrl, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret || ""}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        access_token: accessTokenString,
      }),
    });

    logger.debug("Revoke response status:", result.status, await result.text());

    return result.status === 204;
  }
}
