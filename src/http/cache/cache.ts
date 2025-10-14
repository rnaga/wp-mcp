import crypto from "crypto";
import type * as types from "../../types";

/**
 * Abstract base class for cache/store management
 */
export abstract class Cache<T extends types.CacheValue = types.CacheValue> {
  protected options: T;

  constructor(options: T = {} as T) {
    this.options = {
      ttl: 3600, // Default 1 hour
      ...options,
    };
  }

  /**
   * Factory method to get an instance - can be overridden for singleton pattern
   */
  static getInstance<T extends types.CacheValue>(options?: T): Cache<T> {
    throw new Error("getInstance must be implemented by subclass");
  }

  /**
   * Get value by key
   */
  abstract get(key: string): Promise<T | null>;

  /**
   * Set value in storage
   */
  abstract set(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Remove value by key
   */
  abstract remove(key: string): Promise<boolean>;

  /**
   * Check if key exists
   */
  abstract has(key: string): Promise<boolean>;

  /**
   * Clear all entries
   */
  abstract clear(): Promise<void>;

  // /**
  //  * Get all keys
  //  */
  // abstract keys(): Promise<string[]>;

  /**
   * Generate a secure hash for sensitive data
   */
  protected generateHash(input: string, salt?: string): string {
    const saltValue = salt || crypto.randomBytes(16).toString("hex");
    return crypto
      .pbkdf2Sync(input, saltValue, 10000, 64, "sha512")
      .toString("hex");
  }

  /**
   * Create a cache key with optional prefix
   */
  protected createKey(prefix: string, identifier: string): string {
    return `${prefix}:${identifier}`;
  }
}
