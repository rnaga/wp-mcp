import { mcpLogger } from "../logger";
import { getConfig } from "./config";
import { McpProxy } from "./mcp-proxy";

(async () => {
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    mcpLogger.info("Shutting down MCP proxy...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    mcpLogger.info("Shutting down MCP proxy...");
    process.exit(0);
  });

  try {
    const config = await getConfig();
    mcpLogger.debug("Starting MCP proxy with config:", config);
    const proxy = new McpProxy(config);
    await proxy.start();
  } catch (error) {
    mcpLogger.error("Failed to start MCP proxy:", error);
    process.exit(1);
  }
})();
