import "reflect-metadata";

import type * as types from "../types";

export const REFLECT_METADATA_KEY_MCP = "wp-mcp:metadata";
export const REFLECT_METADATA_KEY_MCP_PROPD = "wp-mcp:property";

export function mcp(
  name: string,
  options?: {
    description?: string;
    version?: string;
    multisite?: boolean;
  }
) {
  return function (target: any) {
    // Save the command name and description to the class.
    // This will be used to determine which class to instantiate.
    target.__name = name;
    target.description = options?.description;
    target.version = options?.version;
    target.multisite = options?.multisite || false;
  };
}

export function mcpBind(name: string, options: types.McpDecoratorOptions) {
  return function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    descriptor: TypedPropertyDescriptor<types.McpBindFunction>
  ) {
    const bindMap =
      Reflect.getMetadata(REFLECT_METADATA_KEY_MCP_PROPD, target) ??
      new Map<string, types.McpDecoratorOptions>();

    bindMap.set(propertyKey, {
      name,
      title: options.title,
      description: options.description,
      capabilities: options.capabilities,
      roles: options.roles,
    });

    Reflect.defineMetadata(REFLECT_METADATA_KEY_MCP_PROPD, bindMap, target);
  };
}
