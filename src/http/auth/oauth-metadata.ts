import { OAuthProtectedResourceMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";
import { getEnv } from "../env";

export const getProtectedResourceMetadata =
  (): OAuthProtectedResourceMetadata => {
    const env = getEnv();

    // Check if resourceUrl is set
    if (!env.resourceUrl || !env.authorizationUrl) {
      throw new Error(
        "Protected Resource Metadata cannot be generated: resourceUrl and authorizationUrl must be set in environment variables."
      );
    }

    const metadata: OAuthProtectedResourceMetadata = {
      resource: env.resourceUrl,

      authorization_servers: [env.authorizationUrl],

      scopes_supported: env.scopesSupported,
      resource_name: env.resourceName,
      resource_documentation: env.serviceDocumentationUrl,
    };

    return metadata;
  };
