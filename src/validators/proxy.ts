import { z } from "zod";

// Configuration schema with Zod validation
export const proxyConfig = z.object({
  remoteUrl: z.string().url("Must be a valid URL").optional(),
  authType: z.enum(["oauth", "password"]).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  // Accept either a JSON string or an object for customHeaders
  customHeaders: z
    .union([z.string(), z.record(z.string(), z.string())])
    .transform((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return undefined;
        }
      }
      return val;
    })
    .optional(),
});

// Zod schemas for JSON-RPC structures
export const jsonRpcError = z.object({
  message: z.string().optional(),
  code: z.number().optional(),
});

export const jsonRpcResponse = z.object({
  jsonrpc: z.string(),
  id: z.number(),
  result: z.any().optional(),
  error: jsonRpcError.optional(),
});

export const jsonRpcRequest = z.object({
  jsonrpc: z.string(),
  id: z.number(),
  method: z.string(),
  params: z.any().optional(),
});
