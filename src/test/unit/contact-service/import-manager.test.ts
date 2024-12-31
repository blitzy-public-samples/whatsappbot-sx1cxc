// External imports with version specifications
import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'; // ^29.0.0
import { promises as fs } from 'fs/promises'; // node:18
import path from 'path'; // node:18
import mockFs from 'mock-fs'; // ^5.2.0

// Internal imports
import { ImportManager } from '../../../backend/contact-service/src/services/import_manager';
import { TestDataGenerator } from '../../utils/test-data-generator';
import { Contact } from '../../../backend/contact-service/src/models/contact';

// Test constants
const TEST_FILE_PATH = path.join(__dirname, '../fixtures/contacts.csv');
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000000';
const BATCH_SIZE = 1000;
const MAX_FILE_SIZE = 16777216; // 16MB

describe('ImportManager', () => {
    let importManager: ImportManager;
    let testDataGenerator: TestDataGenerator;
    let mockContactManager: any;
    let mockMetricsCollector: any;

    beforeAll(async () => {
        // Initialize test data generator
        testDataGenerator = new TestDataGenerator(TEST_ORG_ID);

        // Create test fixtures directory
        await fs.mkdir(path.dirname(TEST_FILE_PATH), { recursive: true });

        // Setup mock metrics collector
        mockMetricsCollector = {
            counter: jest.fn().mockReturnValue({ inc: jest.fn() }),
            histogram: jest.fn().mockReturnValue({ observe: jest.fn() }),
            gauge: jest.fn().mockReturnValue({ inc: jest.fn(), dec: jest.fn() })
        };

        // Setup mock contact manager
        mockContactManager = {
            create_contact: jest.fn(),
            get_contact: jest.fn(),
            update_contact: jest.fn()
        };
    });

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Initialize ImportManager with mocks
        importManager = new ImportManager(mockContactManager, mockMetricsCollector);

        // Setup mock filesystem
        mockFs({
            [path.dirname(TEST_FILE_PATH)]: {
                'contacts.csv': '',
                'contacts.xlsx': Buffer.from('dummy excel content'),
                'contacts.json': '{}'
            }
        });
    });

    afterAll(async () => {
        // Cleanup test files
        mockFs.restore();
        await fs.rm(path.dirname(TEST_FILE_PATH), { recursive: true, force: true });
    });

    describe('File Validation Tests', () => {
        test('should validate supported file types correctly', async () => {
            const supportedTypes = ['.csv', '.xlsx', '.xls', '.json'];
            
            for (const fileType of supportedTypes) {
                const result = await importManager.validate_file(
                    TEST_FILE_PATH.replace('.csv', fileType),
                    fileType
                );
                expect(result.valid).toBe(true);
            }
        });

        test('should reject unsupported file types', async () => {
            const result = await importManager.validate_file(
                'test.txt',
                '.txt'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Unsupported file type');
        });

        test('should validate file size limits', async () => {
            const largeFile = Buffer.alloc(MAX_FILE_SIZE + 1);
            await fs.writeFile(TEST_FILE_PATH, largeFile);

            const result = await importManager.validate_file(
                TEST_FILE_PATH,
                '.csv'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('exceeds maximum limit');
        });
    });

    describe('Import Performance Tests', () => {
        test('should handle concurrent imports within limits', async () => {
            const contacts = await testDataGenerator.generateBulk<Contact>('contact', 1000);
            const csvContent = await createTestFile('csv', contacts);

            const imports = Array(10).fill(null).map(() => 
                importManager.import_contacts(
                    TEST_FILE_PATH,
                    '.csv',
                    TEST_ORG_ID,
                    { phone: 'phone_number', firstName: 'first_name', lastName: 'last_name' }
                )
            );

            const results = await Promise.all(imports);
            expect(results.every(r => r.status === 'completed')).toBe(true);
        });

        test('should process large files in batches', async () => {
            const contacts = await testDataGenerator.generateBulk<Contact>('contact', 5000);
            await createTestFile('csv', contacts);

            const result = await importManager.import_contacts(
                TEST_FILE_PATH,
                '.csv',
                TEST_ORG_ID,
                { phone: 'phone_number', firstName: 'first_name', lastName: 'last_name' }
            );

            expect(result.processed).toBe(5000);
            expect(Math.ceil(result.processed / BATCH_SIZE)).toBe(
                Math.ceil(contacts.length / BATCH_SIZE)
            );
        });

        test('should maintain performance under load', async () => {
            const contacts = await testDataGenerator.generateBulk<Contact>('contact', 10000);
            await createTestFile('csv', contacts);

            const startTime = Date.now();
            const result = await importManager.import_contacts(
                TEST_FILE_PATH,
                '.csv',
                TEST_ORG_ID,
                { phone: 'phone_number', firstName: 'first_name', lastName: 'last_name' }
            );
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(30000); // Should process within 30 seconds
            expect(result.success).toBe(contacts.length);
        });
    });

    describe('Data Validation Tests', () => {
        test('should validate required fields', async () => {
            const contacts = [
                testDataGenerator.generateContact({ phone_number: '' }),
                testDataGenerator.generateContact({ first_name: '' }),
                testDataGenerator.generateContact() // Valid contact
            ];
            await createTestFile('csv', contacts);

            const result = await importManager.import_contacts(
                TEST_FILE_PATH,
                '.csv',
                TEST_ORG_ID,
                { phone: 'phone_number', firstName: 'first_name', lastName: 'last_name' }
            );

            expect(result.success).toBe(1);
            expect(result.failed).toBe(2);
            expect(result.errors.length).toBe(2);
        });

        test('should validate phone number format', async () => {
            const contacts = [
                testDataGenerator.generateContact({ phone_number: 'invalid' }),
                testDataGenerator.generateContact({ phone_number: '12345' }),
                testDataGenerator.generateContact() // Valid contact
            ];
            await createTestFile('csv', contacts);

            const result = await importManager.import_contacts(
                TEST_FILE_PATH,
                '.csv',
                TEST_ORG_ID,
                { phone: 'phone_number', firstName: 'first_name', lastName: 'last_name' }
            );

            expect(result.success).toBe(1);
            expect(result.failed).toBe(2);
            expect(result.errors.every(e => e.error.includes('phone number'))).toBe(true);
        });
    });

    describe('Error Handling Tests', () => {
        test('should handle file read errors gracefully', async () => {
            mockFs.restore(); // Simulate file system error
            
            await expect(importManager.import_contacts(
                'nonexistent.csv',
                '.csv',
                TEST_ORG_ID,
                { phone: 'phone_number', firstName: 'first_name', lastName: 'last_name' }
            )).rejects.toThrow();
        });

        test('should handle database errors during import', async () => {
            const contacts = [testDataGenerator.generateContact()];
            await createTestFile('csv', contacts);

            mockContactManager.create_contact.mockRejectedValueOnce(new Error('DB Error'));

            const result = await importManager.import_contacts(
                TEST_FILE_PATH,
                '.csv',
                TEST_ORG_ID,
                { phone: 'phone_number', firstName: 'first_name', lastName: 'last_name' }
            );

            expect(result.failed).toBe(1);
            expect(result.errors[0].error).toContain('DB Error');
        });
    });

    describe('Metrics Collection Tests', () => {
        test('should track import metrics correctly', async () => {
            const contacts = await testDataGenerator.generateBulk<Contact>('contact', 100);
            await createTestFile('csv', contacts);

            await importManager.import_contacts(
                TEST_FILE_PATH,
                '.csv',
                TEST_ORG_ID,
                { phone: 'phone_number', firstName: 'first_name', lastName: 'last_name' }
            );

            expect(mockMetricsCollector.counter).toHaveBeenCalledWith(
                'contact_import_operations_total',
                expect.any(String),
                ['status', 'file_type']
            );
            expect(mockMetricsCollector.histogram).toHaveBeenCalledWith(
                'contact_import_duration_seconds',
                expect.any(String),
                ['file_type']
            );
        });
    });
});

// Helper function to create test files
async function createTestFile(fileType: string, contacts: Contact[]): Promise<string> {
    let content: string = '';
    
    switch (fileType) {
        case 'csv':
            content = 'phone_number,first_name,last_name,email\n' +
                contacts.map(c => 
                    `${c.phone_number},${c.first_name},${c.last_name},${c.email}`
                ).join('\n');
            break;
        case 'json':
            content = JSON.stringify(contacts);
            break;
        default:
            throw new Error(`Unsupported test file type: ${fileType}`);
    }

    await fs.writeFile(TEST_FILE_PATH, content);
    return TEST_FILE_PATH;
}