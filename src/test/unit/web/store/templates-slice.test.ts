// @version @jest/globals ^29.x
// @version @reduxjs/toolkit ^1.9.x
// @version @testing-library/react ^13.x

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import {
  reducer as templatesReducer,
  actions,
  selectors,
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate
} from '../../../../web/src/store/slices/templatesSlice';
import { Template } from '../../../../web/src/types/templates';
import templateService from '../../../../web/src/services/api/templates';
import { LoadingState } from '../../../../web/src/types/common';

// Mock the template service
jest.mock('../../../../web/src/services/api/templates');

// Test data setup
const mockTemplate: Template = {
  id: 'template-1',
  name: 'Test Template',
  content: 'Hello {name}',
  variables: [
    {
      name: 'name',
      type: 'TEXT',
      required: true,
      defaultValue: null,
      validation: null
    }
  ],
  organizationId: 'org-1',
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true
};

const mockPaginatedResponse = {
  items: [mockTemplate],
  total: 1,
  page: 0,
  pageSize: 20,
  hasNext: false,
  hasPrevious: false
};

// Store setup helper
const createTestStore = () => {
  return configureStore({
    reducer: {
      templates: templatesReducer
    }
  });
};

describe('templatesSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('reducer and actions', () => {
    test('should return initial state', () => {
      const state = store.getState().templates;
      expect(state.items).toEqual([]);
      expect(state.loadingState).toBe(LoadingState.IDLE);
      expect(state.error).toBeNull();
    });

    test('should handle setSelectedTemplate', () => {
      store.dispatch(actions.setSelectedTemplate(mockTemplate));
      const state = store.getState().templates;
      expect(state.selectedTemplate).toEqual(mockTemplate);
    });

    test('should handle setFilters', () => {
      const filters = { isActive: true, search: 'test' };
      store.dispatch(actions.setFilters(filters));
      const state = store.getState().templates;
      expect(state.filters).toEqual(filters);
      expect(state.pagination.page).toBe(1); // Should reset to first page
    });

    test('should handle setSort', () => {
      const sort = { field: 'name', order: 'asc' as const };
      store.dispatch(actions.setSort(sort));
      const state = store.getState().templates;
      expect(state.sort).toEqual(sort);
    });

    test('should handle clearValidationErrors', () => {
      // First set some validation errors
      const state = store.getState().templates;
      state.validationErrors.set('template-1', [{ field: 'name', message: 'Required' }]);
      
      store.dispatch(actions.clearValidationErrors());
      expect(store.getState().templates.validationErrors.size).toBe(0);
    });

    test('should handle resetTemplatesState', () => {
      // First modify the state
      store.dispatch(actions.setSelectedTemplate(mockTemplate));
      store.dispatch(actions.setFilters({ isActive: true }));
      
      // Then reset
      store.dispatch(actions.resetTemplatesState());
      const state = store.getState().templates;
      expect(state).toEqual(expect.objectContaining({
        items: [],
        selectedTemplate: null,
        loadingState: LoadingState.IDLE,
        error: null
      }));
    });
  });

  describe('async thunks', () => {
    describe('fetchTemplates', () => {
      test('should handle successful template fetch', async () => {
        (templateService.getTemplates as jest.Mock).mockResolvedValue(mockPaginatedResponse);

        await store.dispatch(fetchTemplates({
          page: 1,
          pageSize: 20,
          filters: { isActive: true },
          sort: { field: 'createdAt', order: 'desc' }
        }));

        const state = store.getState().templates;
        expect(state.loadingState).toBe(LoadingState.SUCCESS);
        expect(state.items).toEqual(mockPaginatedResponse.items);
        expect(state.pagination.total).toBe(mockPaginatedResponse.total);
      });

      test('should handle failed template fetch', async () => {
        const error = new Error('Network error');
        (templateService.getTemplates as jest.Mock).mockRejectedValue(error);

        await store.dispatch(fetchTemplates({ page: 1, pageSize: 20 }));

        const state = store.getState().templates;
        expect(state.loadingState).toBe(LoadingState.ERROR);
        expect(state.error).toBe('Failed to fetch templates');
      });
    });

    describe('createTemplate', () => {
      const newTemplate = {
        name: 'New Template',
        content: 'Hello {name}',
        variables: [],
        organizationId: 'org-1'
      };

      test('should handle successful template creation', async () => {
        (templateService.validateTemplate as jest.Mock).mockResolvedValue({ data: { errors: [] } });
        (templateService.createTemplate as jest.Mock).mockResolvedValue({ data: mockTemplate });

        await store.dispatch(createTemplate(newTemplate));

        const state = store.getState().templates;
        expect(state.loadingState).toBe(LoadingState.SUCCESS);
        expect(state.items[0]).toEqual(mockTemplate);
      });

      test('should handle validation errors during creation', async () => {
        const validationErrors = [{ field: 'name', message: 'Name is required' }];
        (templateService.validateTemplate as jest.Mock).mockResolvedValue({ 
          data: { errors: validationErrors } 
        });

        await store.dispatch(createTemplate(newTemplate));

        const state = store.getState().templates;
        expect(state.loadingState).toBe(LoadingState.ERROR);
        expect(state.validationErrors.get('create')).toEqual(validationErrors);
      });
    });

    describe('updateTemplate', () => {
      const updatedTemplate = {
        id: 'template-1',
        name: 'Updated Template',
        content: 'Updated content',
        variables: [],
        isActive: true
      };

      test('should handle successful template update with optimistic updates', async () => {
        // Setup initial state with template
        store.dispatch(actions.setSelectedTemplate(mockTemplate));
        
        (templateService.validateTemplate as jest.Mock).mockResolvedValue({ data: { errors: [] } });
        (templateService.updateTemplate as jest.Mock).mockResolvedValue({ data: { ...mockTemplate, ...updatedTemplate } });

        await store.dispatch(updateTemplate(updatedTemplate));

        const state = store.getState().templates;
        expect(state.loadingState).toBe(LoadingState.SUCCESS);
        expect(state.optimisticUpdates.size).toBe(0);
        expect(state.items[0].name).toBe(updatedTemplate.name);
      });

      test('should handle failed update with rollback', async () => {
        // Setup initial state
        store.dispatch(actions.setSelectedTemplate(mockTemplate));
        
        const error = new Error('Update failed');
        (templateService.validateTemplate as jest.Mock).mockResolvedValue({ data: { errors: [] } });
        (templateService.updateTemplate as jest.Mock).mockRejectedValue(error);

        await store.dispatch(updateTemplate(updatedTemplate));

        const state = store.getState().templates;
        expect(state.loadingState).toBe(LoadingState.ERROR);
        expect(state.items[0]).toEqual(mockTemplate); // Should be rolled back
        expect(state.error).toBe('Failed to update template');
      });
    });

    describe('deleteTemplate', () => {
      test('should handle successful template deletion with optimistic updates', async () => {
        // Setup initial state
        store.dispatch(actions.setSelectedTemplate(mockTemplate));
        store.getState().templates.items.push(mockTemplate);

        (templateService.deleteTemplate as jest.Mock).mockResolvedValue({ data: null });

        await store.dispatch(deleteTemplate(mockTemplate.id));

        const state = store.getState().templates;
        expect(state.loadingState).toBe(LoadingState.SUCCESS);
        expect(state.items).toHaveLength(0);
        expect(state.optimisticUpdates.size).toBe(0);
      });

      test('should handle failed deletion with rollback', async () => {
        // Setup initial state
        store.dispatch(actions.setSelectedTemplate(mockTemplate));
        store.getState().templates.items.push(mockTemplate);

        const error = new Error('Delete failed');
        (templateService.deleteTemplate as jest.Mock).mockRejectedValue(error);

        await store.dispatch(deleteTemplate(mockTemplate.id));

        const state = store.getState().templates;
        expect(state.loadingState).toBe(LoadingState.ERROR);
        expect(state.items).toContainEqual(mockTemplate); // Should be rolled back
        expect(state.error).toBe('Failed to delete template');
      });
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      // Setup initial state for selector tests
      store.dispatch(actions.setSelectedTemplate(mockTemplate));
      store.getState().templates.items.push(mockTemplate);
    });

    test('selectTemplates should return all templates', () => {
      const templates = selectors.selectTemplates(store.getState());
      expect(templates).toEqual([mockTemplate]);
    });

    test('selectSelectedTemplate should return selected template', () => {
      const selected = selectors.selectSelectedTemplate(store.getState());
      expect(selected).toEqual(mockTemplate);
    });

    test('selectTemplateById should return template by id', () => {
      const template = selectors.selectTemplateById(store.getState(), mockTemplate.id);
      expect(template).toEqual(mockTemplate);
    });

    test('selectActiveTemplates should return only active templates', () => {
      const activeTemplates = selectors.selectActiveTemplates(store.getState());
      expect(activeTemplates).toEqual([mockTemplate]);
    });

    test('selectTemplatesWithMeta should return templates with metadata', () => {
      const templatesWithMeta = selectors.selectTemplatesWithMeta(store.getState());
      expect(templatesWithMeta).toEqual({
        templates: [mockTemplate],
        loadingState: LoadingState.IDLE,
        error: null
      });
    });
  });
});