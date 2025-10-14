import { z } from "zod";

import { mcp, mcpBind } from "../../decorators";

import type * as types from "../../types/";
import { Mcp } from "../mcp";

@mcp("test_tool", {
  description: "A test tool for demonstration purposes.",
  version: "1.0.0",
})
export class TestToolMcp implements Mcp {
  @mcpBind("echo", {
    title: "Echo Input",
    description: "Returns the input string.",
  })
  echo(...args: types.McpBindParameters) {
    const [server, , meta] = args;

    server.registerTool(
      "echo",
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          text: z.string().min(1).max(100),
        },
      },
      async (input) => {
        return {
          content: [{ type: "text", text: input.text }],
        };
      }
    );

    return server;
  }
}
