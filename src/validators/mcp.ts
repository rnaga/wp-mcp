import { z } from "zod";
import sl from "zod/v4/locales/sl.js";

// TODO: Refactor to extend and reuse validation schemas from @rnaga/wp-node/validators/crud
// This will ensure consistency across WordPress API operations and reduce code duplication

export const mcpPostList = {
  page: z.number().min(1).default(1).optional(),
  per_page: z.number().default(10).optional(),
  search: z.string().optional(),
  after: z.string().optional(),
  modified_after: z.string().optional(),
  author: z.array(z.number()).optional(),
  author_exclude: z.array(z.number()).optional(),
  before: z.string().optional(),
  modified_before: z.string().optional(),
  exclude: z.array(z.number()).optional(),
  include: z.array(z.number()).optional(),
  offset: z.number().optional(),
  order: z.union([z.literal("asc"), z.literal("desc")]).default("desc"),
  orderby: z
    .union([
      z.literal("post_author"),
      z.literal("post_date"),
      z.literal("ID"),
      z.literal("post_modified"),
      z.literal("post_parent"),
      z.literal("post_name"),
      z.literal("post_title"),
    ])
    .default("post_date"),
  slug: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  status_exclude: z.array(z.string()).optional(),
  tax_relation: z.union([z.literal("AND"), z.literal("OR")]).optional(),
  categories: z.array(z.number()).optional(),
  categories_exclude: z.array(z.number()).optional(),
  tags: z.array(z.number()).optional(),
  tags_exclude: z.array(z.number()).optional(),
  meta: z.object({ key: z.string(), value: z.string() }).optional(),
  sticky: z.boolean().optional(),
};

const metaValue = z.union([
  z.string(),
  z.number(),
  z.array(z.union([z.string(), z.number()])),
  z.record(z.string(), z.any()),
]);

export const mcpPostUpsert = {
  post_author: z.number().int().nonnegative().default(0),
  post_content: z.string().default(""),
  post_title: z.string().max(65535).trim(),
  post_excerpt: z.string().max(65535).trim().default(""),
  post_status: z.string().default("draft"),
  post_type: z.string().default("post"),
  comment_status: z
    .union([z.literal("open"), z.literal("closed")])
    .default("open")
    .optional(),
  post_category: z.array(z.number()).optional(),
  ping_status: z.enum(["open", "closed"]).default("open"),
  tags_input: z
    .union([
      z.array(z.number()),
      z.array(z.string().trim()),
      z.array(z.union([z.number(), z.string().trim()])),
    ])
    .optional()
    .default([]),
  tax_input: z
    .record(
      z.string(),
      z.union([
        z.array(z.string()), // For non-hierarchical taxonomy (names or slugs)
        z.array(z.number()), // For hierarchical taxonomy (term IDs)
        z.array(z.union([z.string(), z.number()])),
      ])
    )
    .optional(),
  meta_input: z.record(z.string(), metaValue).default({}).optional(),
  file: z.string().optional().default(""),
  context: z.string().optional().default(""),
};

export const mcpUserList = {
  page: z.number().min(1).default(1).optional(),
  per_page: z.number().default(10).optional(),
  blog_id: z.number().optional(),
  site_id: z.number().optional(),
  search: z.string().optional(),
  exclude: z.array(z.number()).optional(),
  exclude_anonymous: z.boolean().optional().default(false),
  include: z.array(z.number()).optional(),
  include_unregistered_users: z.boolean().optional().default(false),
  superadmins: z.boolean().optional().default(false),
  offset: z.number().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  orderby: z
    .enum([
      "ID",
      "display_name",
      "user_login",
      "user_registered",
      "user_email",
      "user_url",
    ])
    .default("display_name"),
  slug: z.array(z.string()).optional(),
  roles: z.array(z.string()).default([]),
  has_published_posts: z.boolean().optional(),
};

export const mcpUserCreate = {
  user_login: z.string().max(60).trim().toLowerCase(),
  user_nicename: z.string().max(50).trim().optional(),
  user_email: z.string().email().max(100).trim(),
  user_url: z.union([
    z.string().max(100).trim().default(""),
    z.string().max(0).optional(),
  ]),
  display_name: z.string().max(250).trim(),
};

