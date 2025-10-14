import { Context } from "@rnaga/wp-node/core/context";
import { filter, hook } from "@rnaga/wp-node/decorators/hooks";

@hook("local_mcp_username")
export class Username {
  static localWPConfigFile: string | undefined;

  @filter("mcp_core_username")
  username(username: string | undefined, wp: Context) {
    return process.env.USERNAME || username;
  }
}
