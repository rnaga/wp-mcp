import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Mcps } from "@rnaga/wp-mcp/mcp";
import { UserToolMcp } from "@rnaga/wp-mcp/mcp/tools/user-tool.mcp";

import { createTestMcpInstances } from "../../../helpers";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

test("user tool MCP list ", async () => {
  Mcps.register([UserToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "users_list",
        arguments: {
          page: 1,
          per_page: 2,
        },
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const users = resultJson.data as wpCoreTypes.WpUsers[];

  expect(Array.isArray(users)).toBe(true);
  expect(users[0].user_login).toBeDefined();
});

test("user tool MCP get ", async () => {
  Mcps.register([UserToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");
  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "user_get",
        arguments: {
          ID: 1,
        },
      },
    },
    CallToolResultSchema
  );
  const resultJson = JSON.parse(result.content?.[0].text as string);
  const user = resultJson.data as wpCoreTypes.WpUsers;

  expect(user).toBeDefined();
  expect(user.ID).toBe(1);
});

test("user tool MCP create and update, and delete", async () => {
  Mcps.register([UserToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");

  const args = {
    user_login: `testuser_${Math.floor(Math.random() * 100000)}`,
    user_email: `testuser_${Math.floor(Math.random() * 100000)}@example.com`,
    display_name: "Test User",
    roles: ["author", "editor"],
  };

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "user_create",
        arguments: args,
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);

  const user = resultJson as wpCoreTypes.WpUsers;

  expect(user).toBeDefined();
  expect(user.ID).toBeGreaterThan(0);

  // Now update the user
  const updatedDisplayName = `Updated User ${Math.floor(
    Math.random() * 100000
  )}`;
  const updateResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "user_update",
        arguments: {
          ID: user.ID,
          display_name: updatedDisplayName,
          user_login: user.user_login,
          user_email: user.user_email,
        },
      },
    },
    CallToolResultSchema
  );

  const updateResultJson = JSON.parse(updateResult.content?.[0].text as string);
  const updatedUser = updateResultJson.data as wpCoreTypes.WpUsers;

  expect(updatedUser).toBeDefined();
  expect(updatedUser.display_name).toBe(updatedDisplayName);

  // Now delete the user
  const deleteResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "user_delete",
        arguments: {
          ID: user.ID,
        },
      },
    },
    CallToolResultSchema
  );

  const deleteResultJson = JSON.parse(deleteResult.content?.[0].text as string);
  const deleteSuccess = deleteResultJson.success as boolean;

  expect(deleteSuccess).toBe(true);
});
