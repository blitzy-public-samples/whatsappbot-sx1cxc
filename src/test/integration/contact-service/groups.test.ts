// External imports with versions
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { faker } from '@faker-js/faker'; // ^8.0.0

// Internal imports
import { TestDatabase } from '../utils/test-database';
import { GroupManager } from '../../../backend/contact-service/src/services/group_manager';

// Test interfaces
interface TestGroup {
  id: string;
  name: string;
  description: string;
  organization_id: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  member_count: number;
}

interface PerformanceMetrics {
  operation: string;
  duration: number;
  memory_usage: number;
}

// Global test state
let testDb: TestDatabase;
let groupManager: GroupManager;
let testOrganizations: string[];
let performanceMetrics: PerformanceMetrics[] = [];

// Test configuration
const TEST_TIMEOUT = 10000;
const PERFORMANCE_THRESHOLD = 2000; // 2 seconds SLA
const BULK_TEST_SIZE = 1000;

describe('Contact Service - Group Management Integration Tests', () => {
  beforeAll(async () => {
    // Initialize test database
    testDb = new TestDatabase({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      user: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASSWORD || 'test',
      database: process.env.TEST_DB_NAME || 'test',
      ssl: false,
      poolSize: 5
    });

    await testDb.connect();
    await testDb.setupSchema();

    // Create test organizations
    testOrganizations = [uuidv4(), uuidv4()];

    // Initialize group manager
    groupManager = new GroupManager(testDb, {
      batch_size: 100,
      cache_ttl: 300
    });
  });

  afterAll(async () => {
    await testDb.cleanup({ truncate: true, cascade: true });
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.beginTransaction();
    performanceMetrics = [];
  });

  afterEach(async () => {
    await testDb.rollbackTransaction();
  });

  describe('Group Creation Tests', () => {
    test('should create a new group successfully', async () => {
      const startTime = Date.now();
      const groupData = {
        name: faker.company.name(),
        description: faker.lorem.sentence(),
        metadata: { category: 'test', tags: ['integration'] },
        organization_id: testOrganizations[0],
        created_by: uuidv4()
      };

      const group = await groupManager.create_group(
        groupData.name,
        groupData.description,
        groupData.metadata,
        groupData.organization_id,
        groupData.created_by
      );

      expect(group).toBeDefined();
      expect(group.id).toBeTruthy();
      expect(group.name).toBe(groupData.name);
      expect(group.organization_id).toBe(groupData.organization_id);
      expect(group.version).toBe(1);

      performanceMetrics.push({
        operation: 'create_group',
        duration: Date.now() - startTime,
        memory_usage: process.memoryUsage().heapUsed
      });
    });

    test('should validate group name requirements', async () => {
      const invalidNames = ['', ' ', 'a'.repeat(101)];

      for (const name of invalidNames) {
        await expect(groupManager.create_group(
          name,
          'test description',
          {},
          testOrganizations[0],
          uuidv4()
        )).rejects.toThrow();
      }
    });

    test('should handle duplicate group names', async () => {
      const groupName = faker.company.name();
      
      // Create first group
      await groupManager.create_group(
        groupName,
        'test description',
        {},
        testOrganizations[0],
        uuidv4()
      );

      // Attempt to create duplicate
      await expect(groupManager.create_group(
        groupName,
        'another description',
        {},
        testOrganizations[0],
        uuidv4()
      )).rejects.toThrow();
    });
  });

  describe('Group Retrieval Tests', () => {
    test('should get group by ID with proper caching', async () => {
      // Create test group
      const group = await groupManager.create_group(
        faker.company.name(),
        faker.lorem.sentence(),
        {},
        testOrganizations[0],
        uuidv4()
      );

      const startTime = Date.now();
      
      // First retrieval (from DB)
      const retrieved1 = await groupManager.get_group(group.id, testOrganizations[0]);
      const firstDuration = Date.now() - startTime;

      // Second retrieval (should be from cache)
      const retrieved2 = await groupManager.get_group(group.id, testOrganizations[0]);
      const secondDuration = Date.now() - startTime - firstDuration;

      expect(retrieved1).toEqual(retrieved2);
      expect(secondDuration).toBeLessThan(firstDuration);
    });

    test('should list groups with pagination', async () => {
      // Create multiple test groups
      const groupCount = 25;
      for (let i = 0; i < groupCount; i++) {
        await groupManager.create_group(
          faker.company.name(),
          faker.lorem.sentence(),
          {},
          testOrganizations[0],
          uuidv4()
        );
      }

      const pageSize = 10;
      const firstPage = await groupManager.list_groups(testOrganizations[0], { page: 1, size: pageSize });
      const secondPage = await groupManager.list_groups(testOrganizations[0], { page: 2, size: pageSize });

      expect(firstPage.items.length).toBe(pageSize);
      expect(secondPage.items.length).toBe(pageSize);
      expect(firstPage.total).toBe(groupCount);
    });
  });

  describe('Multi-tenant Tests', () => {
    test('should isolate groups between organizations', async () => {
      // Create groups for different organizations
      const group1 = await groupManager.create_group(
        faker.company.name(),
        faker.lorem.sentence(),
        {},
        testOrganizations[0],
        uuidv4()
      );

      const group2 = await groupManager.create_group(
        faker.company.name(),
        faker.lorem.sentence(),
        {},
        testOrganizations[1],
        uuidv4()
      );

      // Attempt cross-organization access
      await expect(groupManager.get_group(
        group1.id,
        testOrganizations[1]
      )).rejects.toThrow();

      await expect(groupManager.get_group(
        group2.id,
        testOrganizations[0]
      )).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should handle bulk member additions efficiently', async () => {
      const group = await groupManager.create_group(
        faker.company.name(),
        faker.lorem.sentence(),
        {},
        testOrganizations[0],
        uuidv4()
      );

      const contactIds = Array.from({ length: BULK_TEST_SIZE }, () => uuidv4());
      const startTime = Date.now();

      const result = await groupManager.bulk_add_contacts(
        group.id,
        contactIds,
        testOrganizations[0]
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(result.successful + result.failed).toBe(BULK_TEST_SIZE);

      performanceMetrics.push({
        operation: 'bulk_add_contacts',
        duration,
        memory_usage: process.memoryUsage().heapUsed
      });
    });
  });
});