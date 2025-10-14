import { z } from "zod";

const remoteOauthSchema = z.object({
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_at: z.number().optional(),
});

const remotePasswordSchema = z.object({
  username: z.string().min(2).max(100),
  password: z.string().min(6).max(100),
});

const remoteSchema = z.object({
  auth_url: z.string().optional(),
  token_type: z.enum(["bearer", "basic"]).optional(),
  oauth: remoteOauthSchema.optional(),
  password: remotePasswordSchema.optional(),
});

const localSchema = z.object({
  db_host: z.string().min(2).max(100),
  db_port: z.number().min(1).max(65535).optional(),
  db_name: z.string().min(2).max(100),
  db_user: z.string().min(2).max(100),
  db_password: z.string().min(1),
  db_environment: z.enum(["development", "production"]).default("development"),
  multisite: z.boolean().optional().default(false),
  default_blog_id: z.union([z.string(), z.number()]).optional().default("1"),
  default_site_id: z.union([z.string(), z.number()]).optional().default("1"),
  ssl_enabled: z.boolean().optional().default(false),
  ssl_ca: z.string().optional(),
  ssl_cert: z.string().optional(),
  ssl_key: z.string().optional(),
});

export const secretValidator = z.object({
  remote: remoteSchema.optional(),
  local: localSchema.optional(),
});
