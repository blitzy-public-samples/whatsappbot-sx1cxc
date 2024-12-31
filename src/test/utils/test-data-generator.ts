// External imports with versions
import { faker } from '@faker-js/faker'; // ^8.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

// Internal imports
import { Contact } from '../../../backend/contact-service/src/models/contact';
import { MessageType } from '../../../backend/message-service/pkg/whatsapp/types';
import { Template, VariableType } from '../../../backend/template-service/src/types';

// Constants for test data generation
const DEFAULT_BULK_COUNT = 10;
const PHONE_NUMBER_FORMAT = '+1##########';
const DEFAULT_BATCH_SIZE = 100;
const MAX_PARALLEL_GENERATIONS = 5;
const TEMPLATE_VERSION_FORMAT = '1.0.0';
const EMAIL_DOMAIN_WHITELIST = ['test.com', 'example.com'];
const VALID_TEMPLATE_CATEGORIES = ['marketing', 'support', 'notification'];

// Types for generator options
interface TestDataGeneratorOptions {
  seed?: number;
  locale?: string;
}

interface ContactGenerationOptions {
  withGroups?: boolean;
  groupCount?: number;
  withMetadata?: boolean;
}

interface MessageGenerationOptions {
  type?: MessageType;
  withMedia?: boolean;
  withTemplate?: boolean;
  scheduled?: boolean;
}

interface TemplateGenerationOptions {
  variableCount?: number;
  category?: string;
  withI18n?: boolean;
}

interface BulkGenerationOptions {
  batchSize?: number;
  parallel?: boolean;
}

/**
 * Comprehensive test data generator for WhatsApp Web Enhancement Application
 * Provides methods to generate realistic test data while maintaining referential integrity
 */
export class TestDataGenerator {
  private faker: typeof faker;
  private defaultOrganizationId: string;
  private generatedIds: Map<string, Set<string>>;
  private relationshipTracker: Map<string, Map<string, string[]>>;

  /**
   * Initialize the test data generator with optional configuration
   * @param organizationId - Optional organization ID for generated data
   * @param options - Configuration options for the generator
   */
  constructor(
    organizationId?: string,
    options: TestDataGeneratorOptions = {}
  ) {
    this.faker = faker;
    
    // Configure faker
    if (options.seed) {
      this.faker.seed(options.seed);
    }
    if (options.locale) {
      this.faker.setLocale(options.locale);
    }

    // Initialize tracking maps
    this.defaultOrganizationId = organizationId || uuidv4();
    this.generatedIds = new Map();
    this.relationshipTracker = new Map();
  }

  /**
   * Generate a test contact with realistic data
   * @param overrides - Optional field overrides
   * @param options - Generation options
   * @returns Generated contact object
   */
  public generateContact(
    overrides: Partial<Contact> = {},
    options: ContactGenerationOptions = {}
  ): Contact {
    const id = uuidv4();
    this.trackGeneratedId('contact', id);

    const phoneNumber = this.faker.phone.number(PHONE_NUMBER_FORMAT);
    const email = this.faker.internet.email({
      provider: this.faker.helpers.arrayElement(EMAIL_DOMAIN_WHITELIST)
    });

    const metadata: Record<string, unknown> = options.withMetadata ? {
      source: this.faker.helpers.arrayElement(['import', 'manual', 'sync']),
      tags: this.faker.helpers.arrayElements(['vip', 'business', 'retail'], { min: 1, max: 3 }),
      lastInteraction: this.faker.date.recent(),
      preferences: {
        language: this.faker.helpers.arrayElement(['en', 'es', 'fr']),
        timezone: this.faker.location.timeZone(),
        notifications: this.faker.datatype.boolean()
      }
    } : {};

    const contact: Contact = {
      id,
      phone_number: phoneNumber,
      first_name: this.faker.person.firstName(),
      last_name: this.faker.person.lastName(),
      email,
      metadata,
      tags: [],
      is_active: true,
      created_at: this.faker.date.past(),
      updated_at: this.faker.date.recent(),
      last_contacted_at: this.faker.date.recent(),
      organization_id: this.defaultOrganizationId,
      is_deleted: false,
      version: 1,
      ...overrides
    };

    return contact;
  }

