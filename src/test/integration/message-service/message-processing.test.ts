// External imports with versions
import { describe, test, beforeEach, afterEach, expect } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.3

// Internal imports
import { TestDatabase } from '../utils/test-database';
import { TestQueue } from '../utils/test-queue';
import { Message, MessageStatus, Template } from '../../../backend/message-service/pkg/whatsapp/types';

// Constants for test configuration
const TEST_TIMEOUT = 30000;
const BATCH_SIZE = 100;
const PERFORMANCE_THRESHOLD_MS = 2000;
const MAX_QUEUE_LENGTH = 10000;

/**
 * Comprehensive integration test suite for message processing functionality
 * Tests end-to-end message handling with performance monitoring
 */
describe('Message Processing Integration Tests', () => {
    let testDb: TestDatabase;
    let testQueue: TestQueue;
    let request: supertest.SuperTest<supertest.Test>;
    let performanceMetrics: Map<string, number>;

    // Test environment setup with enhanced monitoring
    beforeEach(async () => {
        // Initialize test database with transaction support
        testDb = new TestDatabase({
            host: process.env.TEST_DB_HOST || 'localhost',
            port: parseInt(process.env.TEST_DB_PORT || '5432'),
            user: process.env.TEST_DB_USER || 'test',
            password: process.env.TEST_DB_PASSWORD || 'test',
            database: process.env.TEST_DB_NAME || 'test',
            poolSize: 5,
            ssl: false
        });

        // Initialize test queue with monitoring
        testQueue = new TestQueue({
            host: process.env.TEST_REDIS_HOST || 'localhost',
            port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
            password: process.env.TEST_REDIS_PASSWORD || '',
            db: 0,
            maxRetries: 3,
            retryDelay: 1000,
            connectionTimeout: 5000,
            monitoringEnabled: true
        });

        // Set up connections and clean state
        await testDb.connect();
        await testDb.setupSchema();
        await testQueue.connect();
        
        // Initialize performance metrics tracking
        performanceMetrics = new Map();
        
        // Set up API test client
        request = supertest(process.env.API_URL || 'http://localhost:3000');
    });

    // Cleanup test environment
    afterEach(async () => {
        await testDb.cleanup({ truncate: true, cascade: true });
        await testQueue.cleanup();
        await testDb.disconnect();
        await testQueue.disconnect();
    });

    /**
     * Test single message processing with comprehensive validation
     */
    test('should process single message successfully', async () => {
        // Arrange
        const testMessage: Message = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            to: '+1234567890',
            type: 'TEXT',
            content: {
                text: 'Test message content',
                richText: true,
                formatting: {
                    bold: [{ start: 0, length: 4 }],
                    italic: [],
                    links: []
                }
            },
            status: MessageStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            retryCount: 0,
            metadata: {
                source: 'integration_test',
                priority: 'normal'
            }
        };

        // Start transaction for test isolation
        await testDb.beginTransaction();

        try {
            // Act
            const startTime = Date.now();
            const response = await request
                .post('/api/v1/messages')
                .send(testMessage)
                .expect(201);

            // Record performance metric
            const processingTime = Date.now() - startTime;
            performanceMetrics.set('single_message_processing', processingTime);

            // Assert
            expect(response.body.id).toBeDefined();
            expect(response.body.status).toBe(MessageStatus.SENT);

            // Verify database state
            const storedMessage = await testDb.executeQuery(
                'SELECT * FROM messages WHERE id = $1',
                [testMessage.id]
            );
            expect(storedMessage.rows[0]).toBeDefined();
            expect(storedMessage.rows[0].status).toBe(MessageStatus.SENT);

            // Verify queue state
            const queueMetrics = await testQueue.monitorQueue('messages:normal');
            expect(queueMetrics.queueLength).toBeLessThanOrEqual(MAX_QUEUE_LENGTH);
            expect(queueMetrics.processingRate).toBeGreaterThan(0);
            expect(queueMetrics.errorRate).toBe(0);
            expect(queueMetrics.averageLatency).toBeLessThan(PERFORMANCE_THRESHOLD_MS);

            // Commit transaction
            await testDb.commitTransaction();
        } catch (error) {
            await testDb.rollbackTransaction();
            throw error;
        }
    }, TEST_TIMEOUT);

    /**
     * Test batch message processing with performance monitoring
     */
    test('should process message batch successfully', async () => {
        // Arrange
        const batchMessages = await testQueue.generateTestMessages(BATCH_SIZE);
        const batchIds = batchMessages.map(msg => msg.id);

        // Start transaction for test isolation
        await testDb.beginTransaction();

        try {
            // Act
            const startTime = Date.now();
            const response = await request
                .post('/api/v1/messages/batch')
                .send({ messages: batchMessages })
                .expect(202);

            // Record performance metric
            const processingTime = Date.now() - startTime;
            performanceMetrics.set('batch_message_processing', processingTime);

            // Assert
            expect(response.body.accepted).toBe(BATCH_SIZE);
            expect(response.body.batchId).toBeDefined();

            // Monitor batch processing
            let processedCount = 0;
            const maxRetries = 10;
            let retryCount = 0;

            while (processedCount < BATCH_SIZE && retryCount < maxRetries) {
                const queueMetrics = await testQueue.monitorQueue('messages:batch');
                processedCount = BATCH_SIZE - queueMetrics.queueLength;
                
                if (processedCount < BATCH_SIZE) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    retryCount++;
                }
            }

            // Verify final state
            const finalMetrics = await testQueue.monitorQueue('messages:batch');
            expect(finalMetrics.queueLength).toBe(0);
            expect(finalMetrics.errorRate).toBe(0);
            expect(finalMetrics.averageLatency).toBeLessThan(PERFORMANCE_THRESHOLD_MS);

            // Verify database state
            const storedMessages = await testDb.executeQuery(
                'SELECT * FROM messages WHERE id = ANY($1)',
                [batchIds]
            );
            expect(storedMessages.rows.length).toBe(BATCH_SIZE);
            expect(storedMessages.rows.every(msg => msg.status === MessageStatus.SENT)).toBe(true);

            // Commit transaction
            await testDb.commitTransaction();
        } catch (error) {
            await testDb.rollbackTransaction();
            throw error;
        }
    }, TEST_TIMEOUT);

    /**
     * Test template message processing with variable substitution
     */
    test('should process template message successfully', async () => {
        // Arrange
        const template: Template = {
            name: 'test_template',
            language: 'en',
            category: 'marketing',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', value: 'Test User' }
                    ],
                    required: true,
                    index: 0
                }
            ],
            status: 'approved',
            version: '1.0',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const templateMessage: Message = {
            id: '123e4567-e89b-12d3-a456-426614174001',
            to: '+1234567890',
            type: 'TEMPLATE',
            content: {
                text: '',
                richText: false
            },
            template,
            status: MessageStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            retryCount: 0,
            metadata: {
                source: 'integration_test',
                priority: 'high'
            }
        };

        // Start transaction for test isolation
        await testDb.beginTransaction();

        try {
            // Act
            const response = await request
                .post('/api/v1/messages/template')
                .send(templateMessage)
                .expect(201);

            // Assert
            expect(response.body.id).toBeDefined();
            expect(response.body.status).toBe(MessageStatus.SENT);

            // Verify template processing
            const storedMessage = await testDb.executeQuery(
                'SELECT * FROM messages WHERE id = $1',
                [templateMessage.id]
            );
            expect(storedMessage.rows[0].template_name).toBe(template.name);
            expect(storedMessage.rows[0].status).toBe(MessageStatus.SENT);

            // Commit transaction
            await testDb.commitTransaction();
        } catch (error) {
            await testDb.rollbackTransaction();
            throw error;
        }
    }, TEST_TIMEOUT);
});