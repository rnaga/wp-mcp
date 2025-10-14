import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Mcps } from "@rnaga/wp-mcp/mcp";
import { RevisionToolMcp } from "@rnaga/wp-mcp/mcp/tools/revision-tool.mcp";
import { createTestMcpInstances } from "../../../helpers";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

test("revision tool MCP list, get and restore", async () => {
  Mcps.register([RevisionToolMcp]);

  const { client, wp } = await createTestMcpInstances("wp-multi");

  // Create a post and update via crud which should create revisions
  const { data: postId } = await wp.utils.crud.post.create({
    post_author: 1,
    post_title: `Test Post ${Math.floor(Math.random() * 100000)}`,
    post_content: "This is a test post.",
    post_status: "publish",
    post_type: "post",
  });

  await wp.utils.crud.post.update(postId, {
    post_content: "This is an updated test post.",
  });

  // Update again to create another revision
  await wp.utils.crud.post.update(postId, {
    post_content: "This is another updated test post.",
  });

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "revisions_list",
        arguments: {
          post_id: postId,
        },
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const revisions = resultJson.data as Record<string, any>;

  expect(revisions.length).toBeGreaterThanOrEqual(2);
  expect(revisions[0].post_content).toMatch(/updated/);

  // Get the first revision
  const revisionId = revisions[0].ID;

  const getResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "revision_get",
        arguments: {
          post_id: postId,
          revision_id: revisionId,
        },
      },
    },
    CallToolResultSchema
  );

  const getResultJson = JSON.parse(getResult.content?.[0].text as string);
  const revision = getResultJson.data as wpCoreTypes.WpPosts;

  expect(revision.ID).toBe(revisionId);

  // Restore the revision
  const restoreResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "revision_restore",
        arguments: {
          post_id: postId,
          revision_id: revisionId,
        },
      },
    },
    CallToolResultSchema
  );

  const restoreResultJson = JSON.parse(
    restoreResult.content?.[0].text as string
  );
  expect(restoreResultJson.success).toBeTruthy();
});
