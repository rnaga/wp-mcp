import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Mcps } from "@rnaga/wp-mcp/mcp";
import { OptionsToolMcp } from "@rnaga/wp-mcp/mcp/tools/options-tool.mcp";

import { createTestMcpInstances } from "../../../helpers";

test("options tool MCP get ", async () => {
  Mcps.register([OptionsToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "options_get",
        arguments: {},
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const options = resultJson.data as Record<string, any>;

  expect(options.blogname).toBeDefined();
});

test("options tool MCP update ", async () => {
  Mcps.register([OptionsToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");

  const blogDescription = `"Updated description at ${Math.floor(
    Math.random() * 1000
  )}"`;

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "options_update",
        arguments: {
          blogdescription: blogDescription,
        },
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);

  expect(resultJson.success).toBe(true);
});
