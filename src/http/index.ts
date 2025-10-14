// Load settings first to set up configurations for @rnaga/wp-node
import "../_wp/settings";

import { MemoryCache } from "../http/cache/memory-cache";
import { createHttpServer } from "../http/express";
import { logger } from "../logger";
import { defaultMcpPrimitives } from "../mcp";
import { oauthProviders } from "../http/auth/providers";

const primitives = Object.values(defaultMcpPrimitives);

// For loading a specific set of MCPs, do like this:
// const { PostToolMcp } = defaultMcpPrimitives;
// const primitives = [PostToolMcp];

const app = createHttpServer({
  cacheClass: MemoryCache,
  mcps: primitives,
  // Pass the desired OAuth provider here, e.g., oauthProviders.GitHubProvider
  // oauthProvider: oauthProviders.GoogleProvider,
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