export const mcpUserUpdate = {
  ...mcpUserCreate,
  ID: z.number().int().nonnegative(),
  user_login: z.string(),
  roles: z.array(z.string()).optional(),
  meta_input: z.record(z.string(), z.any()).optional().default({}),

  // Metadata fields
  nickname: z.string().optional().default(""),
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  description: z.string().default(""),
  locale: z.string().optional(),
};

export const mcpCommentList = {
  page: z.number().min(1).default(1).optional(),
  per_page: z.number().default(10).optional(),
  search: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  author: z.array(z.number()).optional(),
  author_exclude: z.array(z.number()).optional(),
  author_email: z.string().optional(),
  exclude: z.array(z.number()).optional(),
  include: z.array(z.number()).optional(),
  offset: z.number().optional(),
  order: z.union([z.literal("asc"), z.literal("desc")]).default("desc"),
  orderby: z
    .enum([
      "comment_author",
      "comment_date",
      "comment_date_gmt",
      "comment_ID",
      "comment_post_ID",
      "comment_parent",
      "comment_type",
    ])
    .default("comment_date_gmt"),
  parent: z.array(z.number()).optional(),
  parent_exclude: z.array(z.number()).optional(),
  post: z.array(z.number()).optional(),
  status: z.string().default("approve").optional(),
  type: z.string().default("comment").optional(),
  password: z.string().optional(),
};

export const mcpCommentCreate = {
  //ID: z.number().nonnegative().int().optional(),
  comment_post_ID: z.number().nonnegative().int(),
  comment_content: z.string().min(1).trim().max(65525),
  comment_author: z.string().max(245).trim(),
  comment_author_email: z.string().email().max(100).trim(),
  comment_author_url: z.string().max(200).trim().optional().default(""),
  comment_approved: z.enum(["0", "1"]).default("0"),
  user_id: z.number().nonnegative().int().optional().default(0),
};

export const mcpCommentUpdate = {
  ID: z.number().nonnegative().int(),
  comment_post_ID: mcpCommentCreate.comment_post_ID.optional(),
  comment_content: mcpCommentCreate.comment_content.optional(),
  comment_author: mcpCommentCreate.comment_author.optional(),
  comment_author_email: mcpCommentCreate.comment_author_email.optional(),
  comment_author_url: mcpCommentCreate.comment_author_url.optional(),
  comment_approved: mcpCommentCreate.comment_approved.optional(),
  user_id: mcpCommentCreate.user_id.optional(),
};

export const mcpTermList = {
  taxonomy_name: z.string().min(1).trim(),
  page: z.number().min(1).default(1).optional(),
  per_page: z.number().default(10).optional(),
  search: z.string().optional(),
  exclude: z.array(z.number()).optional(),
  include: z.array(z.number()).optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
  orderby: z
    .enum([
      "term_id",
      "name",
      "slug",
      "term_group",
      "term_order",
      "description",
    ])
    .default("name"),
  hide_empty: z.boolean().optional(),
  parent: z.number().optional(),
  post: z.number().optional(),
  slug: z.array(z.string()).optional(),
};

export const mcpRevisionList = {
  // This is parent in @rnaga/wp-node/validators/crud/revision.ts
  post_id: z.number().nonnegative().int(),
  page: z.number().min(1).default(1).optional(),
  search: z.string().optional(),
  exclude: z.array(z.number()).optional(),
  include: z.array(z.number()).optional(),
  offset: z.number().optional(),
  per_page: z.number().default(10).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  orderby: z
    .union([
      z.literal("post_date"),
      z.literal("ID"),
      z.literal("post_modified"),
      z.literal("post_name"),
      z.literal("post_title"),
    ])
    .default("post_date"),
};

export const mcpMetaTable = z.enum([
  "post",
  "comment",
  "blog",
  "term",
  "user",
  "site",
]);

export const mcpMetaList = {
  page: z.number().nonnegative().int(),
  per_page: z.number().default(10).optional(),
  search: z.string().optional(),
  exclude: z.array(z.number()).optional(),
  include: z.array(z.number()).optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
  orderby: z.enum(["meta_id", "meta_key", "meta_value"]).default("meta_id"),
  // orderby: z
  //   .enum([
  //     "term_id",
  //     "name",
  //     "slug",
  //     "term_group",
  //     "term_order",
  //     "description",
  //   ])
  //   .default("name"),
  // hide_empty: z.boolean().optional(),
  // parent: z.number().optional(),
  // post: z.number().optional(),
  // slug: z.array(z.string()).optional(),
};
