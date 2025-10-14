import { logger } from "../../../logger";
import { OAuthProvider } from "../oauth-provider";
import { Auth0Provider } from "./auth0-provider";
import { GitHubProvider } from "./github-provider";
import { GoogleProvider } from "./google-provider";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

export const oauthProviders = {
  GitHubProvider,
  GoogleProvider,
  Auth0Provider,
} as const;

// Use a single auth provider for simplicity. To support multiple identity providers,
// use an authentication server like Keycloak, Auth0, or similar services.
let oauthProvider: OAuthProvider | null = null;

export const initializeOAuthProvider = (provider?: typeof OAuthProvider) => {
  if (!provider || !(provider.prototype instanceof OAuthProvider)) {
    logger.warn("No OAuth provider configured");
    return undefined;
  }

  logger.info(`Using OAuth provider: ${provider.name}`);
  oauthProvider = (provider as any).getInstance();
};

export const getOAuthProvider = (): OAuthProvider | undefined => {
  if (!oauthProvider) {
    logger.warn("No OAuth provider configured");
    return undefined;
  }
  return oauthProvider;
};
