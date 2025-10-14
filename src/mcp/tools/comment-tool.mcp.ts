import { z } from "zod";

import { mcp, mcpBind } from "../../decorators";
import * as vals from "../../validators";
import { Mcps } from "../mcps";
import { Mcp } from "../mcp";

import type * as types from "../../types";

@mcp("comment_tool", {
  description: "A tool to operate WordPress comments.",
  version: "1.0.0",
})
export class CommentToolMcp implements Mcp {
  @mcpBind("comments_list", {
    title: "List Comments",
    description: "Returns a list of WordPress comments with filtering options.",
    capabilities: ["moderate_comments", "edit_posts"],
  })
  list(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpCommentList,
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);
        const comments = await wp.utils.crud.comment.list(
          {
            page: input.page,
            per_page: input.per_page,
            search: input.search,
            after: input.after,
            before: input.before,
            exclude: input.exclude?.length ? input.exclude : undefined,
            include: input.include?.length ? input.include : undefined,
            offset: input.offset,
            order: input.order,
            orderby: input.orderby,
            parent: input.parent?.length ? input.parent : undefined,
            parent_exclude: input.parent_exclude?.length
              ? input.parent_exclude
              : undefined,
            post: input.post?.length ? input.post : undefined,
            status: input.status?.length ? input.status : undefined,
            type: input.type?.length ? input.type : undefined,
            author_email: input.author_email?.length
              ? input.author_email
              : undefined,
          },
          {
            context: "edit",
          }
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(comments, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("comment_get", {
    title: "Get Comment",
    description: "Retrieves a single WordPress comment by ID.",
    capabilities: ["moderate_comments", "edit_posts"],
  })
  get(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          ID: z.number().nonnegative().int(),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);
        const comment = await wp.utils.crud.comment.get(input.ID, {
          context: "edit",
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(comment, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("comment_create", {
    title: "Create Comment",
    description: "Creates a new WordPress comment.",
    capabilities: ["moderate_comments", "edit_posts"],
  })
  create(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpCommentCreate,
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);
        const comment = await wp.utils.crud.comment.create({
          comment_post_ID: input.comment_post_ID,
          comment_content: input.comment_content,
          comment_author: input.comment_author,
          comment_author_email: input.comment_author_email,
          comment_approved: input.comment_approved,
          user_id: input.user_id,
          comment_author_url: input.comment_author_url,
          comment_type: "comment",
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(comment, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("comment_update", {
    title: "Update Comment",
    description: "Updates an existing WordPress comment.",
    capabilities: ["moderate_comments", "edit_posts"],
  })
  update(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpCommentUpdate,
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);
        const comment = await wp.utils.crud.comment.update(input.ID, {
          comment_post_ID: input.comment_post_ID || undefined,
          comment_content: input.comment_content || undefined,
          comment_author: input.comment_author || undefined,
          comment_author_email: input.comment_author_email || undefined,
          comment_approved: input.comment_approved || undefined,
          user_id: input.user_id || undefined,
          comment_author_url: input.comment_author_url || undefined,
          comment_type: "comment",
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(comment, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("comment_delete", {
    title: "Delete Comment",
    description: "Deletes a WordPress comment by ID.",
    capabilities: ["moderate_comments", "edit_posts"],
  })
  delete(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          ID: z.number().nonnegative().int(),
          force: z.boolean().optional().default(false),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);
        const result = await wp.utils.crud.comment.delete(
          input.ID,
          input.force
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: result.data === true }, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }
}
