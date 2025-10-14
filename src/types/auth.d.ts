import {
  ProxyEndpoints,
  ProxyOAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";

import { CacheValue } from "./cache";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

import * as vals from "../validators";

export type ProxyOAuthServerProviderConstructorParams = ConstructorParameters<
  typeof ProxyOAuthServerProvider
>[0];

export type ProxyOAuthServerProviderFn = {
  verifyAccessToken: ProxyOAuthServerProviderConstructorParams["verifyAccessToken"];
  getClient?: ProxyOAuthServerProviderConstructorParams["getClient"];
};

export interface AccessToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type: string;
}

export type DeviceCodeResponse = z.infer<
  typeof vals.oauthTokenDeviceCodeResponse
>;

export type TokenResponse = z.infer<typeof vals.oauthTokenResponse>;

export type TokenData = {
  success: boolean;
  data: TokenResponse;
};

// {
//   device_code: string;
//   user_code: string;
//   verification_uri: string;
//   verification_uri_complete?: string;
//   verification_url?: string; // Some providers use this name
//   expires_in: number;
//   interval: number;
// };

export type UserInfo<T extends "oauth" | "password" = any> =
  | CacheValue &
      (T extends "oauth"
        ? {
            type: "oauth";
            ttl: number;
            username: string;
            email?: string;
            name?: string;
            scopes?: string[];
          }
        : {
            type: "password";
            user: wpCoreTypes.WpUsers;
          });
