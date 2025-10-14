import { z } from "zod";

import { mcp, mcpBind } from "../../decorators";
import * as vals from "../../validators";
import { Mcps } from "../mcps";

import type * as types from "../../types";
import { Mcp } from "../mcp";

@mcp("revision_tool", {
  description: "A tool to operate CRUD operations on WP revisions.",
  version: "1.0.0",
})
export class RevisionToolMcp implements Mcp {
  @mcpBind("revisions_list", {
    title: "List Revisions",
    description:
      "Returns a list of WordPress revisions with filtering and pagination options.",
    capabilities: ["edit_posts"],
  })
  list(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpRevisionList,
      },
      async (input) => {
        const wp = await Mcps.getWpContext(username);

        const revisions = await wp.utils.crud.revision.list(input.post_id, {
          parent: input.post_id,
          page: input.page,
          search: input.search,
          per_page: input.per_page,
          order: input.order,
          orderby: input.orderby,
          exclude: input.exclude?.length ? input.exclude : undefined,
          include: input.include?.length ? input.include : undefined,
          offset: input.offset,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(revisions, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("revision_get", {
    title: "Get Revision",
    description: "Retrieves a specific WordPress revision by ID.",
    capabilities: ["edit_posts"],
  })
  get(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          post_id: z.number().nonnegative().int(),
          revision_id: z.number().nonnegative().int(),
        },
      },
      async (input) => {
        const wp = await Mcps.getWpContext(username);

        const revision = await wp.utils.crud.revision.get(
          input.post_id,
          input.revision_id
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(revision, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("revision_restore", {
    title: "Restore Revision",
    description: "Restores a specific WordPress revision by ID.",
    capabilities: ["edit_posts"],
  })
  restore(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          post_id: z.number().nonnegative().int(),
          revision_id: z.number().nonnegative().int(),
        },
      },
      async (input) => {
        const wp = await Mcps.getWpContext(username);

        const restoredRevision = await wp.utils.crud.revision.restore(
          input.post_id,
          input.revision_id
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { success: restoredRevision.data === true },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    return server;
  }
}
