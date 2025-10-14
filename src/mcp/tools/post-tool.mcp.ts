import { z } from "zod";

import { mcp, mcpBind } from "../../decorators";
import { mcpLogger } from "../../logger";
import * as vals from "../../validators";
import { Mcp } from "../mcp";
import { Mcps } from "../mcps";

import type * as types from "../../types";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

@mcp("post_tool", {
  description: "A tool to operate CRUD operations on WP posts.",
  version: "1.0.0",
})
export class PostToolMcp implements Mcp {
  @mcpBind("posts_list", {
    title: "List Posts",
    description:
      "Returns a list of WordPress posts with filtering and pagination options.",
    capabilities: ["read"],
  })
  list(...args: types.McpBindParameters) {
    const [server, username, meta] = args;
    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpPostList,
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const posts = await wp.utils.crud.post.list({
          page: input.page,
          per_page: input.per_page,
          search: input.search,
          after: input.after,
          modified_after: input.modified_after,
          author: input.author?.length ? input.author : undefined,
          author_exclude: input.author_exclude?.length
            ? input.author_exclude
            : undefined,
          before: input.before,
          modified_before: input.modified_before,
          exclude: input.exclude?.length ? input.exclude : undefined,
          include: input.include?.length ? input.include : undefined,
          offset: input.offset,
          order: input.order,
          orderby: input.orderby,
          slug: input.slug?.length ? input.slug : undefined,
          status: input.status?.length ? input.status : undefined,
          status_exclude: input.status_exclude?.length
            ? input.status_exclude
            : undefined,
          tax_relation: input.tax_relation,
          categories: input.categories?.length ? input.categories : undefined,
          categories_exclude: input.categories_exclude?.length
            ? input.categories_exclude
            : undefined,
          tags: input.tags?.length ? input.tags : undefined,
          tags_exclude: input.tags_exclude?.length
            ? input.tags_exclude
            : undefined,
          meta:
            input.meta && Object.keys(input.meta).length
              ? input.meta
              : undefined,
          sticky: !input.sticky ? undefined : input.sticky,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(posts, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("post_get", {
    title: "Get Post",
    description: "Retrieves a specific WordPress post by its ID.",
    capabilities: ["read"],
  })
  get(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          ID: z.number().min(1),
          post_type: z.string().default("post"),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);
        const currentUser = wp.current.user;

        const blogId = wp.current.blogId;

        const canEditPosts = !currentUser
          ? false
          : await wp.utils.user.hasCapabilities(currentUser, ["edit_posts"], {
              blogIds: [blogId],
            });

        const post = await wp.utils.crud.post.get(input.ID, {
          context: canEditPosts ? "edit" : "view",
          postType: (input.post_type || "post") as wpCoreTypes.PostType,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(post, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("post_create", {
    title: "Create Post",
    description: "Creates a new WordPress post with the provided details.",
    capabilities: ["edit_posts"],
  })
  create(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpPostUpsert,
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const { post_type: postType } = input;

        try {
          const { data: postId } = await wp.utils.crud.post.create(input);

          // get post after creation
          const post = await wp.utils.crud.post.get(postId, {
            context: "edit",
            postType: (postType || "post") as wpCoreTypes.PostType,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(post, null, 2),
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: `Error creating post: ${username} ${
                  e instanceof Error ? e.message : String(e)
                }`,
              },
            ],
          };
        }
      }
    );

    return server;
  }

  @mcpBind("post_update", {
    title: "Update Post",
    description: "Updates an existing WordPress post with new details.",
    capabilities: ["edit_posts"],
  })
  update(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          ID: z.number().min(1),
          ...vals.mcpPostUpsert,
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        mcpLogger.debug("Updating post with data:", input);

        const { ID, post_type: postType, ...updateData } = input;

        const result = await wp.utils.crud.post.update(ID, updateData);

        const post = await wp.utils.crud.post.get(ID, {
          context: "edit",
          postType: (postType || "post") as wpCoreTypes.PostType,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(post, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("post_trash", {
    title: "Trash Post",
    description: "Moves a WordPress post to the trash.",
    capabilities: ["delete_posts"],
  })
  trash(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          ID: z.number().min(1),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const { data: success } = await wp.utils.crud.post.trash(input.ID);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success }, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }
}
