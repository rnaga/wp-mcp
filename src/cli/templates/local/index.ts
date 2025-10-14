import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLocalServer } from "@rnaga/wp-mcp/cli/local";
import { mcpLogger } from "@rnaga/wp-mcp/logger";
import { defaultMcpPrimitives } from "@rnaga/wp-mcp/mcp";

const primitives = Object.values(defaultMcpPrimitives);

// For loading a specific set of MCPs, do like this:
// const { PostToolMcp } = defaultMcpPrimitives;
// const primitives = [PostToolMcp];

// Ensure required environment variables are set
if (!process.env.LOCAL_USERNAME) {
  mcpLogger.error("Error: LOCAL_USERNAME environment variable is not set.");
  process.exit(1);
}

const username = process.env.LOCAL_USERNAME!;
const configFile = process.env.LOCAL_CONFIG;

(async () => {
  const mcpServer = await createLocalServer({
    username,
    mcps: primitives,
    configFile,
  });

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  mcpLogger.info("🎉 Local MCP (stdio) server started");
})();
