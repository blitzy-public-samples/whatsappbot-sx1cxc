// @zaproxy/core v2.12.0 - Core ZAP functionality for enterprise security testing
const ZAP = require('@zaproxy/core');

// @zaproxy/utils v2.12.0 - Enhanced ZAP utilities for test automation
const utils = require('@zaproxy/utils');

// @zaproxy/compliance-utils v2.12.0 - Compliance testing utilities
const complianceUtils = require('@zaproxy/compliance-utils');

// Import configuration from full-scan.yaml
const { attack_vectors, compliance } = require('../configs/full-scan.yaml');

// Global constants
const TARGET_URL = process.env.TARGET_URL;
const REPORT_PATH = process.env.REPORT_PATH;

// Enterprise-grade XSS payloads with WAF bypass patterns
const XSS_PAYLOADS = [
    // Basic payload with encoding variations
    '<script>alert(1)</script>',
    '"><script>alert(1)</script>',
    // WAF bypass patterns
    '<img/src/onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    // Encoded payloads
    '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;',
    // Event handler payloads
    'javascript:alert(1)',
    // DOM manipulation payloads
    'document.write("<script>alert(1)</script>")',
    // Advanced WAF bypass techniques
    '"><img src=x onerror=prompt(1);>',
    '<object data="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">'
];

// Compliance mapping for security requirements
const COMPLIANCE_MAPPINGS = {
    'SOC2': {
        'CC6.1': 'Input Validation',
        'CC6.6': 'System Security',
        'CC7.1': 'Security Monitoring'
    },
    'PCI-DSS': {
        '6.5.1': 'XSS Prevention',
        '6.6': 'Security Assessment',
        '11.3': 'Penetration Testing'
    }
};

/**
 * Enhanced reflected XSS vulnerability testing with WAF bypass detection
 * @param {Object} targetUrls - List of target URLs to test
 * @param {Object} options - Test configuration options
 * @param {Object} complianceRequirements - Compliance requirements to validate
 * @returns {Object} Detailed test results with compliance mapping
 */
async function reflectedXssTests(targetUrls, options, complianceRequirements) {
    const results = {
        vulnerabilities: [],
        complianceStatus: {},
        wafAnalysis: {},
        riskScore: 0
    };

    const zapClient = new ZAP.Client({
        apiKey: options.apiKey,
        proxy: options.proxy,
        timeout: options.timeout || 120000
    });

    try {
        // Initialize compliance validation
        const compliance = await complianceUtils.initializeValidation(complianceRequirements);

        for (const url of targetUrls) {
            for (const payload of XSS_PAYLOADS) {
                // Execute test with WAF detection
                const testResult = await zapClient.spider.scan({
                    url: url,
                    payload: payload,
                    maxChildren: options.maxChildren || 10
                });

                // Analyze WAF behavior
                const wafAnalysis = await utils.analyzeWafBehavior(testResult.response);

                // Validate against compliance requirements
                const complianceStatus = await compliance.validateTest(testResult, 'XSS');

                results.vulnerabilities.push({
                    url: url,
                    payload: payload,
                    detected: testResult.detected,
                    wafBypassed: wafAnalysis.bypassed,
                    riskLevel: utils.calculateRiskScore(testResult)
                });

                results.wafAnalysis[url] = wafAnalysis;
                results.complianceStatus = {
                    ...results.complianceStatus,
                    ...complianceStatus
                };
            }
        }

        results.riskScore = utils.calculateOverallRisk(results.vulnerabilities);
        return results;

    } catch (error) {
        console.error('Reflected XSS Test Error:', error);
        throw error;
    }
}

/**
 * Advanced stored XSS testing with persistent threat detection
 * @param {Object} targetEndpoints - Target endpoints for testing
 * @param {Object} options - Test configuration options
 * @param {Object} complianceRequirements - Compliance requirements to validate
 * @returns {Object} Comprehensive test results with persistence analysis
 */
async function storedXssTests(targetEndpoints, options, complianceRequirements) {
    const results = {
        persistentVulnerabilities: [],
        storageAnalysis: {},
        complianceStatus: {},
        riskScore: 0
    };

    const zapClient = new ZAP.Client({
        apiKey: options.apiKey,
        proxy: options.proxy,
        timeout: options.timeout || 180000
    });

    try {
        // Initialize persistence testing environment
        const persistenceTest = await utils.initializePersistenceTest(options);

        for (const endpoint of targetEndpoints) {
            // Execute persistence-focused tests
            const persistenceResult = await persistenceTest.execute({
                endpoint: endpoint,
                payloads: XSS_PAYLOADS,
                storageType: endpoint.storageType
            });

            // Analyze storage security
            const storageAnalysis = await utils.analyzeStorageSecurity(persistenceResult);

            // Validate compliance requirements
            const complianceStatus = await complianceUtils.validatePersistence(
                persistenceResult,
                complianceRequirements
            );

            results.persistentVulnerabilities.push({
                endpoint: endpoint,
                persistenceFound: persistenceResult.detected,
                storageType: persistenceResult.storageType,
                cleanupStatus: persistenceResult.cleaned
            });

            results.storageAnalysis[endpoint.url] = storageAnalysis;
            results.complianceStatus = {
                ...results.complianceStatus,
                ...complianceStatus
            };
        }

        results.riskScore = utils.calculatePersistenceRisk(results.persistentVulnerabilities);
        return results;

    } catch (error) {
        console.error('Stored XSS Test Error:', error);
        throw error;
    }
}

/**
 * Enhanced DOM-based XSS testing with client-side security validation
 * @param {Object} targetScripts - Target scripts for DOM testing
 * @param {Object} options - Test configuration options
 * @param {Object} complianceRequirements - Compliance requirements to validate
 * @returns {Object} Detailed DOM security analysis with compliance mapping
 */
async function domXssTests(targetScripts, options, complianceRequirements) {
    const results = {
        domVulnerabilities: [],
        eventHandlerAnalysis: {},
        complianceStatus: {},
        riskScore: 0
    };

    const zapClient = new ZAP.Client({
        apiKey: options.apiKey,
        proxy: options.proxy,
        timeout: options.timeout || 150000
    });

    try {
        // Initialize DOM testing environment
        const domTest = await utils.initializeDomTest(options);

        for (const script of targetScripts) {
            // Execute DOM-specific tests
            const domResult = await domTest.execute({
                script: script,
                payloads: XSS_PAYLOADS,
                eventHandlers: options.eventHandlers
            });

            // Analyze client-side security
            const eventHandlerAnalysis = await utils.analyzeEventHandlers(domResult);

            // Validate compliance requirements
            const complianceStatus = await complianceUtils.validateDomSecurity(
                domResult,
                complianceRequirements
            );

            results.domVulnerabilities.push({
                script: script,
                vulnerabilityFound: domResult.detected,
                eventHandlers: domResult.affectedHandlers,
                contextAnalysis: domResult.context
            });

            results.eventHandlerAnalysis[script.url] = eventHandlerAnalysis;
            results.complianceStatus = {
                ...results.complianceStatus,
                ...complianceStatus
            };
        }

        results.riskScore = utils.calculateDomRisk(results.domVulnerabilities);
        return results;

    } catch (error) {
        console.error('DOM XSS Test Error:', error);
        throw error;
    }
}

// Export enhanced XSS testing functions
module.exports = {
    reflectedXssTests,
    storedXssTests,
    domXssTests
};