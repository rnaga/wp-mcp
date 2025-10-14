import dotenv from "dotenv";
import { z } from "zod";
import * as vals from "../validators";
import { Config, StorageConfig } from "../config";

type HttpEnv = z.infer<typeof vals.httpEnv>;

const STORAGE_CONFIG: StorageConfig = {
  // NO sqlite records for http env
  sqlite: [],
  env: [
    "resourceUrl",
    "resourceName",
    "scopesSupported",
    "serviceDocumentationUrl",
    "authorizationUrl",
    "clientId",
    "clientSecret",
    "allowedCorsOrigins",
    "enableDnsRebindingProtection",
    "authDomain",
  ],
};

const ENV_VAR_MAP: Record<string, string> = {
  resourceUrl: "OAUTH_RESOURCE_URL",
  resourceName: "OAUTH_RESOURCE_NAME",
  scopesSupported: "OAUTH_SCOPES_SUPPORTED",
  serviceDocumentationUrl: "OAUTH_SERVICE_DOCUMENTATION_URL",
  authorizationUrl: "OAUTH_AUTHORIZATION_URL",
  clientId: "OAUTH_CLIENT_ID",
  clientSecret: "OAUTH_CLIENT_SECRET",
  allowedCorsOrigins: "ALLOWED_CORS_ORIGINS",
  enableDnsRebindingProtection: "ENABLE_DNS_REBINDING_PROTECTION",
  authDomain: "OAUTH_DOMAIN", // Only used if oauthProvider is auth0
};

const httpConfig = new Config<HttpEnv>({
  STORAGE_CONFIG,
  ENV_VAR_MAP,
  validator: vals.httpEnv,
  namespace: "http",
});

export const getEnv = (): HttpEnv => {
  return httpConfig.getSync();
};
