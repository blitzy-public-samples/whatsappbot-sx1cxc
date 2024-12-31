// External imports with versions
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.3
import { faker } from '@faker-js/faker'; // ^8.0.0

// Internal imports
import { TestDatabase } from '../utils/test-database';
import { TestQueue } from '../utils/test-queue';

// Constants
const API_BASE_URL = '/api/v1';
const TEST_TIMEOUT = 30000;
const ENDPOINTS = {
  ANALYTICS: '/analytics',
  CONTACTS: '/contacts',
  MESSAGES: '/messages',
  TEMPLATES: '/templates',
  HEALTH: '/health'
};

// Test configuration
const testDb = new TestDatabase({
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  user: process.env.TEST_DB_USER || 'test',
  password: process.env.TEST_DB_PASSWORD || 'test',
  database: process.env.TEST_DB_NAME || 'test_db',
  poolSize: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: false,
  retryAttempts: 3,
  retryDelay: 1000
});

const testQueue = new TestQueue({
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
  password: process.env.TEST_REDIS_PASSWORD || '',
  db: 0,
  maxRetries: 3,
  retryDelay: 1000,
  connectionTimeout: 5000,
  monitoringEnabled: true
});

let request: supertest.SuperTest<supertest.Test>;
let authToken: string;

// Global setup and teardown
beforeAll(async () => {
  await testDb.connect();
  await testDb.setupSchema();
  await testQueue.connect();
  
  // Initialize test server and create supertest instance
  const app = await import('../../../backend/api-gateway/app');
  request = supertest(app.default);
  
  // Generate test auth token
  authToken = await generateTestAuthToken();
}, TEST_TIMEOUT);

afterAll(async () => {
  await testDb.cleanup({ truncate: true, cascade: true });
  await testQueue.cleanup();
  await testDb.disconnect();
  await testQueue.disconnect();
}, TEST_TIMEOUT);

beforeEach(async () => {
  await testDb.cleanup({ truncate: true });
  await testDb.seedData({
    contacts: 10,
    messages: 5,
    templates: 3
  });
});

afterEach(async () => {
  await testQueue.cleanup();
});

// Test Suites
describe('Health Check Endpoints', () => {
  test('GET /health returns 200 OK with correct service status', async () => {
    const response = await request.get(`${API_BASE_URL}${ENDPOINTS.HEALTH}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      status: 'healthy',
      version: expect.any(String),
      timestamp: expect.any(String),
      components: expect.objectContaining({
        database: expect.any(Object),
        queue: expect.any(Object),
        cache: expect.any(Object)
      })
    }));
  });

  test('GET /health includes detailed component health checks', async () => {
    const response = await request.get(`${API_BASE_URL}${ENDPOINTS.HEALTH}`);
    
    expect(response.body.components).toEqual(expect.objectContaining({
      database: expect.objectContaining({
        status: 'healthy',
        latency: expect.any(Number)
      }),
      queue: expect.objectContaining({
        status: 'healthy',
        messageCount: expect.any(Number)
      }),
      cache: expect.objectContaining({
        status: 'healthy',
        hitRate: expect.any(Number)
      })
    }));
  });

  test('GET /health responds within SLA timeframe', async () => {
    const start = Date.now();
    await request.get(`${API_BASE_URL}${ENDPOINTS.HEALTH}`);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(2000); // 2 seconds SLA
  });
});

describe('Authentication and Authorization', () => {
  test('Protected routes return 401 without auth token', async () => {
    const endpoints = [ENDPOINTS.MESSAGES, ENDPOINTS.CONTACTS, ENDPOINTS.TEMPLATES, ENDPOINTS.ANALYTICS];
    
    for (const endpoint of endpoints) {
      const response = await request.get(`${API_BASE_URL}${endpoint}`);
      expect(response.status).toBe(401);
      expect(response.body).toEqual(expect.objectContaining({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }));
    }
  });

  test('Protected routes return 403 with invalid token', async () => {
    const invalidToken = 'invalid.token.here';
    const endpoints = [ENDPOINTS.MESSAGES, ENDPOINTS.CONTACTS, ENDPOINTS.TEMPLATES, ENDPOINTS.ANALYTICS];
    
    for (const endpoint of endpoints) {
      const response = await request
        .get(`${API_BASE_URL}${endpoint}`)
        .set('Authorization', `Bearer ${invalidToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body).toEqual(expect.objectContaining({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      }));
    }
  });

  test('Protected routes accept valid auth token', async () => {
    const response = await request
      .get(`${API_BASE_URL}${ENDPOINTS.CONTACTS}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
  });

  test('Handles token expiration correctly', async () => {
    const expiredToken = await generateExpiredTestToken();
    const response = await request
      .get(`${API_BASE_URL}${ENDPOINTS.CONTACTS}`)
      .set('Authorization', `Bearer ${expiredToken}`);
    
    expect(response.status).toBe(401);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    }));
  });
});

describe('Message Endpoints', () => {
  test('POST /messages creates new message with valid data', async () => {
    const messageData = {
      to: faker.phone.number('+1##########'),
      content: {
        text: faker.lorem.paragraph(),
        richText: true
      }
    };

    const response = await request
      .post(`${API_BASE_URL}${ENDPOINTS.MESSAGES}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(messageData);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      status: 'pending',
      createdAt: expect.any(String)
    }));
  });

  test('POST /messages handles media upload correctly', async () => {
    const messageData = new FormData();
    messageData.append('to', faker.phone.number('+1##########'));
    messageData.append('media', Buffer.from('test-image'), {
      filename: 'test.jpg',
      contentType: 'image/jpeg'
    });

    const response = await request
      .post(`${API_BASE_URL}${ENDPOINTS.MESSAGES}`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('media', Buffer.from('test-image'), 'test.jpg')
      .field('to', faker.phone.number('+1##########'));

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      content: expect.objectContaining({
        mediaUrl: expect.any(String),
        mediaType: 'image/jpeg'
      })
    }));
  });

  test('GET /messages returns paginated message list', async () => {
    const response = await request
      .get(`${API_BASE_URL}${ENDPOINTS.MESSAGES}`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      items: expect.any(Array),
      total: expect.any(Number),
      page: 1,
      limit: 10,
      hasMore: expect.any(Boolean)
    }));
  });
});

