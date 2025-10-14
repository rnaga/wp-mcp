import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Mcps } from "@rnaga/wp-mcp/mcp";
import { SettingsToolMcp } from "@rnaga/wp-mcp/mcp/tools/settings-tool.mcp";
import { createTestMcpInstances } from "../../../helpers";

test("settings tool MCP get ", async () => {
  Mcps.register([SettingsToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "settings_get",
        arguments: {},
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const settings = resultJson.data as Record<string, any>;

  expect(settings.description).toBeDefined();
});
