// k6 v0.45.0
import { check, group, sleep } from 'k6';
// k6/http v0.45.0
import http from 'k6/http';
// k6/metrics v0.45.0
import { Trend, Rate, Counter } from 'k6/metrics';
// k6/ws v0.45.0
import ws from 'k6/ws';

import { scenarios, thresholds, environments } from '../configs/load-test.json';

// Base URL for contact API endpoints
const BASE_URL = 'http://localhost:3000/api/v1/contacts';

// Custom metrics for detailed performance tracking
const CONTACT_METRICS = new Trend('contact_operations', true);
const GROUP_METRICS = new Trend('group_operations', true);
const BULK_METRICS = new Trend('bulk_operations', true);
const SEARCH_METRICS = new Trend('search_operations', true);
const ERROR_RATE = new Rate('error_rate');

// Additional operation-specific metrics
const CONTACT_CREATE_DURATION = new Trend('contact_create_duration');
const CONTACT_UPDATE_DURATION = new Trend('contact_update_duration');
const GROUP_OPERATION_DURATION = new Trend('group_operation_duration');
const BULK_IMPORT_SIZE = new Counter('bulk_import_size');

// Test data generation utilities
function generateTestContact() {
  return {
    firstName: `Test${Date.now()}`,
    lastName: `User${Math.floor(Math.random() * 1000)}`,
    phoneNumber: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    email: `test${Date.now()}@example.com`,
    groups: [],
    tags: ['test', 'automated'],
    metadata: {
      source: 'k6_load_test',
      timestamp: new Date().toISOString()
    }
  };
}

function generateBulkContacts(count) {
  return Array(count).fill(null).map(() => generateTestContact());
}

// Setup function to initialize test data and configuration
export function setup() {
  const testData = {
    contacts: generateBulkContacts(100),
    groups: [
      { name: 'Test Group 1', description: 'Load test group 1' },
      { name: 'Test Group 2', description: 'Load test group 2' }
    ],
    searchQueries: [
      { term: 'Test', field: 'firstName' },
      { term: '+1', field: 'phoneNumber' },
      { term: 'test@', field: 'email' }
    ]
  };

  // Create initial test groups
  const groupResponses = testData.groups.map(group => 
    http.post(`${BASE_URL}/groups`, JSON.stringify(group), {
      headers: { 'Content-Type': 'application/json' }
    })
  );

  testData.groupIds = groupResponses
    .filter(response => response.status === 201)
    .map(response => response.json().id);

  return testData;
}

// Contact creation test function
export function createContact(contactData) {
  const startTime = new Date();
  
  const response = http.post(BASE_URL, JSON.stringify(contactData), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'create_contact' }
  });

  const duration = new Date() - startTime;
  CONTACT_CREATE_DURATION.add(duration);

  check(response, {
    'contact creation successful': (r) => r.status === 201,
    'response has contact id': (r) => r.json().id !== undefined,
    'response time within limits': (r) => r.timings.duration < 2000
  });

  if (response.status !== 201) {
    ERROR_RATE.add(1);
  }

  return response;
}

// Bulk contact import test function
export function bulkImportContacts(contactsList, options = {}) {
  const batchSize = options.batchSize || 50;
  const batches = [];
  
  for (let i = 0; i < contactsList.length; i += batchSize) {
    batches.push(contactsList.slice(i, i + batchSize));
  }

  const results = batches.map(batch => {
    const startTime = new Date();
    
    const response = http.post(`${BASE_URL}/bulk`, JSON.stringify(batch), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'bulk_import' }
    });

    const duration = new Date() - startTime;
    BULK_METRICS.add(duration);
    BULK_IMPORT_SIZE.add(batch.length);

    check(response, {
      'bulk import successful': (r) => r.status === 200,
      'all contacts processed': (r) => r.json().processed === batch.length,
      'no failed imports': (r) => r.json().failed === 0
    });

    return response;
  });

  return results;
}

// Contact search test function
export function searchContacts(searchParams) {
  const startTime = new Date();
  
  const queryString = Object.entries(searchParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const response = http.get(`${BASE_URL}/search?${queryString}`, {
    tags: { name: 'search_contacts' }
  });

  const duration = new Date() - startTime;
  SEARCH_METRICS.add(duration);

  check(response, {
    'search successful': (r) => r.status === 200,
    'results are paginated': (r) => r.json().hasOwnProperty('pagination'),
    'response time acceptable': (r) => r.timings.duration < 1000
  });

  return response;
}

// Group management test function
export function manageGroup(groupId, contactIds, operation) {
  const startTime = new Date();
  
  const payload = {
    groupId,
    contactIds,
    operation
  };

  const response = http.post(`${BASE_URL}/groups/${groupId}/${operation}`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'group_operation' }
  });

  const duration = new Date() - startTime;
  GROUP_OPERATION_DURATION.add(duration);

  check(response, {
    'group operation successful': (r) => r.status === 200,
    'all contacts processed': (r) => r.json().processed === contactIds.length,
    'operation completed': (r) => r.json().status === 'completed'
  });

  return response;
}

// Default function for test execution
export default function(testData) {
  group('Contact CRUD Operations', () => {
    // Create new contact
    const contact = generateTestContact();
    const createResponse = createContact(contact);
    
    if (createResponse.status === 201) {
      const contactId = createResponse.json().id;
      
      // Update contact
      const updateStart = new Date();
      const updateResponse = http.put(
        `${BASE_URL}/${contactId}`,
        JSON.stringify({ ...contact, firstName: 'Updated' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      CONTACT_UPDATE_DURATION.add(new Date() - updateStart);
      
      // Delete contact
      http.del(`${BASE_URL}/${contactId}`);
    }
  });

  group('Bulk Operations', () => {
    const bulkContacts = generateBulkContacts(100);
    bulkImportContacts(bulkContacts);
  });

  group('Search Operations', () => {
    testData.searchQueries.forEach(query => {
      searchContacts(query);
    });
  });

  group('Group Management', () => {
    if (testData.groupIds && testData.groupIds.length > 0) {
      const contacts = generateBulkContacts(10);
      const createResponses = contacts.map(contact => createContact(contact));
      const contactIds = createResponses
        .filter(r => r.status === 201)
        .map(r => r.json().id);

      manageGroup(testData.groupIds[0], contactIds, 'add');
      sleep(1);
      manageGroup(testData.groupIds[0], contactIds, 'remove');
    }
  });
}

// Test results handling
export function handleSummary(data) {
  return {
    'stdout': JSON.stringify({
      metrics: {
        contacts: CONTACT_METRICS.values,
        groups: GROUP_METRICS.values,
        bulk: BULK_METRICS.values,
        search: SEARCH_METRICS.values,
        errors: ERROR_RATE.values
      },
      scenarios: data.scenarios,
      thresholds: data.thresholds
    }, null, 2)
  };
}