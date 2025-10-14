import { z } from "zod";

import { mcp, mcpBind } from "../../decorators";
import * as vals from "../../validators";
import { Mcps } from "../mcps";

import type * as types from "../../types";

import type * as wpCoreTypes from "@rnaga/wp-node/types";
import { Mcp } from "../mcp";

@mcp("term_tool", {
  description:
    "A tool to operate WordPress terms (categories, tags, custom taxonomies).",
  version: "1.0.0",
})
export class TermToolMcp implements Mcp {
  @mcpBind("terms_list", {
    title: "List Terms",
    description: "Returns a list of WordPress terms with filtering options.",
    capabilities: ["manage_categories"],
  })
  list(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpTermList,
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const { taxonomy_name, ...rest } = input;

        const terms = await wp.utils.crud.term.list(
          taxonomy_name as wpCoreTypes.TaxonomyName,
          {
            page: input.page,
            per_page: input.per_page,
            search: input.search,
            exclude: input.exclude?.length ? input.exclude : undefined,
            include: input.include?.length ? input.include : undefined,
            order: input.order,
            orderby: input.orderby,
            hide_empty: input.hide_empty,
            parent: input.parent,
            post: input.post,
            slug: input.slug?.length ? input.slug : undefined,
          },
          {
            context: "edit",
          }
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(terms, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("term_get", {
    title: "Get Term",
    description: "Retrieves a specific WordPress term by term ID",
    capabilities: ["manage_categories"],
  })
  get(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          taxonomyName: z.string().min(1).trim(),
          termId: z.number().nonnegative().int(),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const term = await wp.utils.crud.term.get(input.termId, {
          context: "edit",
          taxonomyName: input.taxonomyName as wpCoreTypes.TaxonomyName,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(term, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("term_create", {
    title: "Create Term",
    description: "Creates a new WordPress term in a specified taxonomy.",
    capabilities: ["manage_categories"],
  })
  create(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          name: z.string().min(1).trim(),
          taxonomyName: z.string().min(1).trim(),
          parent: z.number().optional(),
          slug: z.string().min(1).trim().optional(),
          description: z.string().optional().default(""),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const result = await wp.utils.crud.term.create({
          name: input.name,
          taxonomyName: input.taxonomyName as wpCoreTypes.TaxonomyName,
          parent: input.parent,
          slug: input.slug,
          description: input.description,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("term_update", {
    title: "Update Term",
    description: "Updates an existing WordPress term.",
    capabilities: ["manage_categories"],
  })
  update(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          termId: z.number().nonnegative().int(),
          taxonomyName: z.string().min(1).trim(),
          name: z.string().min(1).trim().optional(),
          parent: z.number().optional(),
          slug: z.string().min(1).trim().optional(),
          description: z.string().optional(),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const result = await wp.utils.crud.term.update(
          input.termId,
          input.taxonomyName as wpCoreTypes.TaxonomyName,
          {
            name: input.name,
            parent: input.parent,
            slug: input.slug,
            description: input.description,
          }
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

  @mcpBind("term_delete", {
    title: "Delete Term",
    description: "Deletes a WordPress term.",
    capabilities: ["manage_categories"],
  })
  delete(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          termId: z.number().nonnegative().int(),
          taxonomyName: z.string().min(1).trim(),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const result = await wp.utils.crud.term.delete(
          input.termId,
          input.taxonomyName as wpCoreTypes.TaxonomyName
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
