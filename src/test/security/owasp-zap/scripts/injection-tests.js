// @zaproxy/core v2.12.0
const { Parameters, HttpSender, Model } = require('@zaproxy/core');
// @zaproxy/sqlinjection v2.12.0
const { SQLInjectionPlugin } = require('@zaproxy/sqlinjection');
// @zaproxy/nosqlinjection v2.12.0
const { NoSQLInjectionPlugin } = require('@zaproxy/nosqlinjection');

// Import test configurations
const { attack_vectors: baselineVectors } = require('../../configs/baseline-scan.yaml');
const { attack_vectors: fullVectors } = require('../../configs/full-scan.yaml');

// Global constants
const TARGET_URL = environment.TARGET_URL;
const API_ENDPOINTS = {
    CONTACTS: '/api/v1/contacts',
    MESSAGES: '/api/v1/messages',
    TEMPLATES: '/api/v1/templates',
    ANALYTICS: '/api/v1/analytics'
};

/**
 * Executes comprehensive SQL injection tests with enhanced detection capabilities
 * @async
 * @param {object} context - Test context containing target and configuration
 * @returns {Promise<object>} Detailed vulnerability report
 */
async function sqlInjectionTests(context) {
    const sqlPlugin = new SQLInjectionPlugin();
    const results = {
        vulnerabilities: [],
        metadata: {
            startTime: new Date(),
            targetUrl: context.target || TARGET_URL,
            scanDuration: 0
        }
    };

    try {
        // Initialize test parameters
        const testVectors = [
            // Error-based injection vectors
            "' OR '1'='1",
            "' UNION SELECT NULL--",
            "') OR ('1'='1",
            // Blind injection vectors
            "' AND SLEEP(5)--",
            "' AND 1=(SELECT COUNT(*) FROM tablename); --",
            // Time-based vectors
            "'; WAITFOR DELAY '0:0:5'--",
            "'; SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END--"
        ];

        // Test each endpoint with injection vectors
        for (const endpoint of Object.values(API_ENDPOINTS)) {
            const targetUrl = `${context.target || TARGET_URL}${endpoint}`;

            for (const vector of testVectors) {
                const testResult = await sqlPlugin.testInjection({
                    url: targetUrl,
                    parameter: 'q',
                    value: vector,
                    method: 'POST',
                    headers: context.headers || {}
                });

                if (testResult.vulnerable) {
                    results.vulnerabilities.push({
                        endpoint,
                        vector,
                        severity: testResult.severity,
                        evidence: testResult.evidence,
                        cvss: testResult.cvss,
                        remediation: testResult.remediation
                    });
                }
            }
        }
    } catch (error) {
        console.error('SQL Injection test error:', error);
        results.error = error.message;
    }

    results.metadata.scanDuration = new Date() - results.metadata.startTime;
    return results;
}

/**
 * Executes MongoDB-specific NoSQL injection tests
 * @async
 * @param {object} context - Test context containing target and configuration
 * @returns {Promise<object>} Detailed vulnerability report
 */
async function nosqlInjectionTests(context) {
    const nosqlPlugin = new NoSQLInjectionPlugin();
    const results = {
        vulnerabilities: [],
        metadata: {
            startTime: new Date(),
            targetUrl: context.target || TARGET_URL,
            scanDuration: 0
        }
    };

    try {
        // Initialize NoSQL test vectors
        const testVectors = [
            // MongoDB operator injection
            '{"$gt": ""}',
            '{"$where": "sleep(5000)"}',
            '{"$regex": "^admin"}',
            // JavaScript injection
            '; return true; var a=',
            '; while(true){}; var a=',
            // Array manipulation
            '[$ne]=1',
            '[$exists]=true',
            // Type coercion
            '{"$gt": {"$toString": "admin"}}'
        ];

        // Test each endpoint
        for (const endpoint of Object.values(API_ENDPOINTS)) {
            const targetUrl = `${context.target || TARGET_URL}${endpoint}`;

            for (const vector of testVectors) {
                const testResult = await nosqlPlugin.testInjection({
                    url: targetUrl,
                    parameter: 'query',
                    value: vector,
                    method: 'POST',
                    headers: context.headers || {}
                });

                if (testResult.vulnerable) {
                    results.vulnerabilities.push({
                        endpoint,
                        vector,
                        severity: testResult.severity,
                        evidence: testResult.evidence,
                        impact: testResult.impact,
                        remediation: testResult.remediation
                    });
                }
            }
        }
    } catch (error) {
        console.error('NoSQL Injection test error:', error);
        results.error = error.message;
    }

    results.metadata.scanDuration = new Date() - results.metadata.startTime;
    return results;
}

/**
 * Tests for command injection vulnerabilities
 * @async
 * @param {object} context - Test context containing target and configuration
 * @returns {Promise<object>} Detailed vulnerability report
 */
async function commandInjectionTests(context) {
    const results = {
        vulnerabilities: [],
        metadata: {
            startTime: new Date(),
            targetUrl: context.target || TARGET_URL,
            scanDuration: 0
        }
    };

    try {
        // Initialize command injection test vectors
        const testVectors = [
            // Shell command injection
            '| ping -c 1 127.0.0.1',
            '; ping -c 1 127.0.0.1',
            '`ping -c 1 127.0.0.1`',
            // Command chaining
            '& whoami',
            '&& whoami',
            '|| whoami',
            // Special character handling
            '$(sleep 5)',
            '%0Awhoami',
            '${IFS}cat${IFS}/etc/passwd'
        ];

        const httpSender = new HttpSender();

        // Test each endpoint
        for (const endpoint of Object.values(API_ENDPOINTS)) {
            const targetUrl = `${context.target || TARGET_URL}${endpoint}`;

            for (const vector of testVectors) {
                const response = await httpSender.sendRequest({
                    url: targetUrl,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...context.headers
                    },
                    body: JSON.stringify({ command: vector })
                });

                // Analyze response for command injection indicators
                if (response.body.includes('root:') || 
                    response.body.includes('uid=') || 
                    response.time > 5000) {
                    results.vulnerabilities.push({
                        endpoint,
                        vector,
                        severity: 'High',
                        evidence: response.body,
                        impact: 'Potential remote code execution',
                        remediation: 'Implement strict input validation and command sanitization'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Command Injection test error:', error);
        results.error = error.message;
    }

    results.metadata.scanDuration = new Date() - results.metadata.startTime;
    return results;
}

// Export test functions
module.exports = {
    sqlInjectionTests,
    nosqlInjectionTests,
    commandInjectionTests
};