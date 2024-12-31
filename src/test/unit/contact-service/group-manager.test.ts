// External imports with versions
import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals'; // ^29.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import RedisMock from 'redis-mock'; // ^0.56.3

// Internal imports
import { GroupManager } from '../../../backend/contact-service/src/services/group_manager';
import { TestDataGenerator } from '../../utils/test-data-generator';
import { Group } from '../../../backend/contact-service/src/models/group';
import { Contact } from '../../../backend/contact-service/src/models/contact';

// Mock database session
const mockDbSession = {
  execute: jest.fn(),
  query: jest.fn(),
  add: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

// Initialize Redis mock
const mockRedisClient = RedisMock.createClient();

describe('GroupManager', () => {
  let groupManager: GroupManager;
  let testDataGenerator: TestDataGenerator;
  let testOrganizationId: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockRedisClient.flushall();

    // Initialize test data generator
    testOrganizationId = uuidv4();
    testDataGenerator = new TestDataGenerator(testOrganizationId);

    // Initialize group manager with mocked dependencies
    groupManager = new GroupManager(
      mockDbSession,
      mockRedisClient,
      {
        batch_size: 100,
        cache_ttl: 1800
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockRedisClient.flushall();
  });

  describe('create_group', () => {
    test('should successfully create a group with cache interaction', async () => {
      // Arrange
      const groupName = 'Test Group';
      const description = 'Test Description';
      const metadata = { category: 'test' };
      const createdBy = uuidv4();

      const expectedGroup = {
        id: expect.any(String),
        name: groupName,
        description,
        metadata,
        organization_id: testOrganizationId,
        created_by: createdBy,
        is_deleted: false,
        version: 1
      };

      mockDbSession.query.mockResolvedValueOnce({ first: () => null });
      mockDbSession.add.mockResolvedValueOnce(undefined);
      mockDbSession.commit.mockResolvedValueOnce(undefined);

      // Act
      const result = await groupManager.create_group(
        groupName,
        description,
        metadata,
        testOrganizationId,
        createdBy
      );

      // Assert
      expect(result).toMatchObject(expectedGroup);
      expect(mockDbSession.query).toHaveBeenCalledTimes(1);
      expect(mockDbSession.add).toHaveBeenCalledTimes(1);
      expect(mockDbSession.commit).toHaveBeenCalledTimes(1);
      
      // Verify cache interaction
      const cachedGroup = await new Promise((resolve) => {
        mockRedisClient.get(`group:${result.id}`, (err, data) => {
          resolve(data ? JSON.parse(data) : null);
        });
      });
      expect(cachedGroup).toMatchObject(expectedGroup);
    });

    test('should throw error when group name already exists', async () => {
      // Arrange
      const existingGroup = testDataGenerator.generateGroup();
      mockDbSession.query.mockResolvedValueOnce({ first: () => existingGroup });

      // Act & Assert
      await expect(
        groupManager.create_group(
          existingGroup.name,
          'description',
          {},
          testOrganizationId,
          uuidv4()
        )
      ).rejects.toThrow('Group name already exists in organization');
    });
  });

  describe('update_group', () => {
    test('should successfully update group and refresh cache', async () => {
      // Arrange
      const existingGroup = testDataGenerator.generateGroup();
      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated Description',
        metadata: { updated: true }
      };

      mockDbSession.query.mockResolvedValueOnce({ first: () => existingGroup });
      mockDbSession.commit.mockResolvedValueOnce(undefined);

      // Act
      const result = await groupManager.update_group(
        existingGroup.id,
        updateData,
        testOrganizationId
      );

      // Assert
      expect(result).toBe(true);
      expect(mockDbSession.commit).toHaveBeenCalledTimes(1);
      
      // Verify cache update
      const cachedGroup = await new Promise((resolve) => {
        mockRedisClient.get(`group:${existingGroup.id}`, (err, data) => {
          resolve(data ? JSON.parse(data) : null);
        });
      });
      expect(cachedGroup).toMatchObject({
        ...existingGroup,
        ...updateData,
        version: existingGroup.version + 1
      });
    });

    test('should throw error when group not found', async () => {
      // Arrange
      mockDbSession.query.mockResolvedValueOnce({ first: () => null });

      // Act & Assert
      await expect(
        groupManager.update_group(
          uuidv4(),
          { name: 'New Name' },
          testOrganizationId
        )
      ).rejects.toThrow('Group not found or access denied');
    });
  });

  describe('bulk_add_contacts', () => {
    test('should successfully add multiple contacts to group', async () => {
      // Arrange
      const group = testDataGenerator.generateGroup();
      const contacts = await testDataGenerator.generateBulk<Contact>('contact', 5);
      const contactIds = contacts.map(c => c.id);

      mockDbSession.query
        .mockResolvedValueOnce({ first: () => group })
        .mockResolvedValueOnce({ all: () => contacts });
      mockDbSession.commit.mockResolvedValueOnce(undefined);

      // Act
      const result = await groupManager.bulk_add_contacts(
        group.id,
        contactIds,
        testOrganizationId
      );

      // Assert
      expect(result).toEqual({
        total: contactIds.length,
        successful: contactIds.length,
        failed: 0,
        errors: []
      });
      expect(mockDbSession.commit).toHaveBeenCalledTimes(1);
      
      // Verify cache update
      const cachedGroup = await new Promise((resolve) => {
        mockRedisClient.get(`group:${group.id}`, (err, data) => {
          resolve(data ? JSON.parse(data) : null);
        });
      });
      expect(cachedGroup.member_count).toBe(contactIds.length);
    });

    test('should handle partial failures in bulk add operation', async () => {
      // Arrange
      const group = testDataGenerator.generateGroup();
      const validContacts = await testDataGenerator.generateBulk<Contact>('contact', 3);
      const invalidContactIds = [uuidv4(), uuidv4()];
      const allContactIds = [...validContacts.map(c => c.id), ...invalidContactIds];

      mockDbSession.query
        .mockResolvedValueOnce({ first: () => group })
        .mockResolvedValueOnce({ all: () => validContacts });
      mockDbSession.commit.mockResolvedValueOnce(undefined);

      // Act
      const result = await groupManager.bulk_add_contacts(
        group.id,
        allContactIds,
        testOrganizationId
      );

      // Assert
      expect(result).toEqual({
        total: allContactIds.length,
        successful: validContacts.length,
        failed: invalidContactIds.length,
        errors: invalidContactIds.map(id => `Contact not found: ${id}`)
      });
    });
  });

  // Add more test suites for other GroupManager methods...
});