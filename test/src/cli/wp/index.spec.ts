
jest.mock("@rnaga/wp-mcp/secret-store", () => ({
  loadSecret: jest.fn(),
  getSecret: jest.fn(),
}));

jest.mock("@rnaga/wp-mcp/cli/utils", () => ({
  readSslCert: jest.fn(),
}));


jest.mock("@rnaga/wp-node/common/config", () => ({
  defineWPConfig: jest.fn(),
}));

jest.mock("@rnaga/wp-mcp/mcp/mcps", () => ({
  Mcps: {
    getWpContext: jest.fn(),
  },
}));

jest.mock("@rnaga/wp-mcp/cli/wp/init.hook", () => ({
  Init: {
    localWPConfigFile: null,
  },
}));

import { createLocalWPContext } from "@rnaga/wp-mcp/cli/wp";
import * as secretStore from "@rnaga/wp-mcp/secret-store";
import * as cliUtils from "@rnaga/wp-mcp/cli/utils";
import * as wpConfig from "@rnaga/wp-node/common/config";
import { Mcps } from "@rnaga/wp-mcp/mcp/mcps";
import Application from "@rnaga/wp-node/application";

const mockLoadSecretFn = secretStore.loadSecret as jest.MockedFunction<typeof secretStore.loadSecret>;
const mockGetSecretFn = secretStore.getSecret as jest.MockedFunction<typeof secretStore.getSecret>;
const mockReadSslCertFn = cliUtils.readSslCert as jest.MockedFunction<typeof cliUtils.readSslCert>;
const mockDefineWPConfigFn = wpConfig.defineWPConfig as jest.MockedFunction<typeof wpConfig.defineWPConfig>;
const mockGetWpContextFn = Mcps.getWpContext as jest.MockedFunction<typeof Mcps.getWpContext>;
beforeEach(() => {
  jest.clearAllMocks();
  mockReadSslCertFn.mockReturnValue("cert-content");
  mockDefineWPConfigFn.mockReturnValue({} as any);
  jest.spyOn(Application, 'registerHooks').mockImplementation(jest.fn());
});

test("createLocalWPContext should throw error when local config is missing", async () => {
  mockLoadSecretFn.mockResolvedValue(undefined);
  mockGetSecretFn.mockResolvedValue({});

  await expect(
    createLocalWPContext({ configFile: undefined, username: undefined })
  ).rejects.toThrow(
    "Local database configuration not found. Please run 'local config-set' command first."
  );
});

test("createLocalWPContext should set environment variables from local config", async () => {
  mockLoadSecretFn.mockResolvedValue(undefined);
  mockGetSecretFn.mockResolvedValue({
    local: {
      db_name: "test_db",
      db_user: "test_user",
      db_password: "test_pass",
      db_host: "localhost",
      db_port: 3306,
      multisite: false,
      default_blog_id: 1,
      default_site_id: 1,
      db_environment: "development",
      ssl_enabled: false,
    },
  });

  mockGetWpContextFn.mockResolvedValue({
    current: { user: { props: { user_login: "testuser" } } },
  } as any);

  await createLocalWPContext({ configFile: undefined, username: "testuser" });

  expect(process.env.DB_NAME).toBe("test_db");
  expect(process.env.DB_USER).toBe("test_user");
  expect(process.env.DB_PASSWORD).toBe("test_pass");
  expect(process.env.DB_HOST).toBe("localhost");
  expect(process.env.DB_PORT).toBe("3306");
  expect(process.env.MULTISITE).toBe("false");
  expect(process.env.DEFAULT_BLOG_ID).toBe("1");
  expect(process.env.DEFAULT_SITE_ID).toBe("1");
});

