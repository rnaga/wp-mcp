import { createLocalWPContext } from "../../cli/wp";
import { Mcps } from "../../mcp";
import { Mcp } from "../../mcp/mcp";

export const createLocalServer = async (args: {
  configFile?: string;
  username: string;
  mcps: Mcp[];
}) => {
  const { configFile, username, mcps } = args;

  // Register MCPs
  Mcps.register(mcps);

  // Create WP Context
  const { wp } = await createLocalWPContext({
    configFile,
    username,
  });

  const mcpServer = Mcps.createServer();

  // Initialize MCP server (register primitives)
  await Mcps.initServer(mcpServer, wp, username);

  return mcpServer;
};
