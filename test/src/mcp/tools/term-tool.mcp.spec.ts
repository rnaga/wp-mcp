import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Mcps } from "@rnaga/wp-mcp/mcp";
import { TermToolMcp } from "@rnaga/wp-mcp/mcp/tools/term-tool.mcp";

import { createTestMcpInstances } from "../../../helpers";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

test("term tool MCP list", async () => {
  Mcps.register([TermToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");
  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "terms_list",
        arguments: {
          taxonomy_name: "category",
          page: 1,
          per_page: 2,
        },
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const terms = resultJson.data as Record<string, any>;

  expect(Array.isArray(terms)).toBe(true);
  expect(terms.length).toBeGreaterThan(0);
});

test("term tool MCP get", async () => {
  Mcps.register([TermToolMcp]);
  const { client, wp } = await createTestMcpInstances("wp-multi");

  const categories = await wp.utils.query.terms((query) => {
    query.whereIn("taxonomy", ["category"]);
    query.builder.limit(1);
  });

  const category = categories?.[0];

  // Call the tool and verify we get the updated response
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "term_get",
        arguments: {
          taxonomyName: "category",
          termId: category?.term_id,
        },
      },
    },
    CallToolResultSchema
  );

  const resultJson = JSON.parse(result.content?.[0].text as string);
  const term = resultJson.data as Record<string, any>;

  expect(term).toBeDefined();
  expect(term.term_id).toBe(1);
});

test("term tool MCP create, update, delete", async () => {
  Mcps.register([TermToolMcp]);
  const { client } = await createTestMcpInstances("wp-multi");

  // Call the tool and verify we get the updated response
  const createResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "term_create",
        arguments: {
          taxonomyName: "category",
          name: `Test Category from MCP ${Math.floor(Math.random() * 1000)}`,
          slug: `test-category-from-mcp-${Math.floor(Math.random() * 1000)}`,
        },
      },
    },
    CallToolResultSchema
  );

  const createResultJson = JSON.parse(createResult.content?.[0].text as string);
  const createdTerm = createResultJson.data as wpCoreTypes.WpTerms;

  expect(createdTerm).toBeDefined();
  expect(createdTerm.term_id).toBeGreaterThan(0);

  // Now update the term
  const updateResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "term_update",
        arguments: {
          termId: createdTerm.term_id,
          taxonomyName: "category",
          name: `Updated Category from MCP ${Math.floor(Math.random() * 1000)}`,
        },
      },
    },
    CallToolResultSchema
  );

  const updateResultJson = JSON.parse(updateResult.content?.[0].text as string);

  expect(updateResultJson.success).toBe(true);

  // Now delete the term
  const deleteResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "term_delete",
        arguments: {
          termId: createdTerm.term_id,
          taxonomyName: "category",
        },
      },
    },
    CallToolResultSchema
  );

  const deleteResultJson = JSON.parse(deleteResult.content?.[0].text as string);

  expect(deleteResultJson.success).toBe(true);
});
