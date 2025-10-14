import { z } from "zod";

export const httpEnv = z.object({
  resourceUrl: z.string().url().optional(),
  resourceName: z.string().optional(),
  scopesSupported: z
    .string()
    .optional()
    .transform((val) => val?.split(",").map((s) => s.trim())),
  serviceDocumentationUrl: z.string().url().optional(),

  authorizationUrl: z.string().url().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  allowedHostnames: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(",").map((s) => new URL(s.trim()).hostname) : []
    ),
  allowedCorsOrigins: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((s) => s.trim()) : [])),
  enableDnsRebindingProtection: z
    .string()
    .optional()
    .transform(
      (val) => val === "true" || val === "1" || val === "yes" || false
    ),
  authDomain: z.string().optional(), // Only used if oauth Provider is auth0
});
