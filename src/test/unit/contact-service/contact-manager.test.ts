// External imports with version specifications
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // ^29.0.0
import sinon from 'sinon'; // ^15.0.0
import { faker } from '@faker-js/faker'; // ^8.0.0

// Internal imports
import { ContactManager } from '../../../backend/contact-service/src/services/contact_manager';
import { TestDataGenerator } from '../../utils/test-data-generator';
import { Contact, ContactSchema } from '../../../backend/contact-service/src/models/contact';

// Test constants
const TEST_TIMEOUT = 10000;
const MOCK_ORG_ID = 'test-org-123';
const PERFORMANCE_THRESHOLD = 100; // milliseconds

describe('ContactManager', () => {
    let contactManager: ContactManager;
    let testDataGenerator: TestDataGenerator;
    let dbMock: sinon.SinonMock;
    let redisMock: sinon.SinonMock;
    let loggerMock: sinon.SinonMock;
    let metricsMock: sinon.SinonMock;
    let sessionMock: any;

    beforeEach(() => {
        // Initialize test data generator
        testDataGenerator = new TestDataGenerator(MOCK_ORG_ID);

        // Setup database mock
        sessionMock = {
            query: jest.fn(),
            add: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            close: jest.fn()
        };

        // Setup Redis mock
        const redisMockImpl = {
            setex: jest.fn(),
            get: jest.fn(),
            del: jest.fn()
        };

        // Setup mocks
        dbMock = sinon.mock(sessionMock);
        redisMock = sinon.mock(redisMockImpl);
        loggerMock = sinon.mock({ error: jest.fn(), info: jest.fn() });
        metricsMock = sinon.mock({
            contact_operations: { labels: () => ({ inc: jest.fn() }) },
            operation_duration: { labels: () => ({ observe: jest.fn() }) },
            cache_hits: { inc: jest.fn() },
            cache_misses: { inc: jest.fn() }
        });

        // Initialize ContactManager with mocked dependencies
        contactManager = new ContactManager({
            get_connection_url: () => 'mock-db-url',
        }, {
            get_connection_params: () => ({
                host: 'localhost',
                port: 6379
            })
        });

        // Replace real implementations with mocks
        (contactManager as any).Session = () => sessionMock;
        (contactManager as any).redis_client = redisMockImpl;
        (contactManager as any).logger = loggerMock;
        (contactManager as any).metrics = metricsMock;
    });

    afterEach(() => {
        // Restore all mocks
        sinon.restore();
        jest.clearAllMocks();
    });

    describe('create_contact', () => {
        it('should create contact with proper validation', async () => {
            // Arrange
            const contactData = testDataGenerator.generateContact();
            dbMock.expects('query').returns({ first: () => null });
            dbMock.expects('add').once();
            dbMock.expects('commit').once();

            // Act
            const start = Date.now();
            const result = await contactManager.create_contact(contactData);
            const duration = Date.now() - start;

            // Assert
            expect(result).toBeDefined();
            expect(result.phone_number).toBe(contactData.phone_number);
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
            dbMock.verify();
        });

        it('should handle duplicate detection with version check', async () => {
            // Arrange
            const existingContact = testDataGenerator.generateContact();
            dbMock.expects('query').returns({ first: () => existingContact });

            // Act & Assert
            await expect(contactManager.create_contact(existingContact))
                .rejects.toThrow('Contact with this phone number already exists');
        });

        it('should validate phone number format internationally', async () => {
            // Arrange
            const invalidContact = testDataGenerator.generateContact({
                phone_number: 'invalid-number'
            });

            // Act & Assert
            await expect(contactManager.create_contact(invalidContact))
                .rejects.toThrow('Invalid phone number format');
        });

        it('should handle concurrent creation conflicts', async () => {
            // Arrange
            const contactData = testDataGenerator.generateContact();
            dbMock.expects('query').returns({ first: () => null });
            dbMock.expects('add').throws(new Error('Concurrent modification'));
            dbMock.expects('rollback').once();

            // Act & Assert
            await expect(contactManager.create_contact(contactData))
                .rejects.toThrow('Concurrent modification');
        });
    });

    describe('get_contact', () => {
        it('should retrieve contact from cache when available', async () => {
            // Arrange
            const cachedContact = testDataGenerator.generateContact();
            redisMock.expects('get').returns(JSON.stringify(cachedContact));
            metricsMock.expects('cache_hits').inc().once();

            // Act
            const result = await contactManager.get_contact(cachedContact.id);

            // Assert
            expect(result).toEqual(cachedContact);
            redisMock.verify();
            metricsMock.verify();
        });

        it('should fetch from database when cache misses', async () => {
            // Arrange
            const contact = testDataGenerator.generateContact();
            redisMock.expects('get').returns(null);
            dbMock.expects('query').returns({ first: () => contact });
            redisMock.expects('setex').once();

            // Act
            const result = await contactManager.get_contact(contact.id);

            // Assert
            expect(result).toEqual(contact);
            dbMock.verify();
            redisMock.verify();
        });
    });

    describe('update_contact', () => {
        it('should handle version conflicts during update', async () => {
            // Arrange
            const contact = testDataGenerator.generateContact();
            const updateData = { ...contact, version: contact.version + 1 };
            dbMock.expects('query').returns({ first: () => contact });

            // Act & Assert
            await expect(contactManager.update_contact(contact.id, updateData))
                .rejects.toThrow('Version conflict detected');
        });

        it('should invalidate cache after successful update', async () => {
            // Arrange
            const contact = testDataGenerator.generateContact();
            const updateData = { ...contact, first_name: 'Updated' };
            dbMock.expects('query').returns({ first: () => contact });
            redisMock.expects('del').once();
            redisMock.expects('setex').once();

            // Act
            const result = await contactManager.update_contact(contact.id, updateData);

            // Assert
            expect(result.first_name).toBe('Updated');
            redisMock.verify();
        });
    });

    describe('bulk_import_contacts', () => {
        it('should handle batch processing with proper error handling', async () => {
            // Arrange
            const contacts = await testDataGenerator.generateBulk('contact', 5);
            dbMock.expects('add').times(contacts.length);
            dbMock.expects('commit').once();

            // Act
            const result = await contactManager.bulk_import_contacts(contacts);

            // Assert
            expect(result.successful).toBe(contacts.length);
            expect(result.failed).toBe(0);
            dbMock.verify();
        });

        it('should continue processing on partial failures', async () => {
            // Arrange
            const contacts = await testDataGenerator.generateBulk('contact', 3);
            dbMock.expects('add').onFirstCall().throws(new Error('Validation failed'));
            dbMock.expects('add').twice();
            dbMock.expects('commit').once();

            // Act
            const result = await contactManager.bulk_import_contacts(contacts);

            // Assert
            expect(result.successful).toBe(2);
            expect(result.failed).toBe(1);
            dbMock.verify();
        });
    });

    describe('search_contacts', () => {
        it('should apply proper filters and pagination', async () => {
            // Arrange
            const filters = {
                organization_id: MOCK_ORG_ID,
                is_active: true,
                search_term: 'test'
            };
            const pagination = { page: 1, limit: 10 };
            dbMock.expects('query').returns({
                filter: () => ({ count: () => 20 }),
                offset: () => ({ limit: () => testDataGenerator.generateBulk('contact', 10) })
            });

            // Act
            const result = await contactManager.search_contacts(filters, pagination);

            // Assert
            expect(result.contacts.length).toBe(10);
            expect(result.total).toBe(20);
            dbMock.verify();
        });
    });
});