test("createLocalWPContext should configure SSL when enabled", async () => {
  mockLoadSecretFn.mockResolvedValue(undefined);
  mockGetSecretFn.mockResolvedValue({
    local: {
      db_name: "test_db",
      db_user: "test_user",
      db_password: "test_pass",
      db_host: "localhost",
      db_port: 3306,
      multisite: false,
      default_blog_id: 1,
      default_site_id: 1,
      db_environment: "production",
      ssl_enabled: true,
      ssl_ca: "/path/to/ca.pem",
      ssl_cert: "/path/to/cert.pem",
      ssl_key: "/path/to/key.pem",
    },
  });

  mockGetWpContextFn.mockResolvedValue({
    current: { user: { props: { user_login: "testuser" } } },
  } as any);

  await createLocalWPContext({ configFile: undefined, username: "testuser" });

  expect(mockReadSslCertFn).toHaveBeenCalledWith("/path/to/ca.pem");
  expect(mockReadSslCertFn).toHaveBeenCalledWith("/path/to/cert.pem");
  expect(mockReadSslCertFn).toHaveBeenCalledWith("/path/to/key.pem");
  expect(mockDefineWPConfigFn).toHaveBeenCalledWith(
    expect.objectContaining({
      database: expect.objectContaining({
        connection: expect.objectContaining({
          ssl: {
            ca: "cert-content",
            cert: "cert-content",
            key: "cert-content",
            rejectUnauthorized: true,
          },
        }),
      }),
    })
  );
});

test("createLocalWPContext should register hooks and return WP context", async () => {
  mockLoadSecretFn.mockResolvedValue(undefined);
  mockGetSecretFn.mockResolvedValue({
    local: {
      db_name: "test_db",
      db_user: "test_user",
      db_password: "test_pass",
      db_host: "localhost",
      db_port: 3306,
      multisite: false,
      default_blog_id: 1,
      default_site_id: 1,
      db_environment: "development",
      ssl_enabled: false,
    },
  });

  const mockWpContext = {
    current: { user: { props: { user_login: "testuser" } } },
  };

  mockGetWpContextFn.mockResolvedValue(mockWpContext as any);

  const result = await createLocalWPContext({
    configFile: undefined,
    username: "testuser",
  });

  expect(Application.registerHooks).toHaveBeenCalled();
  expect(mockGetWpContextFn).toHaveBeenCalledWith("testuser");
  expect(result.wp).toBe(mockWpContext);
  expect(result.localConfig).toEqual({
    db_name: "test_db",
    db_user: "test_user",
    db_password: "test_pass",
    db_host: "localhost",
    db_port: 3306,
    multisite: false,
    default_blog_id: 1,
    default_site_id: 1,
    db_environment: "development",
    ssl_enabled: false,
  });
});

test("createLocalWPContext should handle multisite configuration", async () => {
  mockLoadSecretFn.mockResolvedValue(undefined);
  mockGetSecretFn.mockResolvedValue({
    local: {
      db_name: "test_db",
      db_user: "test_user",
      db_password: "test_pass",
      db_host: "localhost",
      db_port: 3306,
      multisite: true,
      default_blog_id: 5,
      default_site_id: 2,
      db_environment: "development",
      ssl_enabled: false,
    },
  });

  mockGetWpContextFn.mockResolvedValue({
    current: { user: { props: { user_login: "testuser" } } },
  } as any);

  await createLocalWPContext({ configFile: undefined, username: "testuser" });

  expect(process.env.MULTISITE).toBe("true");
  expect(process.env.DEFAULT_BLOG_ID).toBe("5");
  expect(process.env.DEFAULT_SITE_ID).toBe("2");
  expect(mockDefineWPConfigFn).toHaveBeenCalledWith(
    expect.objectContaining({
      multisite: {
        enabled: true,
        defaultBlogId: 5,
        defaultSiteId: 2,
      },
    })
  );
});

test("createLocalWPContext should use default port when not specified", async () => {
  mockLoadSecretFn.mockResolvedValue(undefined);
  mockGetSecretFn.mockResolvedValue({
    local: {
      db_name: "test_db",
      db_user: "test_user",
      db_password: "test_pass",
      db_host: "localhost",
      multisite: false,
      default_blog_id: 1,
      default_site_id: 1,
      db_environment: "development",
      ssl_enabled: false,
    },
  });

  mockGetWpContextFn.mockResolvedValue({
    current: { user: { props: { user_login: "testuser" } } },
  } as any);

  await createLocalWPContext({ configFile: undefined, username: "testuser" });

  expect(process.env.DB_PORT).toBe("3306");
});
