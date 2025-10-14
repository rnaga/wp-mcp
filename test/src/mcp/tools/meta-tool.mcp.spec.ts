import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Mcps } from "@rnaga/wp-mcp/mcp";
import { MetaToolMcp } from "@rnaga/wp-mcp/mcp/tools/meta-tool.mcp";

import { createTestMcpInstances } from "../../../helpers";

test("post tool MCP list ", async () => {
  Mcps.register([MetaToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "meta_list",
        arguments: {
          table: "post",
          include: [
            1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
          ],
          exclude: [2],
          search: "a",
          page: 1,
          per_page: 2,
        },
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const metas = resultJson.data;

  expect(Array.isArray(metas)).toBe(true);
  expect(metas[0].meta_key).toBeDefined();
});

test("meta tool MCP get ", async () => {
  Mcps.register([MetaToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");
  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "meta_get",
        arguments: {
          table: "post",
          objectId: 1,
        },
      },
    },
    CallToolResultSchema
  );
  const resultJson = JSON.parse(result.content?.[0].text as string);
  const meta = resultJson.data;

  expect(meta).toBeDefined();
});

test("meta tool MCP create and update, and delete", async () => {
  Mcps.register([MetaToolMcp]);
  const { client, wp } = await createTestMcpInstances("wp-multi");

  await wp.current.assumeUser(1);

  // First create post
  const { data: postId } = await wp.utils.crud.post.create({
    post_author: 1,
    post_title: `Test Metadata from MCP - ${Math.floor(
      Math.random() * 100000
    )}`,
    post_content: "This is a test metadata created via MCP",
    post_status: "publish",
    post_type: "post",
  });

  let metadata = {
    testmetadata: "test",
  };

  // Create meta
  const resultCreate = await client.request(
    {
      method: "tools/call",
      params: {
        name: "meta_create",
        arguments: {
          table: "post",
          objectId: postId,
          data: metadata,
        },
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(resultCreate.content?.[0].text as string);
  const metaId = resultJson.meta_id;

  console.log("resultCreate", resultCreate, resultJson);

  metadata = {
    testmetadata: "updated",
  };

  // Update meta
  const resultUpdate = await client.request(
    {
      method: "tools/call",
      params: {
        name: "meta_update",
        arguments: {
          table: "post",
          objectId: postId,
          data: metadata,
        },
      },
    },
    CallToolResultSchema
  );

  const resultUpdatedJson = JSON.parse(
    resultUpdate.content?.[0].text as string
  );
  console.log("resultUpdatedJson:", resultUpdatedJson);

  // Get metadata and check if metadata is updated
  const metadataCheck = await wp.utils.crud.meta.get("post", postId);
  const metadataKeys = Object.keys(metadataCheck.data);

  expect(metadataKeys).toEqual(expect.arrayContaining(["testmetadata"]));

  // Delete metadata
  const resultDelete = await client.request(
    {
      method: "tools/call",
      params: {
        name: "meta_delete",
        arguments: {
          table: "post",
          objectId: postId,
          keys: ["testmetadata"],
        },
      },
    },
    CallToolResultSchema
  );

  console.log(resultDelete);

  const resultDeleteJson = JSON.parse(resultDelete.content?.[0].text as string);
  expect(resultDeleteJson.success).toBe(true);
});
