import * as vals from "../validators";
import { getConfig } from "../proxy/config";
import { z } from "zod";

export type GetConfig = Awaited<ReturnType<typeof getConfig>>;
export type ProxyConfig = z.infer<typeof vals.proxyConfig>;
export type JsonRpcRequest = z.infer<typeof vals.jsonRpcRequest>;
export type JsonRpcResponse = z.infer<typeof vals.jsonRpcResponse>;
export type JsonRpcError = z.infer<typeof vals.jsonRpcError>;
