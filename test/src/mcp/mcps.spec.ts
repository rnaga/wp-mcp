import { Mcps } from "@rnaga/wp-mcp/mcp";
import { mcp, mcpBind } from "@rnaga/wp-mcp/decorators";
import type * as types from "@rnaga/wp-mcp/types";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

import { z } from "zod";
import { createTestMcpInstances } from "../../helpers";
import { Mcp } from "@rnaga/wp-mcp/mcp/mcp";

@mcp("test", {
  version: "1.0.0",
  description: "A test MCP for demonstration",
})
class TestMcp implements Mcp {
  @mcpBind("test-primitive", {
    title: "Test Primitive",
    description: "A test primitive that echoes input",
  })
  test(...args: types.McpBindParameters) {
    const [server, , meta] = args;
    server.registerTool(
      "test",
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          test: z.string().min(1),
        },
      },
      async (input) => {
        return {
          content: [{ type: "text", text: `Updated response ${input.test}` }],
        };
      }
    );

    return server;
  }
}

test("MCP registration and primitive binding", async () => {
  // Register the TestMcp class
  Mcps.register([TestMcp]);

  const { client } = await createTestMcpInstances("wp-multi");

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "test",
        arguments: {
          test: "Hello, world!",
        },
      },
    },
    CallToolResultSchema
  );

  expect(result.content).toEqual([
    {
      type: "text",
      text: "Updated response Hello, world!",
    },
  ]);
});
