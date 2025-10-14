import { getProtectedResourceMetadata } from "@rnaga/wp-mcp/http/auth/oauth-metadata";

beforeEach(() => {
  jest.resetModules();

  process.env.ALLOWED_ISSUER_HOSTNAMES = "test.localhost";

  process.env.OAUTH_ISSUER_URL = "http://test.localhost/";
  process.env.OAUTH_RESOURCE_URL = "http://test.localhost/resource";
  process.env.OAUTH_RESOURCE_NAME = "test-resource";
  process.env.OAUTH_SCOPES_SUPPORTED = "profile,openid,email";
  process.env.OAUTH_SERVICE_DOCUMENTATION_URL = "http://test.localhost/docs";
  process.env.OAUTH_AUTHORIZATION_URL = "http://test.auth.localhost/authorize";
  process.env.OAUTH_TOKEN_URL = "http://test.localhost/token";
  process.env.OAUTH_REVOCATION_URL = "http://test.localhost/revoke";
  process.env.OAUTH_REGISTRATION_URL = "http://test.localhost/register";
  process.env.OAUTH_SCOPES_SUPPORTED = "profile,openid,email";
});

test("oauth-protected-resource-metadata", () => {
  const protectedResourceMetadata = getProtectedResourceMetadata();

  console.log(protectedResourceMetadata);
  expect(protectedResourceMetadata).toBeDefined();
  expect(protectedResourceMetadata.resource).toBe(
    "http://test.localhost/resource"
  );
  expect(protectedResourceMetadata.authorization_servers).toEqual([
    "http://test.auth.localhost/authorize",
  ]);
  expect(protectedResourceMetadata.scopes_supported).toEqual([
    "profile",
    "openid",
    "email",
  ]);
  expect(protectedResourceMetadata.resource_name).toBeDefined();
  expect(protectedResourceMetadata.resource_documentation).toBe(
    "http://test.localhost/docs"
  );
});
