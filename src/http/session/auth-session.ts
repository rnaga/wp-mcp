import crypto from "crypto";

import { logger } from "../../logger";
import { Cache } from "../cache/cache";

import type * as types from "../../types";

export type AuthType = "oauth" | "password";

let instance: AuthSession | null = null;

export const initializeAuthSession = (clazz: typeof Cache) => {
  if (instance) {
    return instance;
  }
  // First instantiate cache class
  const cacheInstance = clazz.getInstance<types.UserInfo>();
  // Then create AuthSession with the cache instance
  instance = new AuthSession(cacheInstance);
  return instance;
};

// Helper function to create AuthSession instance
export const getAuthSession = () => {
  if (!instance) {
    throw new Error(
      "AuthSession not initialized. Call initializeAuthSession first."
    );
  }
  return instance;
};

/**
 * Manages both OAuth access tokens and API keys with a single store
 */
export class AuthSession {
  private cache: Cache<types.UserInfo>;

  constructor(cache: Cache<types.UserInfo>) {
    this.cache = cache;
  }

  /**
   * Generate secure key based on auth type
   */
  private generateSecureKey(
    authType: AuthType,
    identifier: string // accessToken or apiKey
  ): string {
    const hashedKey = crypto
      .createHash("sha256")
      .update(`${authType}:${identifier}`)
      .digest("hex");
    return this.cache["createKey"](authType, hashedKey);
  }

  /**
   * Store authentication data (unified method)
   */
  async set(
    authType: AuthType,
    indentifier: string, // accessToken or apiKey
    data: types.UserInfo,
    ttl?: number
  ): Promise<string> {
    let key: string = this.generateSecureKey(authType, indentifier);

    await this.cache.set(key, data, ttl);
    return key;
  }

  /**
   * Get authentication data (unified method)
   */
  async get(
    authType: AuthType,
    identifier: string // accessToken or apiKey
  ): Promise<types.UserInfo | null> {
    try {
      let key: string = this.generateSecureKey(authType, identifier);
      return (await this.cache.get(key)) as types.UserInfo<AuthType> | null;

      // return authType === "access-token"
      //   ? await this.validateAccessToken(identifier) // secondary is clientId
      //   : await this.validateApiKey(identifier); // secondary is username
    } catch (e) {
      logger.error("Error in AuthSession.get:", e);
      return null;
    }
  }

  /**
   * Remove authentication data (unified method)
   */
  async remove(
    authType: AuthType,
    identifier: string // accessToken or apiKey
  ): Promise<boolean> {
    const key = this.generateSecureKey(authType, identifier);
    return await this.cache.remove(key);
  }

  /**
   * Clear all authentication sessions from store
   */
  async clearAllSessions(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Check if authentication exists in store
   */
  async exists(
    authType: AuthType,
    identifier: string,
    secondary: string
  ): Promise<boolean> {
    const key = this.generateSecureKey(authType, identifier);
    return (await this.get(authType, identifier)) !== null;
  }
}
