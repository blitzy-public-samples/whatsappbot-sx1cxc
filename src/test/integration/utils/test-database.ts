// External imports with versions
import { Pool, PoolClient, QueryResult } from 'pg'; // ^8.11.0
import { afterAll, beforeAll, beforeEach } from '@jest/globals'; // ^29.0.0

// Internal imports
import { TestDataGenerator } from '../../utils/test-data-generator';

/**
 * Interface for enhanced database configuration with comprehensive connection options
 */
interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolSize: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  ssl: boolean | SSLConfig;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Interface for SSL configuration options
 */
interface SSLConfig {
  rejectUnauthorized: boolean;
  ca?: string;
  key?: string;
  cert?: string;
}

/**
 * Interface for query execution options
 */
interface QueryOptions {
  timeout?: number;
  retryOnError?: boolean;
}

/**
 * Interface for data seeding options
 */
interface SeedOptions {
  contacts?: number;
  messages?: number;
  templates?: number;
  preserveExisting?: boolean;
}

/**
 * Interface for cleanup options
 */
interface CleanupOptions {
  truncate?: boolean;
  resetSequences?: boolean;
  cascade?: boolean;
}

// Constants for database operations
const DEFAULT_SCHEMA = 'test';
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_POOL_SIZE = 10;
const DEFAULT_IDLE_TIMEOUT = 10000;
const DEFAULT_CONNECTION_TIMEOUT = 3000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

/**
 * Enhanced utility class for managing test database operations during integration tests
 */
export class TestDatabase {
  private pool: Pool;
  private client: PoolClient | null;
  private dataGenerator: TestDataGenerator;
  private config: DatabaseConfig;
  private isConnected: boolean;
  private activeTransaction: boolean;

