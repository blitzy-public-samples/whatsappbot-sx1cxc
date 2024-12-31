// External imports with versions
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { jest } from '@jest/globals'; // ^29.0.0

// Internal imports
import { Contact } from '../../../backend/contact-service/src/models/contact';
import { Group } from '../../../backend/contact-service/src/models/group';

// Mock storage
const mockContacts = new Map<string, Contact & { deleted?: boolean, version: number }>();
const mockGroups = new Map<string, Group & { members: Set<string> }>();
const mockEvents = new Array<{ type: string, data: any, timestamp: number }>();

/**
 * Enhanced mock implementation of ContactManager for testing with validation,
 * error handling, and event tracking capabilities.
 */
@jest.mock('../../../backend/contact-service/src/services/contact_manager')
export class MockContactManager {
    private contacts: Map<string, Contact>;
    private groups: Map<string, Group>;
    private events: Array<{ type: string, data: any, timestamp: number }>;
    private operationDelay: number;

    constructor(delay: number = 100) {
        this.contacts = mockContacts;
        this.groups = mockGroups;
        this.events = mockEvents;
        this.operationDelay = delay;
    }

    /**
     * Creates a new mock contact with validation and event tracking
     * @param contactData Contact creation data
     * @returns Promise<Contact> Created mock contact with version
     */
    async createContact(contactData: Partial<Contact>): Promise<Contact> {
        // Validate required fields
        if (!contactData.phone_number || !contactData.first_name || !contactData.last_name) {
            throw new Error('Missing required contact fields');
        }

        // Check for duplicate phone numbers
        const existingContact = Array.from(this.contacts.values())
            .find(c => c.phone_number === contactData.phone_number && !c.deleted);
        if (existingContact) {
            throw new Error('Phone number already exists');
        }

        // Create new contact with metadata
        const contact: Contact & { deleted?: boolean, version: number } = {
            id: uuidv4(),
            phone_number: contactData.phone_number,
            first_name: contactData.first_name,
            last_name: contactData.last_name,
            email: contactData.email || null,
            metadata: contactData.metadata || {},
            tags: contactData.tags || [],
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            organization_id: contactData.organization_id || uuidv4(),
            version: 1,
            deleted: false
        };

        // Store contact and track event
        this.contacts.set(contact.id, contact);
        this.events.push({
            type: 'CONTACT_CREATED',
            data: { contactId: contact.id, contact },
            timestamp: Date.now()
        });

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, this.operationDelay));
        return contact;
    }

    /**
     * Updates an existing contact with version control
     * @param contactId Contact ID to update
     * @param updateData Update data
     * @param version Current version for optimistic locking
     * @returns Promise<Contact> Updated contact
     */
    async updateContact(
        contactId: string,
        updateData: Partial<Contact>,
        version: number
    ): Promise<Contact> {
        const contact = this.contacts.get(contactId);

        // Validate contact exists and not deleted
        if (!contact || contact.deleted) {
            throw new Error('Contact not found');
        }

        // Version control check
        if (contact.version !== version) {
            throw new Error('Version conflict detected');
        }

        // Update allowed fields
        const updatableFields = [
            'first_name',
            'last_name',
            'email',
            'metadata',
            'tags',
            'is_active'
        ];

        for (const field of updatableFields) {
            if (field in updateData) {
                contact[field] = updateData[field];
            }
        }

        // Update metadata
        contact.version++;
        contact.updated_at = new Date();

        // Store and track update
        this.contacts.set(contactId, contact);
        this.events.push({
            type: 'CONTACT_UPDATED',
            data: { contactId, updates: updateData, version: contact.version },
            timestamp: Date.now()
        });

        await new Promise(resolve => setTimeout(resolve, this.operationDelay));
        return contact;
    }

    /**
     * Performs soft deletion of a contact
     * @param contactId Contact ID to delete
     * @returns Promise<boolean> Deletion success status
     */
    async deleteContact(contactId: string): Promise<boolean> {
        const contact = this.contacts.get(contactId);

        if (!contact || contact.deleted) {
            throw new Error('Contact not found');
        }

        // Soft delete
        contact.deleted = true;
        contact.is_active = false;
        contact.version++;

        // Remove from all groups
        for (const group of this.groups.values()) {
            group.members.delete(contactId);
        }

        // Track deletion
        this.events.push({
            type: 'CONTACT_DELETED',
            data: { contactId, version: contact.version },
            timestamp: Date.now()
        });

        await new Promise(resolve => setTimeout(resolve, this.operationDelay));
        return true;
    }

    /**
     * Searches contacts based on criteria
     * @param criteria Search criteria
     * @returns Promise<Contact[]> Matching contacts
     */
    async searchContacts(criteria: {
        phone_number?: string;
        name?: string;
        tags?: string[];
        is_active?: boolean;
        page?: number;
        limit?: number;
    }): Promise<Contact[]> {
        let results = Array.from(this.contacts.values())
            .filter(contact => !contact.deleted);

        // Apply filters
        if (criteria.phone_number) {
            results = results.filter(c => 
                c.phone_number.includes(criteria.phone_number));
        }

        if (criteria.name) {
            const searchName = criteria.name.toLowerCase();
            results = results.filter(c =>
                c.first_name.toLowerCase().includes(searchName) ||
                c.last_name.toLowerCase().includes(searchName)
            );
        }

        if (criteria.tags?.length) {
            results = results.filter(c =>
                criteria.tags.some(tag => c.tags.includes(tag))
            );
        }

        if (criteria.is_active !== undefined) {
            results = results.filter(c => c.is_active === criteria.is_active);
        }

        // Handle pagination
        const page = criteria.page || 1;
        const limit = criteria.limit || 10;
        const start = (page - 1) * limit;
        const paginatedResults = results.slice(start, start + limit);

        // Track search
        this.events.push({
            type: 'CONTACTS_SEARCHED',
            data: { criteria, resultCount: paginatedResults.length },
            timestamp: Date.now()
        });

        await new Promise(resolve => setTimeout(resolve, this.operationDelay));
        return paginatedResults;
    }

    /**
     * Resets mock data for test isolation
     * @returns Promise<void>
     */
    async resetMockData(): Promise<void> {
        this.contacts.clear();
        this.groups.clear();
        this.events.length = 0;
        await new Promise(resolve => setTimeout(resolve, this.operationDelay));
    }
}