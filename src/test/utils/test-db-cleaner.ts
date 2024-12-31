import { Knex } from 'knex'; // ^2.5.0
import { Pool } from 'pg'; // ^8.11.0
import { TestLogger } from './test-logger';

/**
 * Represents table dependency information with circular dependency handling
 */
interface TableDependency {
  tableName: string;
  dependencies: string[];
  circularDependencies: string[];
}

/**
 * Configuration options for database cleanup operations
 */
interface CleanupOptions {
  batchSize: number;
  retryAttempts: number;
  timeout: number;
}

/**
 * Default cleanup options
 */
const DEFAULT_CLEANUP_OPTIONS: CleanupOptions = {
  batchSize: 1000,
  retryAttempts: 3,
  timeout: 30000 // 30 seconds
};

/**
 * Handles cleaning and resetting of test database state with advanced error
 * recovery and performance optimization
 */
export class TestDatabaseCleaner {
  private readonly knexInstance: Knex;
  private readonly logger: TestLogger;
  private readonly dependencyCache: Map<string, TableDependency>;
  private readonly options: CleanupOptions;

  /**
   * Creates a new instance of TestDatabaseCleaner
   * @param knexInstance - Knex database instance
   * @param options - Optional cleanup configuration
   */
  constructor(knexInstance: Knex, options: Partial<CleanupOptions> = {}) {
    this.knexInstance = knexInstance;
    this.logger = new TestLogger();
    this.dependencyCache = new Map<string, TableDependency>();
    this.options = { ...DEFAULT_CLEANUP_OPTIONS, ...options };

    // Validate database connection
    this.validateConnection();
  }

  /**
   * Validates the database connection
   * @throws Error if connection is invalid
   */
  private async validateConnection(): Promise<void> {
    try {
      await this.knexInstance.raw('SELECT 1');
    } catch (error) {
      this.logger.error(
        'Failed to validate database connection',
        error as Error,
        {
          testName: 'DatabaseCleaner',
          testPhase: 'Initialization',
          timestamp: new Date(),
          correlationId: 'init',
          metadata: {}
        }
      );
      throw new Error('Invalid database connection');
    }
  }

