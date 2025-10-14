import { execSync } from "child_process";
import fs from "fs";

import { wpConfig, wpPrompts } from "@rnaga/wp-node-cli/configs/wp.config";
import { init as initWp } from "@rnaga/wp-node-cli/init/init";
import { copyFile, fileExists, mkdir } from "@rnaga/wp-node/common/files";

import { Cli } from "@rnaga/wp-node-cli/cli";

import { command, subcommand } from "@rnaga/wp-node-cli/decorators";

import { logger } from "../logger";

interface WPHttpInput {}

@command("http", {
  description:
    "Scaffold a TypeScript project for the MCP streamable HTTP server and related tooling.",
  version: "1.0.0",
})
export class HttpCli extends Cli {
  @subcommand("init", {
    description:
      "Generate the HTTP server project, install dependencies, and set up env/config templates.",
  })
  async init() {
    const { program } = wpConfig();

    program.option(
      "-e, --environment",
      "File extension for env file (e.g. local for .env.local). Leaves empty for .env (default)."
    );

    const wpHttpInput = await program
      .parseAsync(process.argv.filter((v) => v !== "--"))
      .then(() => {
        const options = program.opts();
        return wpPrompts<WPHttpInput>(options, []);
      });

    logger.console.log("Initializing MCP HTTP Server...");

    const environment = program.opts().environment || "";

    await initWp({ ...wpHttpInput, environment });

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

    logger.console.log("Creating HTTP server files...");

    const templateBaseDir = __dirname + "/templates/http";
    const distDir = "./src";

    // Create dist directories
    mkdir(distDir);

    // Copy file templates
    const filesToCopy = ["index.ts"];

    // Copy the remaining files
    filesToCopy.forEach((file) => {
      copyFile(`${templateBaseDir}/${file}`, `${distDir}/${file}`);
    });

    // .env has been created by initWp
    // Now it needs to append MCP specific settings saved in template (env example)
    const envExample = fs.readFileSync(`${templateBaseDir}/env`, "utf-8");

    // Read and parse existing.
    const envFile = environment ? `.env.${environment}` : ".env";
    const existingEnv = fileExists(envFile)
      ? fs.readFileSync(envFile, "utf-8")
      : "";
    const envLines = existingEnv
      .split("\n")
      .filter((line) => line.trim() !== "");

    // Skip if "OAUTH_CLIENT_ID=" already exists
    if (!envLines.some((line) => line.startsWith("OAUTH_CLIENT_ID="))) {
      fs.appendFileSync(envFile, `\n\n${envExample}`);
      logger.console.log(`${envFile} has been created/updated.`);
    } else {
      logger.console.log(
        `${envFile} already exists. Skipping appending env example.`
      );
    }

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

    logger.console.log("Next steps:");
    logger.console.log("1. Update your .env file with appropriate settings.");
    logger.console.log(
      "2. Run 'npm run dev' to start the MCP HTTP server in development mode."
    );
    logger.console.log(
      "3. Run 'npm run build' to compile the TypeScript files."
    );
    logger.console.log("4. Run 'npm start' to start the compiled server.");
  }
}
