import { Cache } from "../../../../src/http/cache/cache";
import type * as types from "../../../../src/types";

type TestCacheValue = { data: string } & types.CacheValue;

class TestCache extends Cache<TestCacheValue> {
  private store = new Map<string, { value: TestCacheValue; expires: number }>();

  async get(key: string): Promise<TestCacheValue | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: TestCacheValue, ttl?: number): Promise<void> {
    const expires = Date.now() + (ttl || this.options.ttl || 3600) * 1000;
    this.store.set(key, { value, expires });
  }

  async remove(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

test("should create cache with default ttl", () => {
  const cache = new TestCache();
  expect(cache["options"].ttl).toBe(3600);
});

test("should create cache with custom ttl", () => {
  const cache = new TestCache({ ttl: 7200, data: "value1" });
  expect(cache["options"].ttl).toBe(7200);
});

test("should set and get value", async () => {
  const cache = new TestCache();
  await cache.set("key1", { data: "value1" });
  const result = await cache.get("key1");
  expect(result).toEqual({ data: "value1" });
});

test("should return null for non-existent key", async () => {
  const cache = new TestCache();
  const result = await cache.get("nonexistent");
  expect(result).toBeNull();
});

test("should remove value by key", async () => {
  const cache = new TestCache();
  await cache.set("key1", { data: "value1" });
  const removed = await cache.remove("key1");
  expect(removed).toBe(true);
  expect(await cache.get("key1")).toBeNull();
});

test("should check if key exists", async () => {
  const cache = new TestCache();
  await cache.set("key1", { data: "value1" });
  expect(await cache.has("key1")).toBe(true);
  expect(await cache.has("key2")).toBe(false);
});

test("should clear all entries", async () => {
  const cache = new TestCache();
  await cache.set("key1", { data: "value1" });
  await cache.set("key2", { data: "value2" });
  await cache.clear();
  expect(await cache.has("key1")).toBe(false);
  expect(await cache.has("key2")).toBe(false);
});

test("should generate hash", () => {
  const cache = new TestCache();
  const hash = cache["generateHash"]("test", "salt");
  expect(hash).toBeTruthy();
  expect(typeof hash).toBe("string");
});

test("should create cache key with prefix", () => {
  const cache = new TestCache();
  const key = cache["createKey"]("prefix", "id123");
  expect(key).toBe("prefix:id123");
});

test("should throw error when getInstance is not implemented", () => {
  expect(() => Cache.getInstance()).toThrow(
    "getInstance must be implemented by subclass"
  );
});
