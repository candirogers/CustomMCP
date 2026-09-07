/**
 * Logger utility for consistent logging across the MCP system
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private verbose: boolean = false;

  setLevel(levelOrName: LogLevel | 'debug' | 'info' | 'warn' | 'error'): void {
    if (typeof levelOrName === 'string') {
      const levels: Record<string, LogLevel> = {
        debug: LogLevel.DEBUG,
        info: LogLevel.INFO,
        warn: LogLevel.WARN,
        error: LogLevel.ERROR,
      };
      this.level = levels[levelOrName] || LogLevel.INFO;
    } else {
      this.level = levelOrName;
    }
  }

  private formatMessage(levelName: string, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    let output = `[${timestamp}] [${levelName}] ${message}`;
    if (context && Object.keys(context).length > 0) {
      output += ` ${JSON.stringify(context)}`;
    }
    return output;
  }

  debug(message: string, context?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: any): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: any): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.level <= LogLevel.ERROR) {
      let context: any = {};
      if (error instanceof Error) {
        context = {
          message: error.message,
          stack: error.stack,
        };
      } else if (typeof error === 'object') {
        context = error;
      }
      console.error(this.formatMessage('ERROR', message, context));
    }
  }
}

export const logger = new Logger();
