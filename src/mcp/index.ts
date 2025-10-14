import { CommentToolMcp } from "./tools/comment-tool.mcp";
import { MetaToolMcp } from "./tools/meta-tool.mcp";
import { OptionsToolMcp } from "./tools/options-tool.mcp";
import { PostToolMcp } from "./tools/post-tool.mcp";
import { RevisionToolMcp } from "./tools/revision-tool.mcp";
import { SettingsToolMcp } from "./tools/settings-tool.mcp";
import { TermToolMcp } from "./tools/term-tool.mcp";
import { UserToolMcp } from "./tools/user-tool.mcp";

export * from "./mcps";

export const defaultMcpPrimitives = {
  CommentToolMcp,
  MetaToolMcp,
  OptionsToolMcp,
  PostToolMcp,
  RevisionToolMcp,
  SettingsToolMcp,
  TermToolMcp,
  UserToolMcp,
};
