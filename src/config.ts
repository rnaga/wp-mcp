import { z } from "zod";
import Keyv from "keyv";
import KeyvSqlite from "@keyv/sqlite";
import * as fs from "fs";
import * as path from "path";

export interface StorageConfig {
  sqlite: string[];
  env: string[];
}

type Validator = z.ZodObject<any>;

export interface ConfigOptions<T> {
  STORAGE_CONFIG: StorageConfig;
  ENV_VAR_MAP: Record<string, string>;
  validator: Validator;
  dbPath?: string;
  namespace?: string;
}

export class Config<T extends Record<string, any>> {
  private store: Keyv | null = null;
  private STORAGE_CONFIG: StorageConfig;
  private ENV_VAR_MAP: Record<string, string>;
  private validator: Validator;
  private dbPath: string;
  private namespace: string;

  constructor(options: ConfigOptions<T>) {
    this.STORAGE_CONFIG = options.STORAGE_CONFIG;
    this.ENV_VAR_MAP = options.ENV_VAR_MAP;
    this.validator = options.validator;
    this.dbPath =
      options.dbPath ||
      process.env.CONFIG_SQLITE_DB_PATH ||
      path.join(process.cwd(), "config.db");
    this.namespace = options.namespace || "config";
  }

  private getStore(): Keyv {
    if (!this.store) {
      this.store = new Keyv({
        store: new KeyvSqlite(`sqlite://${this.dbPath}`),
        namespace: this.namespace,
      });
    }
    return this.store;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private valueToString(value: any): string {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0)
    )
      return "";
    if (typeof value === "boolean") return String(value);
    if (typeof value === "number") return String(value);
    return value;
  }

  private parseValue(value: string): any {
    if (!value) return undefined;
    if (value === "true" || value === "false") {
      return value === "true";
    }
    if (!isNaN(Number(value))) {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    return value;
  }

  private async getAllFromDb(): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    const keyv = this.getStore();

    for (const key of this.STORAGE_CONFIG.sqlite) {
      const value = await keyv.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }

    return result;
  }

  private async saveToDb(key: string, value: any): Promise<void> {
    const keyv = this.getStore();

    if (value === undefined || value === null) {
      await keyv.delete(key);
      return;
    }

    await keyv.set(key, value);
  }

  private async deleteFromDb(key: string): Promise<void> {
    const keyv = this.getStore();
    await keyv.delete(key);
  }

  private hasValue(val: any): boolean {
    if (val === undefined || val === null) return false;
    if (typeof val === "string") return val.length > 0;
    if (typeof val === "object") {
      return (
        Object.keys(val).length > 0 &&
        Object.values(val).some((v) => this.hasValue(v))
      );
    }
    return true;
  }

  private cleanEmptyObjects(obj: any): void {
    for (const key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        this.cleanEmptyObjects(obj[key]);
        if (!this.hasValue(obj[key])) {
          delete obj[key];
        }
      }
    }
  }

  private flatten(obj: any, prefix = ""): Record<string, any> {
    const flatUpdates: Record<string, any> = {};

    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        obj[key] &&
        typeof obj[key] === "object" &&
        !Array.isArray(obj[key])
      ) {
        Object.assign(flatUpdates, this.flatten(obj[key], fullKey));
      } else {
        flatUpdates[fullKey] = obj[key];
      }
    }

    return flatUpdates;
  }

  getSync(): T {
    if (this.STORAGE_CONFIG.sqlite.length > 0) {
      throw new Error(
        "Cannot use getSync() when SQLite storage is configured. Use async get() instead."
      );
    }

    const result: any = {};

    // Load from .env only
    for (const key of this.STORAGE_CONFIG.env) {
      const envVar = this.ENV_VAR_MAP[key];
      if (envVar && process.env[envVar]) {
        this.setNestedValue(result, key, this.parseValue(process.env[envVar]));
      }
    }

    // Clean up empty objects
    this.cleanEmptyObjects(result);

    return this.validator.parse(result) as T;
  }

  async get(): Promise<T> {
    const result: any = {};

    // Load from .env
    for (const key of this.STORAGE_CONFIG.env) {
      const envVar = this.ENV_VAR_MAP[key];
      if (envVar && process.env[envVar]) {
        this.setNestedValue(result, key, this.parseValue(process.env[envVar]));
      }
    }

    // Load from SQLite
    const dbData = await this.getAllFromDb();
    for (const key of this.STORAGE_CONFIG.sqlite) {
      if (dbData[key] !== undefined) {
        this.setNestedValue(result, key, dbData[key]);
      }
    }

    // Clean up empty objects
    this.cleanEmptyObjects(result);

    return this.validator.parse(result) as T;
  }

  async save(
    config: T,
    filePath?: string,
    fileMode: number = 0o644
  ): Promise<void> {
    let mergedConfig: any;

    if (filePath) {
      // Get existing config for merging when file path is provided
      // quiet: true prevents dotenv from writing its banner to stdout, which
      // would corrupt the MCP stdio JSON-RPC stream
      require("dotenv").config({ path: filePath, quiet: true });
      const existingConfig = await this.get();

      // Merge with existing
      mergedConfig = JSON.parse(JSON.stringify(existingConfig));

      const deepMerge = (target: any, source: any): void => {
        for (const key in source) {
          if (
            source[key] &&
            typeof source[key] === "object" &&
            !Array.isArray(source[key])
          ) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
          } else if (source[key] !== undefined) {
            target[key] = source[key];
          }
        }
      };

      deepMerge(mergedConfig, config);
    } else {
      // When no file path, just use the provided config
      mergedConfig = config;
    }

    // Save to SQLite
    for (const key of this.STORAGE_CONFIG.sqlite) {
      const value = this.getNestedValue(mergedConfig, key);
      if (value !== undefined) {
        await this.saveToDb(key, value);
      }
    }

    // Only save to .env file if filePath is provided
    if (filePath) {
      const envLines: string[] = [];

      for (const key of this.STORAGE_CONFIG.env) {
        const value = this.getNestedValue(mergedConfig, key);
        const envVar = this.ENV_VAR_MAP[key];

        if (value !== undefined && envVar) {
          envLines.push(`${envVar}=${this.valueToString(value)}`);
        }
      }

      // Add DB path if not present
      if (!process.env.CONFIG_SQLITE_DB_PATH) {
        envLines.push(`CONFIG_SQLITE_DB_PATH=${this.dbPath}`);
      }

      // Write .env file with secure permissions
      fs.writeFileSync(filePath, envLines.join("\n"), { mode: fileMode });
    }

    // Update process.env
    for (const key of this.STORAGE_CONFIG.env) {
      const value = this.getNestedValue(mergedConfig, key);
      const envVar = this.ENV_VAR_MAP[key];

      if (envVar) {
        process.env[envVar] =
          value !== undefined ? this.valueToString(value) : "";
      }
    }
  }

  async update(updates: Partial<T>): Promise<void> {
    const flatUpdates = this.flatten(updates);

    // Update SQLite keys
    for (const key of this.STORAGE_CONFIG.sqlite) {
      if (key in flatUpdates) {
        await this.saveToDb(key, flatUpdates[key]);
      }
    }

    // Update .env keys in process.env
    for (const key of this.STORAGE_CONFIG.env) {
      if (key in flatUpdates) {
        const envVar = this.ENV_VAR_MAP[key];
        if (envVar) {
          process.env[envVar] =
            flatUpdates[key] !== undefined
              ? this.valueToString(flatUpdates[key])
              : undefined;
        }
      }
    }
  }

  async del(keys: string[]): Promise<void> {
    for (const key of keys) {
      if (this.STORAGE_CONFIG.sqlite.includes(key)) {
        await this.deleteFromDb(key);
      }

      if (this.STORAGE_CONFIG.env.includes(key)) {
        const envVar = this.ENV_VAR_MAP[key];
        if (envVar) {
          delete process.env[envVar];
        }
      }
    }
  }

  async deleteAll(): Promise<void> {
    // Delete all SQLite keys
    for (const key of this.STORAGE_CONFIG.sqlite) {
      await this.deleteFromDb(key);
    }

    // Delete all env keys from process.env
    for (const key of this.STORAGE_CONFIG.env) {
      const envVar = this.ENV_VAR_MAP[key];
      if (envVar) {
        delete process.env[envVar];
      }
    }
  }

  async loadFromEnvFile(filePath: string): Promise<T> {
    // quiet: true prevents dotenv from writing its banner to stdout, which
    // would corrupt the MCP stdio JSON-RPC stream
    require("dotenv").config({ path: filePath, quiet: true });
    return await this.get();
  }
}
