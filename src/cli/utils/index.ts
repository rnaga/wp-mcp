import { Command } from "commander";
import * as fs from "fs";

export const getCommand = (program: Command) => {
  // Avoid error: too many arguments.
  // https://github.com/tj/commander.js/blob/master/CHANGELOG.md#1300-2024-12-30
  program.allowExcessArguments();

  return program;
};

export const readSslCert = (path: string | undefined): string | undefined => {
  if (!path || !fs.existsSync(path)) {
    return undefined;
  }

  return fs.readFileSync(path, "utf8");
};
