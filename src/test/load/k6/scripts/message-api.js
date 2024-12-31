// k6 v0.45.0
import http from 'k6/http';
import { check, sleep } from 'k6';
import { scenarios, thresholds } from '../configs/load-test.json';

// Base URL for API endpoints
const BASE_URL = 'http://localhost:3000/api/v1';

// Message API endpoints
const MESSAGE_ENDPOINTS = {
    CREATE: '/messages',
    GET_ALL: '/messages',
    GET_BY_ID: '/messages/{id}',
    UPDATE_STATUS: '/messages/{id}/status',
    BULK_SEND: '/messages/bulk',
    TEMPLATE_VALIDATE: '/messages/template/validate',
    MEDIA_UPLOAD: '/messages/media'
};

// Test data for message operations
const TEST_DATA = {
    singleMessage: {
        content: 'Test message content',
        recipients: ['1234567890'],
        templateId: 'template-123',
        scheduledAt: null,
        mediaUrls: [],
        metadata: {
            campaignId: 'test-campaign',
            priority: 'normal'
        }
    },
    bulkMessage: {
        messages: [
            {
                content: 'Bulk message 1',
                recipients: ['1234567890', '0987654321'],
                templateId: 'template-bulk-1',
                metadata: { batchId: 'batch-1' }
            },
            {
                content: 'Bulk message 2',
                recipients: ['1111111111', '2222222222'],
                templateId: 'template-bulk-2',
                metadata: { batchId: 'batch-1' }
            }
        ],
        options: {
            rateLimitPerMinute: 100,
            failFast: true
        }
    }
};

// Initialize test environment and data
export function setup() {
    // Generate test authentication token
    const authResponse = http.post(`${BASE_URL}/auth/token`, {
        grant_type: 'client_credentials',
        scope: 'message.write message.read'
    });

    check(authResponse, {
        'Auth token generated successfully': (r) => r.status === 200,
        'Token received': (r) => r.json('access_token') !== undefined
    });

    // Validate test templates
    const templateValidation = http.post(
        `${BASE_URL}${MESSAGE_ENDPOINTS.TEMPLATE_VALIDATE}`,
        JSON.stringify([TEST_DATA.singleMessage.templateId, ...TEST_DATA.bulkMessage.messages.map(m => m.templateId)]),
        { headers: { 'Content-Type': 'application/json' } }
    );

    check(templateValidation, {
        'Templates validated successfully': (r) => r.status === 200,
        'All templates are valid': (r) => r.json('validCount') === 3
    });

    return {
        authToken: authResponse.json('access_token'),
        testData: TEST_DATA,
        baseUrl: BASE_URL
    };
}

// Handle single message operations
export function handleSingleMessage(testContext) {
    const params = {
        headers: {
            'Authorization': `Bearer ${testContext.authToken}`,
            'Content-Type': 'application/json'
        }
    };

    // Create single message
    const createResponse = http.post(
        `${testContext.baseUrl}${MESSAGE_ENDPOINTS.CREATE}`,
        JSON.stringify(testContext.testData.singleMessage),
        params
    );

    check(createResponse, {
        'Message created successfully': (r) => r.status === 201,
        'Message ID received': (r) => r.json('id') !== undefined,
        'Rate limit headers present': (r) => r.headers['X-RateLimit-Remaining'] !== undefined
    });

    const messageId = createResponse.json('id');

    // Get message details
    const getResponse = http.get(
        `${testContext.baseUrl}${MESSAGE_ENDPOINTS.GET_BY_ID.replace('{id}', messageId)}`,
        params
    );

    check(getResponse, {
        'Message retrieved successfully': (r) => r.status === 200,
        'Message content matches': (r) => r.json('content') === testContext.testData.singleMessage.content
    });

    // Update message status
    const updateResponse = http.put(
        `${testContext.baseUrl}${MESSAGE_ENDPOINTS.UPDATE_STATUS.replace('{id}', messageId)}`,
        JSON.stringify({ status: 'delivered' }),
        params
    );

    check(updateResponse, {
        'Status updated successfully': (r) => r.status === 200,
        'New status reflected': (r) => r.json('status') === 'delivered'
    });

    sleep(1); // Respect rate limiting
}

// Handle bulk message operations
export function handleBulkMessages(testContext) {
    const params = {
        headers: {
            'Authorization': `Bearer ${testContext.authToken}`,
            'Content-Type': 'application/json'
        }
    };

    // Send bulk messages
    const bulkResponse = http.post(
        `${testContext.baseUrl}${MESSAGE_ENDPOINTS.BULK_SEND}`,
        JSON.stringify(testContext.testData.bulkMessage),
        params
    );

    check(bulkResponse, {
        'Bulk send successful': (r) => r.status === 202,
        'Batch ID received': (r) => r.json('batchId') !== undefined,
        'Success count matches': (r) => r.json('successCount') === testContext.testData.bulkMessage.messages.length
    });

    const batchId = bulkResponse.json('batchId');

    // Check batch status
    const batchStatus = http.get(
        `${testContext.baseUrl}${MESSAGE_ENDPOINTS.GET_ALL}?batchId=${batchId}`,
        params
    );

    check(batchStatus, {
        'Batch status retrieved': (r) => r.status === 200,
        'All messages processed': (r) => r.json('messages').length === testContext.testData.bulkMessage.messages.length
    });

    sleep(2); // Longer sleep for bulk operations
}

// Default test execution
export default function() {
    const testContext = setup();
    
    // Execute test scenarios based on VU and iteration
    if (__VU % 2 === 0) {
        handleSingleMessage(testContext);
    } else {
        handleBulkMessages(testContext);
    }

    // Track custom metrics
    const customMetrics = {
        message_send_requests: new Counter('message_send_requests'),
        message_schedule_requests: new Counter('message_schedule_requests'),
        message_status_checks: new Counter('message_status_checks'),
        message_creation_success: new Rate('message_creation_success'),
        bulk_operation_success: new Rate('bulk_operation_success'),
        template_validation_success: new Rate('template_validation_success'),
        rate_limit_adherence: new Rate('rate_limit_adherence')
    };

    // Update metrics based on test execution
    customMetrics.message_send_requests.add(1);
    customMetrics.message_creation_success.add(1);
    
    // Apply test configuration
    export const options = {
        scenarios: scenarios.messageApiScenario,
        thresholds: {
            http_req_duration: ['p(95)<2000'],
            http_req_failed: ['rate<0.01'],
            message_send_requests: ['count>1000'],
            message_schedule_requests: ['count>500'],
            message_status_checks: ['count>2000'],
            message_creation_success: ['rate>0.99'],
            bulk_operation_success: ['rate>0.95'],
            template_validation_success: ['rate>0.99'],
            rate_limit_adherence: ['rate>0.99']
        }
    };
}