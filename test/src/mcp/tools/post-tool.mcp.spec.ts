import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Mcps } from "@rnaga/wp-mcp/mcp";
import { PostToolMcp } from "@rnaga/wp-mcp/mcp/tools/post-tool.mcp";

import { createTestMcpInstances } from "../../../helpers";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

test("post tool MCP list ", async () => {
  Mcps.register([PostToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "posts_list",
        arguments: {
          page: 1,
          per_page: 2,
        },
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const posts = resultJson.data as wpCoreTypes.WpPosts[];

  expect(Array.isArray(posts)).toBe(true);
  expect(posts[0].post_title).toBeDefined();
});

test("post tool MCP get ", async () => {
  Mcps.register([PostToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");
  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "post_get",
        arguments: {
          ID: 1,
        },
      },
    },
    CallToolResultSchema
  );
  const resultJson = JSON.parse(result.content?.[0].text as string);
  const post = resultJson.data as wpCoreTypes.WpPosts;

  expect(post).toBeDefined();
  expect(post.ID).toBe(1);
});

test("post tool MCP create and update, and trash", async () => {
  Mcps.register([PostToolMcp]);
  const { client, wp } = await createTestMcpInstances("wp-multi");

  const args = {
    post_author: 1,
    post_title: `Test Post from MCP - ${Math.floor(Math.random() * 100000)}`,
    post_content: "This is a test post created via MCP",
    post_status: "publish",
    post_type: "post",
  };

  // Get categories to assign to the post
  const categories = await wp.utils.crud.term.list("category", {
    per_page: 2,
  });
  const categoryIds = categories.data.map((cat) => cat.term_id);

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "post_create",
        arguments: args,
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const post = resultJson.data as wpCoreTypes.WpPosts;

  expect(post).toBeDefined();
  expect(post.ID).toBeGreaterThan(0);

  // Now update the post
  const updatedTitle = `Updated Title ${Math.floor(Math.random() * 100000)}`;
  const updateResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "post_update",
        arguments: {
          ID: post.ID,
          post_title: updatedTitle,
          post_status: "publish",
          post_category: categoryIds,
        },
      },
    },
    CallToolResultSchema
  );

  const updateResultJson = JSON.parse(updateResult.content?.[0].text as string);
  const updatedPost = updateResultJson.data as wpCoreTypes.WpPosts;

  expect(updatedPost).toBeDefined();
  expect(updatedPost.post_title).toBe(updatedTitle);

  // Get the post to verify the update
  const postUpdate = await wp.utils.post.get(updatedPost.ID);
  const terms = await postUpdate.terms("category");
  console.log(terms);

  // Now trash the post
  const trashResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "post_trash",
        arguments: {
          ID: post.ID,
        },
      },
    },
    CallToolResultSchema
  );

  const trashResultJson = JSON.parse(trashResult.content?.[0].text as string);
  const trashSuccess = trashResultJson.success as boolean;

  expect(trashSuccess).toBe(true);
});
