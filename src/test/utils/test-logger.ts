import winston from 'winston'; // ^3.10.0
import chalk from 'chalk'; // ^4.1.2

/**
 * Standard log levels for consistent logging across the test suite
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Configuration interface for customizing logger behavior
 */
export interface LoggerConfig {
  level: LogLevel;
  silent: boolean;
  outputFile?: string;
  maxFileSize: number;
  maxFiles: number;
  colorize: boolean;
}

/**
 * Contextual information for each log entry
 */
export interface LogContext {
  testName: string;
  testPhase: string;
  timestamp: Date;
  correlationId: string;
  metadata: Record<string, unknown>;
}

/**
 * Default configuration for the TestLogger
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  silent: false,
  outputFile: undefined,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 5,
  colorize: true
};

/**
 * Core logging utility class with comprehensive logging capabilities
 * and configuration options for test execution
 */
export class TestLogger {
  private logger: winston.Logger;
  private config: LoggerConfig;
  private buffer: Array<{ level: LogLevel; message: string; context: LogContext }>;
  private isInitialized: boolean;

  /**
   * Creates a new instance of TestLogger with the specified configuration
   * @param config - Partial configuration to override defaults
   */
  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buffer = [];
    this.isInitialized = false;
    this.initializeLogger();
  }

  /**
   * Initializes the Winston logger instance with configured transports
   */
  private initializeLogger(): void {
    const transports: winston.transport[] = [];

    // Configure console transport
    const consoleTransport = new winston.transports.Console({
      level: this.config.level,
      silent: this.config.silent,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) => {
          const color = this.getLevelColor(level as LogLevel);
          return this.config.colorize
            ? color(`${timestamp} [${level.toUpperCase()}] ${message}`)
            : `${timestamp} [${level.toUpperCase()}] ${message}`;
        })
      )
    });

    transports.push(consoleTransport);

    // Configure file transport if specified
    if (this.config.outputFile) {
      const fileTransport = new winston.transports.File({
        filename: this.config.outputFile,
        level: this.config.level,
        maxsize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      });
      transports.push(fileTransport);
    }

    // Create Winston logger instance
    this.logger = winston.createLogger({
      transports,
      exitOnError: false
    });

    // Set up error handling
    this.logger.on('error', (error) => {
      console.error('Logger internal error:', error);
    });

    this.isInitialized = true;
    this.flushBuffer();
  }

  /**
   * Core logging function that handles all log levels
   * @param level - Log level for the message
   * @param message - Message to be logged
   * @param context - Contextual information for the log entry
   */
  public log(level: LogLevel, message: string, context: LogContext): void {
    const logEntry = {
      level,
      message: this.formatMessage(message, context),
      context
    };

    if (!this.isInitialized) {
      this.buffer.push(logEntry);
      return;
    }

    try {
      this.logger.log(level, logEntry.message, {
        context: this.sanitizeContext(context)
      });
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  /**
   * Convenience method for debug level logging
   * @param message - Debug message to be logged
   * @param context - Contextual information
   */
  public debug(message: string, context: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Enhanced error logging with stack trace and error details
   * @param message - Error message
   * @param error - Error object
   * @param context - Contextual information
   */
  public error(message: string, error: Error, context: LogContext): void {
    const enhancedContext = {
      ...context,
      metadata: {
        ...context.metadata,
        errorName: error.name,
        stackTrace: error.stack
      }
    };

    this.log(
      LogLevel.ERROR,
      `${message}\nError: ${error.message}`,
      enhancedContext
    );
  }

  /**
   * Formats the log message with context information
   * @param message - Raw message
   * @param context - Context information
   * @returns Formatted message string
   */
  private formatMessage(message: string, context: LogContext): string {
    return `[${context.testName}][${context.testPhase}] ${message}`;
  }

  /**
   * Returns the appropriate chalk color function for the log level
   * @param level - Log level
   * @returns Chalk color function
   */
  private getLevelColor(level: LogLevel): chalk.Chalk {
    switch (level) {
      case LogLevel.ERROR:
        return chalk.red;
      case LogLevel.WARN:
        return chalk.yellow;
      case LogLevel.INFO:
        return chalk.blue;
      case LogLevel.DEBUG:
        return chalk.gray;
      default:
        return chalk.white;
    }
  }

  /**
   * Sanitizes context object for safe logging
   * @param context - Raw context object
   * @returns Sanitized context object
   */
  private sanitizeContext(context: LogContext): Record<string, unknown> {
    return {
      testName: context.testName,
      testPhase: context.testPhase,
      correlationId: context.correlationId,
      timestamp: context.timestamp,
      metadata: this.sanitizeMetadata(context.metadata)
    };
  }

  /**
   * Sanitizes metadata object to prevent circular references
   * @param metadata - Raw metadata object
   * @returns Sanitized metadata object
   */
  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(metadata));
  }

  /**
   * Flushes the buffer once logger is initialized
   */
  private flushBuffer(): void {
    while (this.buffer.length > 0) {
      const entry = this.buffer.shift();
      if (entry) {
        this.log(entry.level, entry.message, entry.context);
      }
    }
  }
}