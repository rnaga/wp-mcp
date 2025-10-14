import { getEnv } from "./env";

export const checkSecureUrl = (url?: string): void => {
  const env = getEnv();

  const allowedHostnames = ["localhost", "127.0.0.1", ...env.allowedHostnames];

  if (!url) {
    throw new Error("URL is not defined");
  }

  const secureUrl = new URL(url);

  // RFC 9728 (OAuth 2.0 Protected Resource Metadata) requires HTTPS for all URLs (Section 7.1),
  // with no localhost exemption specified. This implementation allows localhost for ease of testing.
  if (
    secureUrl.protocol !== "https:" &&
    !allowedHostnames.includes(secureUrl.hostname)
  ) {
    throw new Error("Secure URL must be HTTPS");
  }
  if (secureUrl.hash) {
    throw new Error(`Secure URL must not have a fragment: ${secureUrl}`);
  }
  if (secureUrl.search) {
    throw new Error(`Secure URL must not have a query string: ${secureUrl}`);
  }
};
