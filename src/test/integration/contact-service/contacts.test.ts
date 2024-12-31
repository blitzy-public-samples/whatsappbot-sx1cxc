// External imports with versions
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'; // ^29.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { faker } from '@faker-js/faker'; // ^8.0.0

// Internal imports
import { TestDatabase } from '../utils/test-database';
import { Contact } from '../../../backend/contact-service/src/models/contact';
import { ContactManager } from '../../../backend/contact-service/src/services/contact_manager';

// Test configuration constants
const TEST_TIMEOUT = 30000;
const BATCH_SIZE = 1000;
const CACHE_TTL = 900; // 15 minutes

// Sample test data
const SAMPLE_CONTACT_DATA = {
  phone_number: '+1234567890',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  metadata: { source: 'test', campaign: 'integration' },
  tags: ['test', 'integration'],
  is_active: true,
  version: 1
};

// Test database and service instances
let testDb: TestDatabase;
let contactManager: ContactManager;
let organizationId: string;

describe('Contact Service Integration Tests', () => {
  beforeAll(async () => {
    // Initialize test environment
    organizationId = uuidv4();
    testDb = new TestDatabase({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      user: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASSWORD || 'test',
      database: process.env.TEST_DB_NAME || 'test',
      poolSize: 5,
      ssl: false
    });

    await testDb.connect();
    await testDb.setupSchema();
    contactManager = new ContactManager(testDb.config, {
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      password: process.env.TEST_REDIS_PASSWORD,
      db: 0
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await testDb.cleanup({ truncate: true, cascade: true });
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanup({ truncate: true });
    await testDb.resetCache();
  });

  describe('Contact Creation', () => {
    test('should create a new contact with valid data', async () => {
      const contactData = {
        ...SAMPLE_CONTACT_DATA,
        organization_id: organizationId
      };

      const contact = await contactManager.create_contact(contactData);
      expect(contact).toBeDefined();
      expect(contact.id).toBeDefined();
      expect(contact.phone_number).toBe(contactData.phone_number);
      expect(contact.version).toBe(1);
    });

    test('should reject duplicate phone numbers', async () => {
      const contactData = {
        ...SAMPLE_CONTACT_DATA,
        organization_id: organizationId
      };

      await contactManager.create_contact(contactData);
      await expect(contactManager.create_contact(contactData))
        .rejects.toThrow('Contact with this phone number already exists');
    });

    test('should validate phone number format', async () => {
      const invalidContact = {
        ...SAMPLE_CONTACT_DATA,
        phone_number: 'invalid',
        organization_id: organizationId
      };

      await expect(contactManager.create_contact(invalidContact))
        .rejects.toThrow('Invalid phone number format');
    });

    test('should handle metadata and tags correctly', async () => {
      const contactData = {
        ...SAMPLE_CONTACT_DATA,
        metadata: { custom: 'value', nested: { data: true } },
        tags: ['vip', 'priority'],
        organization_id: organizationId
      };

      const contact = await contactManager.create_contact(contactData);
      expect(contact.metadata).toEqual(contactData.metadata);
      expect(contact.tags).toEqual(expect.arrayContaining(contactData.tags));
    });
  });

  describe('Contact Retrieval', () => {
    test('should retrieve contact by ID', async () => {
      const created = await contactManager.create_contact({
        ...SAMPLE_CONTACT_DATA,
        organization_id: organizationId
      });

      const retrieved = await contactManager.get_contact(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    test('should use cache for repeated retrievals', async () => {
      const contact = await contactManager.create_contact({
        ...SAMPLE_CONTACT_DATA,
        organization_id: organizationId
      });

      // First retrieval (cache miss)
      await contactManager.get_contact(contact.id);
      
      // Second retrieval (should hit cache)
      const start = Date.now();
      await contactManager.get_contact(contact.id);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50); // Cache retrieval should be fast
    });

    test('should handle cache expiration', async () => {
      const contact = await contactManager.create_contact({
        ...SAMPLE_CONTACT_DATA,
        organization_id: organizationId
      });

      // Force cache expiration
      await new Promise(resolve => setTimeout(resolve, CACHE_TTL + 100));

      const retrieved = await contactManager.get_contact(contact.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(contact.id);
    });
  });

  describe('Contact Updates', () => {
    test('should update contact fields', async () => {
      const contact = await contactManager.create_contact({
        ...SAMPLE_CONTACT_DATA,
        organization_id: organizationId
      });

      const updateData = {
        first_name: 'Jane',
        last_name: 'Smith',
        version: contact.version
      };

      const updated = await contactManager.update_contact(contact.id, updateData);
      expect(updated?.first_name).toBe(updateData.first_name);
      expect(updated?.last_name).toBe(updateData.last_name);
      expect(updated?.version).toBe(contact.version + 1);
    });

    test('should handle version conflicts', async () => {
      const contact = await contactManager.create_contact({
        ...SAMPLE_CONTACT_DATA,
        organization_id: organizationId
      });

      const updateData = {
        first_name: 'Jane',
        version: contact.version + 1 // Wrong version
      };

      await expect(contactManager.update_contact(contact.id, updateData))
        .rejects.toThrow('Version conflict detected');
    });

    test('should invalidate cache after update', async () => {
      const contact = await contactManager.create_contact({
        ...SAMPLE_CONTACT_DATA,
        organization_id: organizationId
      });

      // Cache the contact
      await contactManager.get_contact(contact.id);

      // Update the contact
      await contactManager.update_contact(contact.id, {
        first_name: 'Updated',
        version: contact.version
      });

      // Retrieve again - should get updated data
      const retrieved = await contactManager.get_contact(contact.id);
      expect(retrieved?.first_name).toBe('Updated');
    });
  });

  describe('Bulk Operations', () => {
    test('should import multiple contacts', async () => {
      const contacts = Array.from({ length: 10 }, () => ({
        ...SAMPLE_CONTACT_DATA,
        phone_number: faker.phone.number('+1##########'),
        organization_id: organizationId
      }));

      const results = await contactManager.bulk_import_contacts(contacts);
      expect(results.length).toBe(contacts.length);
      expect(results.every(r => r.id)).toBe(true);
    });

    test('should handle validation errors in batch', async () => {
      const contacts = [
        {
          ...SAMPLE_CONTACT_DATA,
          phone_number: 'invalid',
          organization_id: organizationId
        },
        {
          ...SAMPLE_CONTACT_DATA,
          phone_number: '+1987654321',
          organization_id: organizationId
        }
      ];

      const results = await contactManager.bulk_import_contacts(contacts);
      expect(results.length).toBe(1); // Only valid contact should be imported
    });

    test('should maintain performance under load', async () => {
      const contacts = Array.from({ length: BATCH_SIZE }, () => ({
        ...SAMPLE_CONTACT_DATA,
        phone_number: faker.phone.number('+1##########'),
        organization_id: organizationId
      }));

      const start = Date.now();
      await contactManager.bulk_import_contacts(contacts);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(TEST_TIMEOUT);
    });
  });

  describe('Search Operations', () => {
    test('should search by name', async () => {
      await contactManager.create_contact({
        ...SAMPLE_CONTACT_DATA,
        first_name: 'SearchTest',
        organization_id: organizationId
      });

      const results = await contactManager.search_contacts({
        query: 'SearchTest',
        organization_id: organizationId
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].first_name).toBe('SearchTest');
    });

    test('should filter by tags', async () => {
      await contactManager.create_contact({
        ...SAMPLE_CONTACT_DATA,
        tags: ['searchtag'],
        organization_id: organizationId
      });

      const results = await contactManager.search_contacts({
        tags: ['searchtag'],
        organization_id: organizationId
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].tags).toContain('searchtag');
    });

    test('should paginate results', async () => {
      // Create 15 contacts
      await Promise.all(Array.from({ length: 15 }, () => 
        contactManager.create_contact({
          ...SAMPLE_CONTACT_DATA,
          phone_number: faker.phone.number('+1##########'),
          organization_id: organizationId
        })
      ));

      const page1 = await contactManager.search_contacts({
        organization_id: organizationId,
        page: 1,
        page_size: 10
      });

      const page2 = await contactManager.search_contacts({
        organization_id: organizationId,
        page: 2,
        page_size: 10
      });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(5);
    });
  });
});