  /**
   * Cleans all tables in the database while respecting foreign key constraints
   */
  public async cleanDatabase(): Promise<void> {
    const trx = await this.knexInstance.transaction();

    try {
      // Get all tables and their dependencies
      const dependencies = await this.getTableDependencies();
      const sortedTables = this.topologicalSort(dependencies);

      // Disable triggers temporarily
      await trx.raw('SET session_replication_role = replica');

      // Clean tables in batches
      for (const tableName of sortedTables) {
        await this.cleanTable(tableName, { transaction: trx });
      }

      // Reset sequences
      await this.resetSequences(trx);

      // Re-enable triggers
      await trx.raw('SET session_replication_role = DEFAULT');

      await trx.commit();

      this.logger.log('info', 'Database cleanup completed successfully', {
        testName: 'DatabaseCleaner',
        testPhase: 'Cleanup',
        timestamp: new Date(),
        correlationId: 'cleanup',
        metadata: { tablesProcessed: sortedTables.length }
      });
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Cleans a specific table and resets its sequences
   * @param tableName - Name of the table to clean
   * @param options - Optional cleanup options
   */
  public async cleanTable(
    tableName: string,
    options: { transaction?: Knex.Transaction } = {}
  ): Promise<void> {
    const trx = options.transaction || await this.knexInstance.transaction();

    try {
      // Verify table exists
      const tableExists = await this.knexInstance.schema.hasTable(tableName);
      if (!tableExists) {
        throw new Error(`Table ${tableName} does not exist`);
      }

      // Truncate table with cascade
      await trx.raw(`TRUNCATE TABLE "${tableName}" CASCADE`);

      if (!options.transaction) {
        await trx.commit();
      }

      this.logger.log('info', `Table ${tableName} cleaned successfully`, {
        testName: 'DatabaseCleaner',
        testPhase: 'TableCleanup',
        timestamp: new Date(),
        correlationId: 'table-cleanup',
        metadata: { tableName }
      });
    } catch (error) {
      if (!options.transaction) {
        await trx.rollback();
      }
      throw error;
    }
  }

  /**
   * Gets table dependencies based on foreign key relationships
   */
  public async getTableDependencies(): Promise<Map<string, TableDependency>> {
    if (this.dependencyCache.size > 0) {
      return this.dependencyCache;
    }

    const result = await this.knexInstance.raw(`
      SELECT
        tc.table_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
    `);

    const dependencies = new Map<string, TableDependency>();

    // Initialize all tables
    for (const row of result.rows) {
      if (!dependencies.has(row.table_name)) {
        dependencies.set(row.table_name, {
          tableName: row.table_name,
          dependencies: [],
          circularDependencies: []
        });
      }
      if (!dependencies.has(row.foreign_table_name)) {
        dependencies.set(row.foreign_table_name, {
          tableName: row.foreign_table_name,
          dependencies: [],
          circularDependencies: []
        });
      }
    }

    // Build dependency graph
    for (const row of result.rows) {
      const tableDep = dependencies.get(row.table_name)!;
      if (!tableDep.dependencies.includes(row.foreign_table_name)) {
        tableDep.dependencies.push(row.foreign_table_name);
      }
    }

    // Detect circular dependencies
    this.detectCircularDependencies(dependencies);

    this.dependencyCache = dependencies;
    return dependencies;
  }

  /**
   * Resets all sequences in the database to initial values
   * @param trx - Optional transaction object
   */
  public async resetSequences(trx?: Knex.Transaction): Promise<void> {
    const query = `
      SELECT sequence_name
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
    `;

    const sequences = await (trx || this.knexInstance).raw(query);

    for (const seq of sequences.rows) {
      await (trx || this.knexInstance).raw(
        `ALTER SEQUENCE "${seq.sequence_name}" RESTART WITH 1`
      );
    }

    this.logger.log('info', 'Sequences reset successfully', {
      testName: 'DatabaseCleaner',
      testPhase: 'SequenceReset',
      timestamp: new Date(),
      correlationId: 'sequence-reset',
      metadata: { sequencesReset: sequences.rows.length }
    });
  }

  /**
   * Performs topological sort on tables based on their dependencies
   * @param dependencies - Map of table dependencies
   * @returns Sorted array of table names
   */
  private topologicalSort(
    dependencies: Map<string, TableDependency>
  ): string[] {
    const visited = new Set<string>();
    const sorted: string[] = [];

    const visit = (tableName: string, path: Set<string>) => {
      if (path.has(tableName)) {
        return; // Skip circular dependencies
      }
      if (visited.has(tableName)) {
        return;
      }

      path.add(tableName);
      const node = dependencies.get(tableName);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep, new Set(path));
        }
      }
      path.delete(tableName);
      visited.add(tableName);
      sorted.unshift(tableName);
    };

    for (const [tableName] of dependencies) {
      visit(tableName, new Set());
    }

    return sorted;
  }

  /**
   * Detects and marks circular dependencies in the dependency graph
   * @param dependencies - Map of table dependencies
   */
  private detectCircularDependencies(
    dependencies: Map<string, TableDependency>
  ): void {
    const visited = new Set<string>();
    const path = new Set<string>();

    const detect = (tableName: string) => {
      if (path.has(tableName)) {
        // Found circular dependency
        const node = dependencies.get(tableName)!;
        for (const dep of path) {
          const depNode = dependencies.get(dep)!;
          if (!depNode.circularDependencies.includes(tableName)) {
            depNode.circularDependencies.push(tableName);
          }
        }
        return;
      }

      if (visited.has(tableName)) {
        return;
      }

      visited.add(tableName);
      path.add(tableName);

      const node = dependencies.get(tableName);
      if (node) {
        for (const dep of node.dependencies) {
          detect(dep);
        }
      }

      path.delete(tableName);
    };

    for (const [tableName] of dependencies) {
      detect(tableName);
    }
  }
}