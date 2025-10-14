import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Mcps } from "@rnaga/wp-mcp/mcp";
import { CommentToolMcp } from "@rnaga/wp-mcp/mcp/tools/comment-tool.mcp";

import { createTestMcpInstances } from "../../../helpers";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

test("comment tool MCP list", async () => {
  Mcps.register([CommentToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "comments_list",
        arguments: {},
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const comments = resultJson.data as Record<string, any>;

  expect(Array.isArray(comments)).toBe(true);
  expect(comments.length).toBeGreaterThan(0);
});

test("comment tool MCP get ", async () => {
  Mcps.register([CommentToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");
  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "comment_get",
        arguments: {
          ID: 1,
        },
      },
    },
    CallToolResultSchema
  );
  const resultJson = JSON.parse(result.content?.[0].text as string);
  const comment = resultJson.data as wpCoreTypes.WpComments;

  console.log(comment);

  expect(comment).toBeDefined();
  expect(comment.comment_ID).toBe(1);
});

test("comment tool MCP create and update, and delete", async () => {
  Mcps.register([CommentToolMcp]);
  const { client, wp } = await createTestMcpInstances("wp-multi");

  // First create post
  const postId = await wp.utils.trx.post.upsert({
    post_title: `Comment Tool Test Post at ${Math.floor(Math.random() * 1000)}`,
    post_content: "This is a test post for comment tool MCP tests.",
    post_status: "publish",
    post_author: 1,
  });

  const commentContent = `This is a test comment at ${Math.floor(
    Math.random() * 1000
  )}`;

  // Call the tool and verify we get the updated response
  const createResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "comment_create",
        arguments: {
          comment_post_ID: postId,
          comment_content: commentContent,
          comment_author: "Test Author",
          comment_author_email: "test@example.com",
          comment_approved: "1",
        },
      },
    },
    CallToolResultSchema
  );

  console.log(createResult);

  const createResultJson = JSON.parse(createResult.content?.[0].text as string);
  const commentId = createResultJson.data as number;

  expect(commentId).toBeDefined();
  expect(typeof commentId).toBe("number");

  const updatedContent = `This is an updated test comment at ${Math.floor(
    Math.random() * 1000
  )}`;

  // Call the tool and verify we get the updated response
  const updateResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "comment_update",
        arguments: {
          ID: commentId,
          comment_content: updatedContent,
        },
      },
    },
    CallToolResultSchema
  );

  const updateResultJson = JSON.parse(updateResult.content?.[0].text as string);
  const updatedCommentId = updateResultJson.data as number;

  expect(updatedCommentId).toBeDefined();
  expect(updatedCommentId).toBe(commentId);

  // Now delete the comment
  const deleteResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "comment_delete",
        arguments: {
          ID: commentId,
          force: true,
        },
      },
    },
    CallToolResultSchema
  );

  const deleteResultJson = JSON.parse(deleteResult.content?.[0].text as string);

  expect(deleteResultJson.success).toBe(true);
});