  /**
   * Initialize the test database manager with enhanced configuration
   * @param config Database configuration options
   */
  constructor(config: DatabaseConfig) {
    this.config = {
      ...config,
      poolSize: config.poolSize || DEFAULT_POOL_SIZE,
      idleTimeoutMillis: config.idleTimeoutMillis || DEFAULT_IDLE_TIMEOUT,
      connectionTimeoutMillis: config.connectionTimeoutMillis || DEFAULT_CONNECTION_TIMEOUT,
      retryAttempts: config.retryAttempts || MAX_RETRY_ATTEMPTS,
      retryDelay: config.retryDelay || RETRY_DELAY
    };

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      max: this.config.poolSize,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      ssl: this.config.ssl
    });

    this.client = null;
    this.isConnected = false;
    this.activeTransaction = false;
    this.dataGenerator = new TestDataGenerator();

    // Set up pool error handler
    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Establish database connection with retry mechanism
   */
  async connect(): Promise<void> {
    let attempts = 0;
    while (attempts < this.config.retryAttempts) {
      try {
        this.client = await this.pool.connect();
        await this.client.query(`SET search_path TO ${DEFAULT_SCHEMA},public`);
        this.isConnected = true;
        return;
      } catch (error) {
        attempts++;
        if (attempts === this.config.retryAttempts) {
          throw new Error(`Failed to connect to database after ${attempts} attempts: ${error}`);
        }
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }
  }

  /**
   * Safely close database connections and release resources
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.release();
      this.client = null;
    }
    await this.pool.end();
    this.isConnected = false;
  }

  /**
   * Begin a new database transaction
   */
  async beginTransaction(): Promise<void> {
    if (!this.client) throw new Error('Database not connected');
    if (this.activeTransaction) throw new Error('Transaction already in progress');

    await this.client.query('BEGIN');
    this.activeTransaction = true;
  }

  /**
   * Commit the current transaction
   */
  async commitTransaction(): Promise<void> {
    if (!this.client) throw new Error('Database not connected');
    if (!this.activeTransaction) throw new Error('No active transaction');

    await this.client.query('COMMIT');
    this.activeTransaction = false;
  }

  /**
   * Rollback the current transaction
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.client) throw new Error('Database not connected');
    if (!this.activeTransaction) throw new Error('No active transaction');

    await this.client.query('ROLLBACK');
    this.activeTransaction = false;
  }

  /**
   * Execute a parameterized SQL query with error handling
   * @param query SQL query string
   * @param params Query parameters
   * @param options Query execution options
   */
  async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    if (!this.client) throw new Error('Database not connected');

    try {
      const timeout = options.timeout || DEFAULT_TIMEOUT;
      await this.client.query(`SET statement_timeout TO ${timeout}`);

      const result = await this.client.query<T>(query, params);
      await this.client.query('SET statement_timeout TO DEFAULT');
      return result;
    } catch (error) {
      if (options.retryOnError) {
        await this.rollbackTransaction();
        await this.beginTransaction();
        return this.executeQuery(query, params, { ...options, retryOnError: false });
      }
      throw error;
    }
  }

  /**
   * Create and validate test database schema
   */
  async setupSchema(): Promise<void> {
    await this.beginTransaction();
    try {
      // Create schema if not exists
      await this.executeQuery(`CREATE SCHEMA IF NOT EXISTS ${DEFAULT_SCHEMA}`);

      // Create tables with proper constraints and indexes
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${DEFAULT_SCHEMA}.contacts (
          id UUID PRIMARY KEY,
          phone_number VARCHAR(20) NOT NULL UNIQUE,
          first_name VARCHAR(50) NOT NULL,
          last_name VARCHAR(50) NOT NULL,
          email VARCHAR(255),
          metadata JSONB DEFAULT '{}',
          tags TEXT[] DEFAULT ARRAY[]::TEXT[],
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_contacted_at TIMESTAMP WITH TIME ZONE,
          organization_id UUID NOT NULL,
          is_deleted BOOLEAN DEFAULT FALSE,
          version INTEGER DEFAULT 1
        )
      `);

      // Add indexes for performance
      await this.executeQuery(`
        CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON ${DEFAULT_SCHEMA}.contacts(phone_number);
        CREATE INDEX IF NOT EXISTS idx_contacts_organization ON ${DEFAULT_SCHEMA}.contacts(organization_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_tags ON ${DEFAULT_SCHEMA}.contacts USING gin(tags);
        CREATE INDEX IF NOT EXISTS idx_contacts_metadata ON ${DEFAULT_SCHEMA}.contacts USING gin(metadata);
      `);

      await this.commitTransaction();
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Seed test database with sample data using transactions
   * @param options Seeding options
   */
  async seedData(options: SeedOptions = {}): Promise<void> {
    await this.beginTransaction();
    try {
      if (!options.preserveExisting) {
        await this.cleanup({ truncate: true });
      }

      // Seed contacts
      if (options.contacts) {
        const contacts = await this.dataGenerator.generateBulk('contact', options.contacts);
        for (const contact of contacts) {
          await this.executeQuery(
            `INSERT INTO ${DEFAULT_SCHEMA}.contacts 
             (id, phone_number, first_name, last_name, email, metadata, tags, organization_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              contact.id,
              contact.phone_number,
              contact.first_name,
              contact.last_name,
              contact.email,
              contact.metadata,
              contact.tags,
              contact.organization_id
            ]
          );
        }
      }

      // Additional seeding for messages and templates can be added here

      await this.commitTransaction();
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Perform comprehensive database cleanup with cascading
   * @param options Cleanup options
   */
  async cleanup(options: CleanupOptions = {}): Promise<void> {
    await this.beginTransaction();
    try {
      if (options.truncate) {
        const cascade = options.cascade ? 'CASCADE' : '';
        await this.executeQuery(`TRUNCATE TABLE ${DEFAULT_SCHEMA}.contacts ${cascade}`);
        
        if (options.resetSequences) {
          await this.executeQuery(`
            DO $$ 
            DECLARE 
              r RECORD;
            BEGIN
              FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = '${DEFAULT_SCHEMA}') 
              LOOP
                EXECUTE 'ALTER SEQUENCE ' || quote_ident(r.sequencename) || ' RESTART WITH 1';
              END LOOP;
            END $$;
          `);
        }
      }
      await this.commitTransaction();
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Register Jest lifecycle hooks for database setup and teardown
   */
  registerJestHooks(): void {
    beforeAll(async () => {
      await this.connect();
      await this.setupSchema();
    });

    beforeEach(async () => {
      await this.cleanup({ truncate: true, resetSequences: true });
    });

    afterAll(async () => {
      await this.disconnect();
    });
  }
}