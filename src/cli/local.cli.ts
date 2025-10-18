import { execSync } from "child_process";
import { Command } from "commander";
import { prompt } from "enquirer";
import fs from "fs";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Cli } from "@rnaga/wp-node-cli/cli";
import { command, subcommand } from "@rnaga/wp-node-cli/decorators";
import { promptForFilePath } from "@rnaga/wp-node-cli/utils";
import { copyFile, fileExists, mkdir } from "@rnaga/wp-node/common/files";
import * as wpCoreVals from "@rnaga/wp-node/validators";

import { logger, mcpLogger } from "../logger";
import { defaultMcpPrimitives, Mcps } from "../mcp";
import {
  destroySecret,
  getSecret,
  loadSecret,
  saveSecret,
} from "../secret-store";
import { createLocalServer } from "./local";
import { getCommand } from "./utils";

import type * as types from "../types";

@command("local", {
  description: "Local MCP (stdio) server commands",
  version: "1.0.0",
})
export class LocalCli extends Cli {
  // This is called by Clis.getCommand()
  static getCommand(program: Command) {
    return getCommand(program);
  }

  @subcommand("config-set", {
    description: "Set database configuration",
  })
  public async configSet(program: Command) {
    this.setCommand(program);

    const prompts: Parameters<typeof prompt>[0] = [
      {
        type: "input",
        name: "db_host",
        message: "Enter your database hostname:",
        initial: "localhost",
        required: true,
      },
      {
        type: "input",
        name: "db_port",
        message: "Enter your database port:",
        initial: "3306",
        required: true,
      },
      {
        type: "input",
        name: "db_user",
        message: "Enter your database user:",
        required: true,
      },
      {
        type: "password",
        name: "db_password",
        message: "Enter your database password:",
      },
      {
        type: "input",
        name: "db_name",
        message: "Enter your database name:",
        required: true,
      },
      {
        type: "select",
        name: "db_environment",
        message: "Select your database environment:",
        choices: ["development", "production"],
        initial: "development",
        required: true,
      } as any,
      {
        type: "confirm",
        name: "multisite",
        message: "Is this multisite?",
        initial: false,
        required: true,
      },
      {
        type: "confirm",
        name: "ssl_enabled",
        message: "Is SSL enabled for the database connection?",
        initial: false,
        required: true,
      },
    ];

    const response = await prompt<{
      db_host: string;
      db_port: string;
      db_name: string;
      db_user: string;
      db_password: string;
      db_environment: "development" | "production";
      multisite: boolean;
      default_blog_id?: string;
      default_site_id?: string;
      ssl_enabled: boolean;
    }>(prompts);

    // Default blog/site ID for multisite
    const defaultBlogId = "1";
    const defaultSiteId = "1";

    let sslCa = "";
    let sslCert = "";
    let sslKey = "";

    // SSL questions
    if (response.ssl_enabled) {
      sslCa = await promptForFilePath(
        "ssl_ca",
        "Enter the path to the SSL CA certificate",
        true,
        {
          extensions: [".crt", ".pem"],
        }
      );
      sslCert = await promptForFilePath(
        "ssl_cert",
        "Enter the path to the SSL client certificate (press Enter to skip)",
        false,
        {
          extensions: [".crt", ".pem"],
        }
      );
      sslKey = await promptForFilePath(
        "ssl_key",
        "Enter the path to the SSL client key (press Enter to skip)",
        false,
        {
          extensions: [".key"],
        }
      );
    }

    const localConfig: types.Secret["local"] = {
      db_host: response.db_host,
      db_name: response.db_name,
      db_user: response.db_user,
      db_password: response.db_password,
      db_port: parseInt(`${response.db_port}`),
      db_environment: response.db_environment,
      multisite: response.multisite,
      default_blog_id: defaultBlogId,
      default_site_id: defaultSiteId,
      ssl_enabled: response.ssl_enabled,
      ssl_ca: sslCa,
      ssl_cert: sslCert || "",
      ssl_key: sslKey || "",
    };

    // Save to secret store
    await saveSecret({ local: localConfig });

    logger.console.log("🎉 Local database configuration saved");
  }

