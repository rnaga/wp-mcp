import { z } from "zod";

export const oauthTokenDeviceCodeResponse = z
  .object({
    device_code: z.string(),
    user_code: z.string(),
    verification_uri: z.string().optional(),
    verification_uri_complete: z.string().optional(),
    verification_url: z.string().optional(), // Some providers use this name
    expires_in: z.number(),
    interval: z.number(),
  })

  .transform((data) => ({
    ...data,
    verification_url: data.verification_url || data.verification_uri || "",
  }));

export const oauthTokenResponse = z.object({
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  expires_at: z.number().optional(),
  token_type: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});
