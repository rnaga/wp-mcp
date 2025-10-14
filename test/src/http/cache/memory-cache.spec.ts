jest.mock("cache-manager");

import { MemoryCache } from "../../../../src/http/cache/memory-cache";

test("should create memory cache with default ttl", () => {
  const cache = new MemoryCache();
  expect(cache).toBeInstanceOf(MemoryCache);
  expect(cache["options"].ttl).toBe(3600);
});

test("should create memory cache with custom ttl", () => {
  const cache = new MemoryCache({ ttl: 7200 });
  expect(cache["options"].ttl).toBe(7200);
});

test("should set and get value", async () => {
  const cache = new MemoryCache();
  await cache.set("key1", { data: "value1" });
  const result = await cache.get("key1");
  expect(result).toEqual({ data: "value1" });
});

test("should return null for non-existent key", async () => {
  const cache = new MemoryCache();
  const result = await cache.get("nonexistent");
  expect(result).toBeNull();
});

test("should set value with custom ttl", async () => {
  const cache = new MemoryCache();
  await cache.set("key1", { data: "value1" }, 60);
  const result = await cache.get("key1");
  expect(result).toEqual({ data: "value1" });
});

test("should remove value by key", async () => {
  const cache = new MemoryCache();
  await cache.set("key1", { data: "value1" });
  const removed = await cache.remove("key1");
  expect(removed).toBe(true);
  expect(await cache.get("key1")).toBeNull();
});

test("should check if key exists", async () => {
  const cache = new MemoryCache();
  await cache.set("key1", { data: "value1" });
  expect(await cache.has("key1")).toBe(true);
  expect(await cache.has("key2")).toBe(false);
});

test("should clear all entries", async () => {
  const cache = new MemoryCache();
  await cache.set("key1", { data: "value1" });
  await cache.set("key2", { data: "value2" });
  await cache.clear();
  expect(await cache.has("key1")).toBe(false);
  expect(await cache.has("key2")).toBe(false);
});

test("should create cache key with prefix", () => {
  const cache = new MemoryCache();
  const key = cache.createCacheKey("prefix", "id123");
  expect(key).toBe("prefix:id123");
});

test("should generate cache hash", () => {
  const cache = new MemoryCache();
  const hash = cache.generateCacheHash("test", "salt");
  expect(hash).toBeTruthy();
  expect(typeof hash).toBe("string");
});

test("should create singleton instance", () => {
  // Reset singleton for testing
  MemoryCache["instance"] = null;

  const instance1 = MemoryCache.getInstance({ ttl: 1800 });
  const instance2 = MemoryCache.getInstance({ ttl: 3600 });

  expect(instance1).toBe(instance2);
  expect(instance1["options"].ttl).toBe(1800);

  // Clean up
  MemoryCache["instance"] = null;
});
