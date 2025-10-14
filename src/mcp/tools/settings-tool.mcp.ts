import { mcp, mcpBind } from "../../decorators";
import type * as types from "../../types";
import { Mcp } from "../mcp";

import { Mcps } from "../mcps";

@mcp("settings_tool", {
  description: "A tool to operate WordPress settings.",
  version: "1.0.0",
})
export class SettingsToolMcp implements Mcp {
  @mcpBind("settings_get", {
    title: "Get Setting",
    description:
      "Retrieves WordPress configuration without special capabilities.",
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

        const settings = await wp.utils.crud.settings.get();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(settings, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }
}
