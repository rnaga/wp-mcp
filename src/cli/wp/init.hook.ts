// import file system module
import * as fs from "fs";

import * as configs from "@rnaga/wp-node/common/config";
import { Context } from "@rnaga/wp-node/core/context";
import { action, hook } from "@rnaga/wp-node/decorators/hooks";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

@hook("local_mcp_init")
export class Init {
  static localWPConfigFile: string | undefined;

  @action("core_init")
  init(context: Context) {
    // Read config from file if specified and exists
    if (Init.localWPConfigFile && fs.existsSync(Init.localWPConfigFile)) {
      // Read file and JSON.parse
      const fileContent = fs.readFileSync(Init.localWPConfigFile, "utf-8");
      const fileConfig = JSON.parse(fileContent) as wpCoreTypes.Config;

      const config = configs.defineWPConfig({
        ...fileConfig,
        database: context.config.config.database,
      });
      // Update config except database
      context.config.set({
        ...config,
        database: context.config.config.database,
      });
    }
  }
}
