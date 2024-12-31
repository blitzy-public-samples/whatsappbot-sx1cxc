// @ts-check
import { check } from 'k6/check';
import http from 'k6/http';
import { sleep } from 'k6/execution';
import { loadTestConfig } from '../configs/load-test.json';

// Version comments for external imports
// k6: v0.45.0
// k6/http: v0.45.0
// k6/check: v0.45.0
// k6/execution: v0.45.0

// Global constants
const BASE_URL = 'http://localhost:3000/api/v1/templates';
const TEST_TEMPLATE = {
  name: 'Test Template',
  content: 'Hello {name}, your appointment is scheduled for {date}',
  variables: [
    { name: 'name', type: 'TEXT', required: true },
    { name: 'date', type: 'DATE', required: true }
  ]
};

// Export k6 options
export const options = {
  scenarios: loadTestConfig.scenarios.templateApiScenario,
  thresholds: {
    ...loadTestConfig.thresholds,
    'template_create_duration': ['p(95)<3000', 'rate<50'],
    'template_update_duration': ['p(95)<3000', 'rate<50'],
    'template_get_duration': ['p(95)<1000', 'rate>100'],
    'template_errors': ['count<50'],
    'template_validation_time': ['p(95)<1500']
  }
};

/**
 * Setup function to initialize test data and authentication
 * @returns {Object} Test context data
 */
export function setup() {
  const authToken = getAuthToken();
  const templates = [];

  try {
    // Create initial test templates
    for (let i = 0; i < 5; i++) {
      const template = {
        ...TEST_TEMPLATE,
        name: `${TEST_TEMPLATE.name}_${i}`
      };
      const response = http.post(BASE_URL, JSON.stringify(template), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.status === 201) {
        templates.push(JSON.parse(response.body).id);
      }
    }

    return {
      authToken,
      templateIds: templates,
      config: loadTestConfig.options
    };
  } catch (error) {
    console.error('Setup failed:', error);
    throw error;
  }
}

/**
 * Test template creation endpoint
 * @param {Object} testData Test context data
 */
export function createTemplate(testData) {
  const template = {
    ...TEST_TEMPLATE,
    name: `${TEST_TEMPLATE.name}_${Date.now()}`
  };

  const response = http.post(BASE_URL, JSON.stringify(template), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.authToken}`
    },
    tags: { name: 'create_template' }
  });

  check(response, {
    'template creation successful': (r) => r.status === 201,
    'response has template id': (r) => JSON.parse(r.body).id !== undefined,
    'response time within limits': (r) => r.timings.duration < 3000
  });

  sleep(1); // Rate limiting compliance
}

/**
 * Test template update endpoint
 * @param {Object} testData Test context data
 */
export function updateTemplate(testData) {
  if (!testData.templateIds.length) return;

  const templateId = testData.templateIds[0];
  const updatedTemplate = {
    ...TEST_TEMPLATE,
    name: `Updated Template ${Date.now()}`
  };

  const response = http.put(`${BASE_URL}/${templateId}`, JSON.stringify(updatedTemplate), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.authToken}`
    },
    tags: { name: 'update_template' }
  });

  check(response, {
    'template update successful': (r) => r.status === 200,
    'response has updated data': (r) => JSON.parse(r.body).name === updatedTemplate.name,
    'response time within limits': (r) => r.timings.duration < 3000
  });

  sleep(1);
}

/**
 * Test template retrieval endpoint
 * @param {Object} testData Test context data
 */
export function getTemplate(testData) {
  if (!testData.templateIds.length) return;

  const templateId = testData.templateIds[0];
  const response = http.get(`${BASE_URL}/${templateId}`, {
    headers: {
      'Authorization': `Bearer ${testData.authToken}`,
      'Cache-Control': 'no-cache'
    },
    tags: { name: 'get_template' }
  });

  check(response, {
    'template retrieval successful': (r) => r.status === 200,
    'response has template data': (r) => JSON.parse(r.body).id === templateId,
    'response time within limits': (r) => r.timings.duration < 1000
  });
}

/**
 * Test template listing endpoint
 * @param {Object} testData Test context data
 */
export function listTemplates(testData) {
  const params = {
    page: 1,
    limit: 10,
    sort: 'created_at:desc'
  };

  const response = http.get(`${BASE_URL}?${new URLSearchParams(params)}`, {
    headers: {
      'Authorization': `Bearer ${testData.authToken}`
    },
    tags: { name: 'list_templates' }
  });

  check(response, {
    'template listing successful': (r) => r.status === 200,
    'response has templates array': (r) => Array.isArray(JSON.parse(r.body).templates),
    'response has pagination': (r) => JSON.parse(r.body).pagination !== undefined,
    'response time within limits': (r) => r.timings.duration < 2000
  });
}

/**
 * Main test function
 */
export default function(testData) {
  const scenarios = {
    'create': 0.2,
    'update': 0.2,
    'get': 0.4,
    'list': 0.2
  };

  const random = Math.random();
  let sum = 0;

  for (const [scenario, probability] of Object.entries(scenarios)) {
    sum += probability;
    if (random <= sum) {
      switch (scenario) {
        case 'create':
          createTemplate(testData);
          break;
        case 'update':
          updateTemplate(testData);
          break;
        case 'get':
          getTemplate(testData);
          break;
        case 'list':
          listTemplates(testData);
          break;
      }
      break;
    }
  }

  sleep(1);
}

/**
 * Helper function to get authentication token
 * @returns {string} Authentication token
 */
function getAuthToken() {
  // Implementation would integrate with your auth service
  return 'test-auth-token';
}