describe('Contact Endpoints', () => {
  test('POST /contacts creates new contact with valid data', async () => {
    const contactData = {
      phoneNumber: faker.phone.number('+1##########'),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email()
    };

    const response = await request
      .post(`${API_BASE_URL}${ENDPOINTS.CONTACTS}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(contactData);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      phoneNumber: contactData.phoneNumber,
      firstName: contactData.firstName,
      lastName: contactData.lastName
    }));
  });

  test('GET /contacts supports filtering and sorting', async () => {
    const response = await request
      .get(`${API_BASE_URL}${ENDPOINTS.CONTACTS}`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        search: 'john',
        sortBy: 'lastName',
        sortOrder: 'asc',
        page: 1,
        limit: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          firstName: expect.any(String),
          lastName: expect.any(String)
        })
      ])
    );
  });
});

describe('Template Endpoints', () => {
  test('POST /templates creates new template with valid data', async () => {
    const templateData = {
      name: faker.lorem.words(2),
      content: 'Hello {{firstName}}, welcome to {{company}}!',
      variables: [
        { name: 'firstName', type: 'text', required: true },
        { name: 'company', type: 'text', required: true }
      ]
    };

    const response = await request
      .post(`${API_BASE_URL}${ENDPOINTS.TEMPLATES}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(templateData);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: templateData.name,
      content: templateData.content,
      variables: templateData.variables
    }));
  });

  test('PUT /templates/:id updates existing template', async () => {
    const templateId = await createTestTemplate();
    const updateData = {
      name: faker.lorem.words(2),
      content: 'Updated content with {{variable}}'
    };

    const response = await request
      .put(`${API_BASE_URL}${ENDPOINTS.TEMPLATES}/${templateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      id: templateId,
      name: updateData.name,
      content: updateData.content
    }));
  });
});

describe('Analytics Endpoints', () => {
  test('GET /analytics/messages returns message statistics', async () => {
    const response = await request
      .get(`${API_BASE_URL}${ENDPOINTS.ANALYTICS}/messages`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      total: expect.any(Number),
      delivered: expect.any(Number),
      failed: expect.any(Number),
      deliveryRate: expect.any(Number),
      averageDeliveryTime: expect.any(Number)
    }));
  });

  test('GET /analytics/templates returns template performance metrics', async () => {
    const response = await request
      .get(`${API_BASE_URL}${ENDPOINTS.ANALYTICS}/templates`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        period: '30d'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        templateId: expect.any(String),
        name: expect.any(String),
        usage: expect.any(Number),
        successRate: expect.any(Number)
      })
    ]));
  });
});

// Helper Functions
async function generateTestAuthToken(): Promise<string> {
  // Implementation would generate a valid JWT token for testing
  return 'test.auth.token';
}

async function generateExpiredTestToken(): Promise<string> {
  // Implementation would generate an expired JWT token for testing
  return 'expired.auth.token';
}

async function createTestTemplate(): Promise<string> {
  const response = await request
    .post(`${API_BASE_URL}${ENDPOINTS.TEMPLATES}`)
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      name: faker.lorem.words(2),
      content: 'Test template {{variable}}',
      variables: [{ name: 'variable', type: 'text', required: true }]
    });
  
  return response.body.id;
}