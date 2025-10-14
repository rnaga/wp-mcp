import { z } from "zod";

import { mcp, mcpBind } from "../../decorators";
import { Mcps } from "../mcps";

import type * as types from "../../types";
import { Mcp } from "../mcp";

@mcp("options_tool", {
  description: "A tool to operate WordPress options.",
  version: "1.0.0",
})
export class OptionsToolMcp implements Mcp {
  @mcpBind("options_get", {
    title: "Get Option",
    description:
      "Retrieves WordPress configuration with admin capabilities such as site title and URL.",
    roles: async (wp) => {
      if (wp.config.isMultiSite()) {
        return ["superadmin"];
      }

      return ["administrator"];
    },
  })
  get(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: undefined,
      },
      async () => {
        const wp = await Mcps.getWpContext(username);

        const options = await wp.utils.crud.options.getAll();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(options, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("options_update", {
    title: "Update Option",
    description:
      "Updates WordPress configuration with admin capabilities such as site title and URL.",
    roles: async (wp) => {
      if (wp.config.isMultiSite()) {
        return ["superadmin"];
      }

      return ["administrator"];
    },
  })
  update(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          siteurl: z.string().optional(),
          home: z.string().optional(),
          blogname: z.string().optional(),
          blogdescription: z.string().optional(),
          users_can_register: z.number().min(0).max(1).optional(),
        },
      },

      async (input) => {
        const wp = await Mcps.getWpContext(username);
        const blogId = wp.current.blogId;

        const result = await wp.utils.crud.options.update(input, { blogId });

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