  @subcommand("config", {
    description: "Show the current local database configuration",
  })
  public async config(program: Command) {
    this.setCommand(program);

    await loadSecret();

    const secret = await getSecret({
      mask: true,
    });
    logger.console.log("Current local database configuration:");
    logger.console.dir(secret?.local || {}, { depth: null });
  }

  @subcommand("config-clear", {
    description: "Clear all stored secrets",
  })
  public async clear(program: Command) {
    this.setCommand(program);

    await destroySecret("local");
    logger.console.log("🎉 All secrets cleared");
  }

  @subcommand("start", {
    description: "Start the local MCP (stdio) server",
  })
  public async start(program: Command) {
    // npx @modelcontextprotocol/inspector -- npm run wp-mcp:dev --silent -- local start -f src/_wp/config/wp.json -u wp
    // npx @modelcontextprotocol/inspector -- npx @rnaga/wp-mcp@latest -- local start -u wp
    program
      .option("-f, --file", "Path to the WP config file")
      .option(
        "-u, --username <username>",
        "WordPress Username for password authentication"
      );
    this.setCommand(program);

    const username =
      this.command.getOption("username", wpCoreVals.helpers.string) ||
      process.env.LOCAL_USERNAME;

    if (!username) {
      mcpLogger.error(
        "Error: Username is required. Provide it via --username option or LOCAL_USERNAME environment variable."
      );
      process.exit(1);
    }

    const configFile =
      this.command.getOption("file", wpCoreVals.helpers.string) ||
      process.env.LOCAL_CONFIG;

    mcpLogger.info("Starting local MCP (stdio) server...");

    // Register default MCP primitives before starting the MCP server
    const primitives = Object.values(defaultMcpPrimitives);
    Mcps.register(primitives);

    const mcpServer = await createLocalServer({
      configFile,
      username,
      mcps: primitives,
    });

    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);

    mcpLogger.info("🎉 Local MCP (stdio) server started");
  }

  @subcommand("init", {
    description: "Initialize the MCP Local Server project",
  })
  async init() {
    const secret = await getSecret();

    logger.console.log("Initializing MCP Local Server...");
    logger.console.log("Installing dependencies...");

    // Install dependencies
    const dependencies = ["@rnaga/wp-node", "@rnaga/wp-mcp"];
    execSync(`npm i -S ${dependencies.join(" ")}`, { stdio: "inherit" });

    // Install dev dependencies
    const devDependencies = ["typescript", "@types/node", "ts-node"];
    execSync(`npm i -D ${devDependencies.join(" ")}`, { stdio: "inherit" });

    // Delete index.ts created by wp-node
    if (fileExists("./index.ts")) {
      fs.unlinkSync("./index.ts");
    }

    logger.console.log("Creating Local server files...");

    const templateBaseDir = __dirname + "/templates/local";
    const distSrcDir = "./src";

    // Create dist directories
    mkdir(distSrcDir);

    // Copy file templates (ts)
    const tsFilesToCopy = ["index.ts"];

    // Copy the remaining files
    tsFilesToCopy.forEach((file) => {
      copyFile(`${templateBaseDir}/${file}`, `${distSrcDir}/${file}`);
    });

    // Copy tsconfig.json and .gitignore.example
    const distDir = ".";
    const otherFilesToCopy = ["tsconfig.json", "gitignore.example"];
    otherFilesToCopy.forEach((file) => {
      // gitignore.example -> .gitignore
      if (file === "gitignore.example") {
        copyFile(
          `${templateBaseDir}/${file}`,
          `${distDir}/.${file.replace(".example", "")}`
        );
        return;
      }
      copyFile(`${templateBaseDir}/${file}`, `${distDir}/${file}`);
    });

    logger.console.log("Updating package.json scripts...");

    // Add npm run dev to package.json scripts to start the HTTP server in development with ts-node
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts["dev"] = "ts-node src/index.ts";
    packageJson.scripts["build"] =
      "tsc --project ./tsconfig.json --outDir ./dist";
    packageJson.scripts["start"] = "node ./dist/src/index.js";

    fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));

    logger.console.log("Initialization complete!");
  }
}
