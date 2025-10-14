import { Cache as CachePackage, createCache } from "cache-manager";

import { logger } from "../../logger";
import { Cache } from "./cache";

import type * as types from "../../types";
/**
 * In-memory cache implementation using cache-manager v5
 */
export class MemoryCache<
  T extends types.CacheValue = types.CacheValue
> extends Cache<T> {
  private cache: CachePackage;
  private static instance: MemoryCache<any> | null = null;

  constructor(options: T = {} as T) {
    super(options);
    this.cache = this.initializeCache();
  }

  /**
   * Initialize the cache-manager instance
   */
  private initializeCache(): CachePackage {
    // cache-manager v5 uses memory store by default
    return createCache({
      ttl: (this.options.ttl || 3600) * 1000, // TTL in milliseconds
    });
  }

  /**
   * Factory method to get singleton instance
   */
  static getInstance<U extends types.CacheValue>(options?: U): MemoryCache<U> {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache<U>(options);
    }
    return MemoryCache.instance as MemoryCache<U>;
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<any | null> {
    try {
      const value = await this.cache.get(key);
      return value !== undefined ? value : null;
    } catch (error) {
      logger.error("Cache get error:", error);
      return null;
    }
  }

  /**
   * Set value in storage
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const ttlMs = ttl ? ttl * 1000 : undefined; // Convert to milliseconds
      await this.cache.set(key, value, ttlMs);
    } catch (error) {
      logger.error("Cache set error:", error);
      throw error;
    }
  }

  /**
   * Remove value by key
   */
  async remove(key: string): Promise<boolean> {
    try {
      await this.cache.del(key);
      return true; // cache-manager v5 doesn't return boolean for del
    } catch (error) {
      logger.error("Cache remove error:", error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const value = await this.cache.get(key);
      return value !== undefined;
    } catch (error) {
      logger.error("Cache has error:", error);
      return false;
    }
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    try {
      await this.cache.clear();
    } catch (error) {
      logger.error("Cache clear error:", error);
      throw error;
    }
  }

  /**
   * Create a prefixed cache key
   */
  createCacheKey(prefix: string, identifier: string): string {
    return this.createKey(prefix, identifier);
  }

  /**
   * Generate a hash for cache key
   */
  generateCacheHash(input: string, salt?: string): string {
    return this.generateHash(input, salt);
  }
}
