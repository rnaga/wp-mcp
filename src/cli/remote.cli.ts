import { Command } from "commander";
import { prompt } from "enquirer";
import { z } from "zod";

import { Cli } from "@rnaga/wp-node-cli/cli";
import { command, subcommand } from "@rnaga/wp-node-cli/decorators";
import * as vals from "@rnaga/wp-node/validators";

import { logger, mcpLogger } from "../logger";
import { getConfig } from "../proxy/config";
import { McpProxy } from "../proxy/mcp-proxy";
import {
  destroySecret,
  getEnvFilePath,
  getSecret,
  loadSecret,
} from "../secret-store";
import { RemoteConnector } from "./remote-connector";
import { getCommand } from "./utils";

import type * as types from "../types";

@command("remote", {
  description: "Remote MCP server commands",
  version: "1.0.0",
})
export class RemoteCli extends Cli {
  // This is called by Clis.getCommand()
  static getCommand(program: Command) {
    return getCommand(program);
  }

  @subcommand("proxy", {
    description:
      "Start a local MCP proxy server to connect to remote MCP server",
  })
  public async proxy(program: Command) {
    // npx @modelcontextprotocol/inspector -- npm run wp-mcp:dev --silent -- remote proxy -a oauth -r http://localhost:3000/mcp -l debug
    // npx @modelcontextprotocol/inspector -- npx @rnaga/wp-mcp@latest -- remote proxy -r http://localhost:3000 -a oauth -l debug
    // set env directly to omit options
    // process.env.REMOTE_URL = "http://localhost:3000/mcp";
    // process.env.REMOTE_AUTH_TYPE = "password";
    // process.env.REMOTE_USERNAME = "***";
    // process.env.REMOTE_PASSWORD = "***";

    program
      .option("-a, --authType <type>", "Authentication type (oauth|password)")
      .option("-r, --remoteUrl <url>", "Remote MCP server URL")
      .option("-l, --logLevel <level>", "Log level (error|warn|info|debug)");

    this.setCommand(program);

    const authType = this.command.getOption("authType", vals.helpers.string);
    const remoteUrl = this.command.getOption("remoteUrl", vals.helpers.string);
    const logLevel = this.command.getOption("logLevel", vals.helpers.string);

    if (logLevel) {
      const parsedLogLevel = z
        .enum(["error", "warn", "info", "debug"])
        .safeParse(logLevel);
      if (parsedLogLevel.success) {
        process.env.LOG_LEVEL = parsedLogLevel.data;
        mcpLogger.logLevel = parsedLogLevel.data;
      }
    }

    if (authType) {
      process.env.REMOTE_AUTH_TYPE = authType;
    }

    if (remoteUrl) {
      process.env.REMOTE_URL = remoteUrl;
    }

    await loadSecret();
    const secret = await getSecret();

    // If auth type is password, ensure username and password are set in env from secret store if not already set
    // if oauth, ensure access token is set in secret store
    if (
      process.env.REMOTE_AUTH_TYPE === "password" &&
      (!secret.remote?.password?.password || !secret.remote.password.username)
    ) {
      throw new Error(
        "Username and password are required for password authentication. Please run 'remote login password' command."
      );
    }

    if (
      process.env.REMOTE_AUTH_TYPE === "oauth" &&
      !secret.remote?.oauth?.access_token
    ) {
      throw new Error(
        "OAuth access token is missing. Please run 'remote login oauth' command."
      );
    }

    const config = await getConfig();
    mcpLogger.info("Connecting to remote MCP server at", config.remoteUrl);

    // If auth type is oauth, check and refresh token if needed
    if (process.env.REMOTE_AUTH_TYPE === "oauth") {
      mcpLogger.info("Checking access token...");
      const connector = new RemoteConnector();
      await connector.checkAndRefreshToken();
      mcpLogger.info("✅ Finished checking access token.");
    }

    // Start proxy
    mcpLogger.debug("MCP proxy with config:", config);
    const proxy = new McpProxy(config);
    await proxy.start();
  }

  @subcommand("login", {
    description:
      "Login to remote MCP server with OAuth or Application Password",
  })
  public async login(program: Command) {
    program
      .argument("<type>", "The type of authentication (oauth|password)")
      .option(
        "-i, --init",
        "Initialize the connector setup with new Authorization URL"
      );

    this.setCommand(program);

    const type = this.command.getArg(0, vals.helpers.string);
    const init = this.command.getOption("init", vals.helpers.boolean || false);

    const connector = new RemoteConnector();
    let username: string | undefined = undefined;
    let password: string | undefined = undefined;

    let authUrl = await connector.getAuthUrl();

    let prompts: Parameters<typeof prompt>[0] = [];

    if (init || !authUrl) {
      prompts.push({
        type: "input",
        name: "authUrl",
        message: "Enter the Authorization URL for the provider",
        initial: authUrl || "http://localhost:3000",
      });
    }

    if (type === "password") {
      prompts.push(
        {
          required: true,
          type: "input",
          name: "username",
          message: "Enter your WordPress username",
        },
        {
          required: true,
          type: "password",
          name: "password",
          message: "Enter your WordPress application password",
        }
      );
    }

    if (prompts.length > 0) {
      const promptResponse = await prompt<{
        authUrl?: string;
        username?: string;
        password?: string;
      }>(prompts);

      if (promptResponse.authUrl) {
        authUrl = promptResponse.authUrl;
        await connector.setAuthUrl(authUrl);
      }

      if (type === "password") {
        username = promptResponse.username;
        password = promptResponse.password;

        // Sanity check - should not happen due to `required: true` above
        if (!username || !password) {
          throw new Error(
            "Username and password are required for password login."
          );
        }
      }
    }

    if (!authUrl) {
      throw new Error("Authorization URL is required. ");
    }

    let result: boolean = false;

    // password authentication
    if (type === "password") {
      logger.console.log("Authenticating with username and password...");
      result = await connector.performPasswordAuth(username!, password!);
    } else {
      // OAuth device flow
      result = await connector.performDeviceFlow();
    }

    if (result) {
      // Save to both env and sqlite
      const envFilePath = getEnvFilePath();
      logger.console.log("Saving secret to", envFilePath);

      logger.console.log("🎉 Ready to connect to MCP server");
    }
  }

  @subcommand("revoke-token", {
    description: "Revoke OAuth token",
  })
  public async revoke(program: Command) {
    this.setCommand(program);

    const connector = new RemoteConnector();

    await connector.revokeToken();
    logger.console.log("🎉 Token revoked");
  }

  @subcommand("config", {
    description: "Show the current remote configuration",
  })
  public async config(program: Command) {
    this.setCommand(program);

    await loadSecret();

    const secret = (await getSecret({ mask: true })) as types.Secret & {
      remote?: {
        oauth?: {
          expires_at_string?: string;
        };
      };
    };
    logger.console.log("Current remote configuration:");

    if (secret.remote?.oauth?.expires_at) {
      const expiresAt = new Date(
        secret.remote.oauth.expires_at
      ).toLocaleString();
      secret.remote.oauth.expires_at_string = expiresAt;
    }

    logger.console.dir(secret?.remote || {}, { depth: null });
  }

  @subcommand("config-clear", {
    description: "Clear all stored secrets",
  })
  public async clear(program: Command) {
    this.setCommand(program);

    await destroySecret("remote");
    logger.console.log("🎉 All secrets cleared");
  }
}
