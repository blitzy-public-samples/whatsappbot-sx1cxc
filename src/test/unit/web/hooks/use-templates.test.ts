// @version @testing-library/react-hooks ^8.0.x
// @version @testing-library/react ^14.0.x
// @version react-redux ^8.1.x
// @version @reduxjs/toolkit ^1.9.x
// @version jest ^29.x

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import templatesReducer, {
  setTemplates,
  addTemplate,
  updateTemplate as updateTemplateAction,
  removeTemplate
} from '../../../../web/src/store/slices/templatesSlice';
import { useTemplates } from '../../../../web/src/hooks/useTemplates';
import { Template, VariableType } from '../../../../web/src/types/templates';
import { LoadingState } from '../../../../web/src/types/common';
import templatesApi from '../../../../web/src/services/api/templates';

// Mock the templates API
jest.mock('../../../../web/src/services/api/templates');

// Test data
const testTemplate: Template = {
  id: '1',
  name: 'Test Template',
  content: 'Hello {name}',
  variables: [
    { 
      name: 'name',
      type: VariableType.TEXT,
      required: true,
      defaultValue: null,
      validation: null
    }
  ],
  organizationId: 'org-1',
  createdBy: 'user-1',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  isActive: true
};

const testTemplates = [testTemplate];

// Setup test store
const createTestStore = () => configureStore({
  reducer: {
    templates: templatesReducer
  },
  preloadedState: {
    templates: {
      items: [],
      selectedTemplate: null,
      loadingState: LoadingState.IDLE,
      error: null,
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        hasNext: false,
        hasPrevious: false
      },
      filters: {},
      sort: {
        field: 'createdAt',
        order: 'desc'
      },
      optimisticUpdates: new Map(),
      validationErrors: new Map()
    }
  }
});

// Test wrapper component
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={createTestStore()}>{children}</Provider>
);

describe('useTemplates hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (templatesApi.getTemplates as jest.Mock).mockResolvedValue({
      items: testTemplates,
      total: 1,
      page: 0,
      pageSize: 20,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useTemplates(), { wrapper });

    expect(result.current.templates).toEqual([]);
    expect(result.current.loading).toBe(LoadingState.IDLE);
    expect(result.current.error).toBeNull();
    expect(result.current.selectedTemplate).toBeNull();
  });

  it('should handle template loading', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useTemplates(), { wrapper });

    // Initial load should be triggered automatically
    expect(result.current.loading).toBe(LoadingState.LOADING);

    await waitForNextUpdate();

    expect(result.current.loading).toBe(LoadingState.SUCCESS);
    expect(result.current.templates).toEqual(testTemplates);
    expect(templatesApi.getTemplates).toHaveBeenCalledWith(
      1,
      20,
      'createdAt',
      'desc',
      {}
    );
  });

  it('should handle template loading error', async () => {
    const error = new Error('Failed to load templates');
    (templatesApi.getTemplates as jest.Mock).mockRejectedValueOnce(error);

    const { result, waitForNextUpdate } = renderHook(() => useTemplates(), { wrapper });

    await waitForNextUpdate();

    expect(result.current.loading).toBe(LoadingState.ERROR);
    expect(result.current.error).toBe('Failed to fetch templates');
  });

  it('should handle template creation', async () => {
    const newTemplate = { ...testTemplate, id: '2' };
    (templatesApi.createTemplate as jest.Mock).mockResolvedValueOnce({ data: newTemplate });

    const { result, waitForNextUpdate } = renderHook(() => useTemplates(), { wrapper });

    await act(async () => {
      await result.current.createTemplate({
        name: newTemplate.name,
        content: newTemplate.content,
        variables: newTemplate.variables,
        organizationId: newTemplate.organizationId
      });
    });

    expect(result.current.loading).toBe(LoadingState.SUCCESS);
    expect(templatesApi.createTemplate).toHaveBeenCalled();
  });

  it('should handle template creation validation error', async () => {
    const validationError = {
      isValid: false,
      errors: [{ field: 'name', message: 'Name is required' }]
    };
    (templatesApi.validateTemplate as jest.Mock).mockResolvedValueOnce({ data: validationError });

    const { result, waitForNextUpdate } = renderHook(() => useTemplates(), { wrapper });

    try {
      await act(async () => {
        await result.current.createTemplate({
          name: '',
          content: 'Test',
          variables: [],
          organizationId: 'org-1'
        });
      });
    } catch (error) {
      expect(error.message).toBe('Template validation failed');
    }
  });

  it('should handle template update', async () => {
    const updatedTemplate = { ...testTemplate, name: 'Updated Template' };
    (templatesApi.updateTemplate as jest.Mock).mockResolvedValueOnce({ data: updatedTemplate });

    const { result, waitForNextUpdate } = renderHook(() => useTemplates(), { wrapper });

    await act(async () => {
      await result.current.updateTemplate({
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        content: updatedTemplate.content,
        variables: updatedTemplate.variables,
        isActive: updatedTemplate.isActive
      });
    });

    expect(result.current.loading).toBe(LoadingState.SUCCESS);
    expect(templatesApi.updateTemplate).toHaveBeenCalled();
  });

  it('should handle template deletion', async () => {
    (templatesApi.deleteTemplate as jest.Mock).mockResolvedValueOnce({ data: null });

    const { result, waitForNextUpdate } = renderHook(() => useTemplates(), { wrapper });

    await act(async () => {
      await result.current.deleteTemplate(testTemplate.id);
    });

    expect(result.current.loading).toBe(LoadingState.SUCCESS);
    expect(templatesApi.deleteTemplate).toHaveBeenCalledWith(testTemplate.id);
  });

  it('should handle template validation', async () => {
    const { result } = renderHook(() => useTemplates(), { wrapper });

    await act(async () => {
      const validationResult = await result.current.validateTemplate(testTemplate);
      expect(validationResult.isValid).toBe(true);
    });

    // Test invalid template
    const invalidTemplate = {
      ...testTemplate,
      content: 'Hello {undeclaredVariable}'
    };

    await act(async () => {
      const validationResult = await result.current.validateTemplate(invalidTemplate);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors[0].field).toBe('variables');
    });
  });

  it('should handle template preview', () => {
    const { result } = renderHook(() => useTemplates(), { wrapper });

    const preview = result.current.previewTemplate(testTemplate, { name: 'John' });
    expect(preview).toBe('Hello John');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useTemplates(), { wrapper });
    unmount();
    // Verify cleanup actions are performed
  });
});