  /**
   * Generate a test message with proper relationships
   * @param overrides - Optional field overrides
   * @param options - Generation options
   * @returns Generated message object
   */
  public generateMessage(
    overrides: Partial<Message> = {},
    options: MessageGenerationOptions = {}
  ): Message {
    const id = uuidv4();
    this.trackGeneratedId('message', id);

    const type = options.type || this.faker.helpers.arrayElement(['TEXT', 'TEMPLATE', 'MEDIA']);
    let content: any = {};
    let template: Template | undefined;

    if (type === 'TEMPLATE' || options.withTemplate) {
      template = this.generateTemplate();
      content = {
        template_name: template.name,
        language: this.faker.helpers.arrayElement(['en', 'es', 'fr']),
        components: template.variables.map(v => ({
          type: 'body',
          parameters: [{ type: v.type, value: this.generateVariableValue(v.type) }]
        }))
      };
    } else if (type === 'MEDIA' || options.withMedia) {
      content = {
        media_url: this.faker.image.url(),
        media_type: this.faker.helpers.arrayElement(['image', 'video', 'document']),
        caption: this.faker.lorem.sentence(),
        media_size: this.faker.number.int({ min: 1000, max: 1000000 })
      };
    } else {
      content = {
        text: this.faker.lorem.paragraph(),
        rich_text: true,
        formatting: {
          bold: [{ start: 0, length: 5 }],
          italic: [],
          links: []
        }
      };
    }

    const message: Message = {
      id,
      to: this.faker.phone.number(PHONE_NUMBER_FORMAT),
      type,
      content,
      template,
      status: this.faker.helpers.arrayElement(['pending', 'sent', 'delivered', 'failed']),
      created_at: this.faker.date.recent(),
      updated_at: this.faker.date.recent(),
      scheduled_for: options.scheduled ? this.faker.date.future() : undefined,
      delivered_at: undefined,
      retry_count: 0,
      metadata: {},
      ...overrides
    };

    return message;
  }

  /**
   * Generate a test template with variables and validation
   * @param overrides - Optional field overrides
   * @param options - Generation options
   * @returns Generated template object
   */
  public generateTemplate(
    overrides: Partial<Template> = {},
    options: TemplateGenerationOptions = {}
  ): Template {
    const id = uuidv4();
    this.trackGeneratedId('template', id);

    const variableCount = options.variableCount || this.faker.number.int({ min: 1, max: 5 });
    const variables = Array.from({ length: variableCount }, () => this.generateTemplateVariable());

    const template: Template = {
      id,
      name: `template_${this.faker.word.sample()}_${this.faker.number.int(999)}`,
      content: this.generateTemplateContent(variables),
      variables,
      organizationId: this.defaultOrganizationId,
      createdBy: uuidv4(),
      createdAt: this.faker.date.past(),
      updatedAt: this.faker.date.recent(),
      isActive: true,
      version: 1,
      category: options.category || this.faker.helpers.arrayElement(VALID_TEMPLATE_CATEGORIES),
      metadata: {},
      ...overrides
    };

    return template;
  }

  /**
   * Generate multiple entities in bulk with relationship maintenance
   * @param type - Type of entity to generate
   * @param count - Number of entities to generate
   * @param options - Bulk generation options
   * @returns Array of generated entities
   */
  public async generateBulk<T>(
    type: 'contact' | 'message' | 'template',
    count: number = DEFAULT_BULK_COUNT,
    options: BulkGenerationOptions = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    const batches = Math.ceil(count / batchSize);
    const results: T[] = [];

    for (let i = 0; i < batches; i++) {
      const batchCount = Math.min(batchSize, count - i * batchSize);
      const batchPromises = Array.from({ length: batchCount }, () => {
        switch (type) {
          case 'contact':
            return this.generateContact();
          case 'message':
            return this.generateMessage();
          case 'template':
            return this.generateTemplate();
          default:
            throw new Error(`Unsupported entity type: ${type}`);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  // Private helper methods
  private trackGeneratedId(type: string, id: string): void {
    if (!this.generatedIds.has(type)) {
      this.generatedIds.set(type, new Set());
    }
    this.generatedIds.get(type)!.add(id);
  }

  private generateTemplateVariable(): TemplateVariable {
    const type = this.faker.helpers.arrayElement(Object.values(VariableType));
    return {
      name: this.faker.helpers.slugify(this.faker.word.sample()),
      type,
      required: this.faker.datatype.boolean(),
      defaultValue: this.generateVariableValue(type),
      validation: null,
      description: this.faker.lorem.sentence(),
      i18n: {
        en: this.faker.lorem.words(3),
        es: this.faker.lorem.words(3),
        fr: this.faker.lorem.words(3)
      }
    };
  }

  private generateVariableValue(type: VariableType): any {
    switch (type) {
      case VariableType.TEXT:
        return this.faker.lorem.words(3);
      case VariableType.NUMBER:
        return this.faker.number.int(100);
      case VariableType.DATE:
        return this.faker.date.recent();
      case VariableType.BOOLEAN:
        return this.faker.datatype.boolean();
      case VariableType.CURRENCY:
        return this.faker.finance.amount();
      default:
        return null;
    }
  }

  private generateTemplateContent(variables: TemplateVariable[]): string {
    let content = this.faker.lorem.paragraph();
    variables.forEach(variable => {
      content = content.replace(
        this.faker.word.sample(),
        `{{${variable.name}}}`
      );
    });
    return content;
  }
}