type LogLevel = "info" | "warn" | "error" | "debug";

export let logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

type ConsoleParams = Parameters<Console["log"]>;

abstract class Logger {
  abstract log(level: LogLevel, ...args: ConsoleParams): void;

  error(...args: ConsoleParams): void {
    this.log("error", ...args);
  }

  warn(...args: ConsoleParams): void {
    this.log("warn", ...args);
  }

  info(...args: ConsoleParams): void {
    this.log("info", ...args);
  }

  debug(...args: ConsoleParams): void {
    this.log("debug", ...args);
  }

  set logLevel(level: LogLevel) {
    logLevel = level;
  }

  get console(): Console {
    return console;
  }

  protected shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(logLevel);
  }
}

class ConsoleLogger extends Logger {
  log(level: LogLevel, ...args: ConsoleParams): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();

      if (level === "error") {
        // Errors should be output to stderr (2)
        console.error(`[${timestamp}] [${level.toUpperCase()}]`, ...args);
        return;
      }

      if (level === "warn") {
        // Warnings should be output to stderr (2)
        console.warn(`[${timestamp}] [${level.toUpperCase()}]`, ...args);
        return;
      }

      console.log(`[${timestamp}] [${level.toUpperCase()}]`, ...args);
    }
  }
}

const loggerInstance = new ConsoleLogger();
export const logger = loggerInstance;

export class McpStdioLogger extends Logger {
  log(level: LogLevel, ...args: ConsoleParams): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();

      // MCP logging should be output to stderr (2) as stdout (1) is reserved for machine-readable output
      console.error(`[${timestamp}] [${level.toUpperCase()}]`, ...args);
    }
  }
}

const mcpLoggerInstance = new McpStdioLogger();
export const mcpLogger = mcpLoggerInstance;
