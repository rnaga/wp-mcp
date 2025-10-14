import { Context } from "@rnaga/wp-node/core/context";

export {};

declare module "@rnaga/wp-node/types/hooks/filters" {
  export interface Filters {
    mcp_core_username: (
      username: string | undefined,
      context: Context
    ) => string | undefined;
  }
}
