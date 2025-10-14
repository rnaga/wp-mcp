import {
  parseResponseBody,
  isValidJSON,
  safeJSONParse,
} from "@rnaga/wp-mcp/proxy/response-parser";

test("should parse SSE response with data field", () => {
  const rawResponse = `event: message
data: {"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"sse-server","version":"1.0.0"}},"jsonrpc":"2.0","id":1757872368266}`;
  
  const parsed = parseResponseBody(rawResponse);
  const json = JSON.parse(parsed);

  expect(json).toHaveProperty("result");
  expect(json).toHaveProperty("jsonrpc", "2.0");
});

test("should parse plain JSON response", () => {
  const rawResponse = '{"jsonrpc":"2.0","id":1,"result":{"success":true}}';
  
  const parsed = parseResponseBody(rawResponse);
  const json = JSON.parse(parsed);

  expect(json.result.success).toBe(true);
  expect(json.jsonrpc).toBe("2.0");
});

test("should parse SSE response with multiple lines", () => {
  const rawResponse = `event: message
id: 123
data: {"jsonrpc":"2.0","id":1,"result":{}}
`;
  
  const parsed = parseResponseBody(rawResponse);
  const json = JSON.parse(parsed);

  expect(json.jsonrpc).toBe("2.0");
});

test("should throw error for empty response body", () => {
  expect(() => parseResponseBody("")).toThrow("Empty response body");
  expect(() => parseResponseBody("   ")).toThrow("Empty response body");
});

test("should handle plain text response without SSE format", () => {
  const rawResponse = `event: message
id: 123`;
  
  // This is treated as plain text since there's no "data: " field
  const parsed = parseResponseBody(rawResponse);
  expect(parsed).toBe(rawResponse.trim());
});

test("should throw error for SSE response with empty data value", () => {
  const rawResponse = `event: message
data:    
id: 123`;
  
  // When trimmed, "data:    " has no space, so no data line is found
  expect(() => parseResponseBody(rawResponse)).toThrow(
    "No data field found in SSE response"
  );
});

test("isValidJSON should return true for valid JSON", () => {
  expect(isValidJSON('{"key":"value"}')).toBe(true);
  expect(isValidJSON('{"number":123}')).toBe(true);
  expect(isValidJSON('["array","items"]')).toBe(true);
  expect(isValidJSON('null')).toBe(true);
  expect(isValidJSON('true')).toBe(true);
});

test("isValidJSON should return false for invalid JSON", () => {
  expect(isValidJSON("{invalid json}")).toBe(false);
  expect(isValidJSON("not json at all")).toBe(false);
  expect(isValidJSON('{"unclosed":')).toBe(false);
  expect(isValidJSON("")).toBe(false);
});

test("safeJSONParse should parse valid JSON", () => {
  const result = safeJSONParse('{"key":"value"}');
  expect(result).toEqual({ key: "value" });
});

test("safeJSONParse should parse arrays", () => {
  const result = safeJSONParse('[1,2,3]');
  expect(result).toEqual([1, 2, 3]);
});

test("safeJSONParse should parse primitives", () => {
  expect(safeJSONParse("null")).toBeNull();
  expect(safeJSONParse("true")).toBe(true);
  expect(safeJSONParse("123")).toBe(123);
  expect(safeJSONParse('"string"')).toBe("string");
});

test("safeJSONParse should throw error for invalid JSON", () => {
  expect(() => safeJSONParse("{invalid}")).toThrow("Failed to parse JSON");
});

test("should handle SSE response with whitespace", () => {
  const rawResponse = `  event: message  
  data: {"jsonrpc":"2.0","id":1}  `;
  
  const parsed = parseResponseBody(rawResponse);
  const json = JSON.parse(parsed);

  expect(json.jsonrpc).toBe("2.0");
});

test("should handle JSON response with extra whitespace", () => {
  const rawResponse = `  
  {"jsonrpc":"2.0","id":1}  
  `;
  
  const parsed = parseResponseBody(rawResponse);
  const json = JSON.parse(parsed);

  expect(json.jsonrpc).toBe("2.0");
});

test("should parse SSE response with complex nested JSON", () => {
  const rawResponse = `data: {"jsonrpc":"2.0","id":1,"result":{"nested":{"deep":{"value":123}}}}`;
  
  const parsed = parseResponseBody(rawResponse);
  const json = JSON.parse(parsed);

  expect(json.result.nested.deep.value).toBe(123);
});

test("should extract data from SSE with only data field", () => {
  const rawResponse = `data: {"id":1,"result":"success"}`;
  
  const parsed = parseResponseBody(rawResponse);
  const json = JSON.parse(parsed);

  expect(json.id).toBe(1);
  expect(json.result).toBe("success");
});
