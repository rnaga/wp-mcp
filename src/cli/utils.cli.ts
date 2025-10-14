import { Command } from "commander";
import { z } from "zod";

import { Cli } from "@rnaga/wp-node-cli/cli";
import { command, subcommand } from "@rnaga/wp-node-cli/decorators";
import { Constructor } from "@rnaga/wp-node/types";
import * as wpCoreVals from "@rnaga/wp-node/validators";

import { REFLECT_METADATA_KEY_MCP_PROPD } from "../decorators";
import { logger } from "../logger";
import { defaultMcpPrimitives, Mcps } from "../mcp";
import { destroySecret, getSecret, loadSecret } from "../secret-store";
import { getCommand } from "./utils";
import { createLocalWPContext } from "./wp";

import type * as types from "../types";
@command("utils", {
  description:
    "Utility commands for configuration, debugging, and MCP inspection",
  version: "1.0.0",
})
export class UtilsCli extends Cli {
  // This is called by Clis.getCommand()
  static getCommand(program: Command) {
    return getCommand(program);
  }

  @subcommand("config", {
    description: "Manage the configuration stored in ~/.wp-mcp",
  })
  async config(program: Command) {
    program.argument("<type>", "Type of operation (show, clear)");

    this.setCommand(program);
    const parsed = z
      .enum(["set", "show", "clear"])
      .safeParse(this.command.getArg(0, wpCoreVals.helpers.string));

    if (!parsed.success) {
      logger.console.error("Invalid type. Must be one of: set, show, clear");
      process.exit(1);
    }

    const type = parsed.data;

    switch (type) {
      case "show":
        await loadSecret();

        const secrets = await getSecret({
          mask: true,
        });

        logger.console.log("Current config:", JSON.stringify(secrets, null, 2));
        break;
      case "clear":
        await destroySecret();

        logger.console.log("Configuration deleted.");
        break;
    }
  }

  @subcommand("list-prims", {
    description: "List Available MCP primitives",
  })
  public async listPrimitives(program: Command) {
    program
      .option("-u, --username <username>", "WordPress Username")
      .option("-f, --file", "Path to the WP config file")
      .option(
        "-c, --columns <columns>",
        "Columns to display (comma-separated): name, title, description, capabilities, roles"
      );
    this.setCommand(program);

    const username =
      this.command.getOption("username", wpCoreVals.helpers.string) ||
      process.env.LOCAL_USERNAME;

    const configFile =
      this.command.getOption("file", wpCoreVals.helpers.string) ||
      process.env.LOCAL_CONFIG;

    const columns = (
      this.command.getOption("columns", wpCoreVals.helpers.string) ||
      "name, title, description, capabilities, roles"
    )
      .split(",")
      .map((v) => v.trim());

    const primitives = Object.values(defaultMcpPrimitives);
    Mcps.register(primitives);

    const { wp } = await createLocalWPContext({
      username,
      configFile,
    });

    const results: Array<Record<string, string | undefined>> = [];

    // Register all MCPs
    for (const [, clazz] of Mcps.map) {
      const instance = new (clazz as Constructor)();

      // Get methods registered with @mcpBind
      const methodMap = Reflect.getMetadata(
        REFLECT_METADATA_KEY_MCP_PROPD,
        instance
      ) as Map<string, types.McpOptions>;

      // Register each method as a primitive
      for (const [, options] of methodMap) {
        const { name, title, description } = options;

        // Resolve roles
        const roles = !options.roles
          ? []
          : Array.isArray(options.roles)
          ? options.roles
          : wp && typeof options.roles === "function"
          ? await options.roles(wp)
          : [];

        // Resolve capabilities
        const capabilities = !options.capabilities
          ? []
          : Array.isArray(options.capabilities)
          ? options.capabilities
          : wp && typeof options.capabilities === "function"
          ? await options.capabilities(wp)
          : [];

        const allData = {
          name,
          title,
          description,
          capabilities:
            Array.isArray(capabilities) && capabilities.length > 0
              ? capabilities.join(", ")
              : undefined,
          roles:
            Array.isArray(roles) && roles.length > 0
              ? roles.join(", ")
              : undefined,
        };

        // Only include columns specified in the argument
        const row: Record<string, string | undefined> = {};
        for (const col of columns) {
          if (col in allData) {
            row[col] = allData[col as keyof typeof allData];
          }
        }

        results.push(row);
      }
    }

    logger.console.table(results);
  }

  @subcommand("show-cmds", {
    description: "Show available inspector CLIs",
  })
  public async showInspectorClis(program: Command) {
    this.setCommand(program);

    logger.console.log("Available inspector CLIs:");
    logger.console.log(
      "Local MCP server: npx @modelcontextprotocol/inspector -- npm run wp-mcp:dev --silent -- local start -f src/_wp/config/wp.json -u wp"
    );
    logger.console.log(
      "Where -f is the path to your WP config file, and -u is the WordPress username."
    );
    logger.console.log(
      "HTTP MCP server: npx @modelcontextprotocol/inspector -- npm run wp-mcp:dev --silent -- remote proxy"
    );
  }
}
