// @version @reduxjs/toolkit ^1.9.x
import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { 
  Template, 
  CreateTemplateRequest, 
  UpdateTemplateRequest, 
  TemplateValidationError 
} from '../../types/templates';
import templatesApi from '../../services/api/templates';
import { LoadingState } from '../../types/common';
import { RootState } from '../store';

// State interface for the templates slice
interface TemplatesState {
  items: Template[];
  selectedTemplate: Template | null;
  loadingState: LoadingState;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters: {
    isActive?: boolean;
    search?: string;
    organizationId?: string;
  };
  sort: {
    field: string;
    order: 'asc' | 'desc';
  };
  optimisticUpdates: Map<string, Template>;
  validationErrors: Map<string, TemplateValidationError[]>;
}

// Initial state
const initialState: TemplatesState = {
  items: [],
  selectedTemplate: null,
  loadingState: LoadingState.IDLE,
  error: null,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    hasNext: false,
    hasPrevious: false,
  },
  filters: {},
  sort: {
    field: 'createdAt',
    order: 'desc',
  },
  optimisticUpdates: new Map(),
  validationErrors: new Map(),
};

// Async thunks
export const fetchTemplates = createAsyncThunk(
  'templates/fetchTemplates',
  async ({ 
    page, 
    pageSize, 
    filters, 
    sort 
  }: {
    page: number;
    pageSize: number;
    filters?: typeof initialState.filters;
    sort?: typeof initialState.sort;
  }) => {
    const response = await templatesApi.getTemplates(
      page,
      pageSize,
      sort?.field || 'createdAt',
      sort?.order || 'desc',
      filters
    );
    return response;
  }
);

export const createTemplate = createAsyncThunk(
  'templates/createTemplate',
  async (template: CreateTemplateRequest, { rejectWithValue }) => {
    try {
      // Validate template before sending
      const validationResponse = await templatesApi.validateTemplate(template);
      if (validationResponse.data.errors?.length) {
        return rejectWithValue(validationResponse.data.errors);
      }
      
      const response = await templatesApi.createTemplate(template);
      return response.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateTemplate = createAsyncThunk(
  'templates/updateTemplate',
  async (template: UpdateTemplateRequest, { rejectWithValue }) => {
    try {
      const validationResponse = await templatesApi.validateTemplate(template);
      if (validationResponse.data.errors?.length) {
        return rejectWithValue(validationResponse.data.errors);
      }

      const response = await templatesApi.updateTemplate(template);
      return response.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const deleteTemplate = createAsyncThunk(
  'templates/deleteTemplate',
  async (id: string, { rejectWithValue }) => {
    try {
      await templatesApi.deleteTemplate(id);
      return id;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Create the templates slice
const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    setSelectedTemplate: (state, action: PayloadAction<Template | null>) => {
      state.selectedTemplate = action.payload;
    },
    setFilters: (state, action: PayloadAction<typeof initialState.filters>) => {
      state.filters = action.payload;
      state.pagination.page = 1; // Reset to first page when filters change
    },
    setSort: (state, action: PayloadAction<typeof initialState.sort>) => {
      state.sort = action.payload;
    },
    clearValidationErrors: (state) => {
      state.validationErrors.clear();
    },
    resetTemplatesState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch templates
      .addCase(fetchTemplates.pending, (state) => {
        state.loadingState = LoadingState.LOADING;
        state.error = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loadingState = LoadingState.SUCCESS;
        state.items = action.payload.items;
        state.pagination = {
          page: action.payload.page + 1, // Convert from 0-based to 1-based
          pageSize: action.payload.pageSize,
          total: action.payload.total,
          hasNext: action.payload.hasNext,
          hasPrevious: action.payload.hasPrevious,
        };
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loadingState = LoadingState.ERROR;
        state.error = action.error.message || 'Failed to fetch templates';
      })
      
      // Create template
      .addCase(createTemplate.pending, (state) => {
        state.loadingState = LoadingState.LOADING;
        state.error = null;
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.loadingState = LoadingState.SUCCESS;
        state.items.unshift(action.payload);
        state.pagination.total += 1;
      })
      .addCase(createTemplate.rejected, (state, action) => {
        state.loadingState = LoadingState.ERROR;
        if (Array.isArray(action.payload)) {
          state.validationErrors.set('create', action.payload);
        } else {
          state.error = 'Failed to create template';
        }
      })
      
      // Update template
      .addCase(updateTemplate.pending, (state, action) => {
        state.loadingState = LoadingState.LOADING;
        // Optimistic update
        const templateIndex = state.items.findIndex(t => t.id === action.meta.arg.id);
        if (templateIndex !== -1) {
          state.optimisticUpdates.set(action.meta.arg.id, state.items[templateIndex]);
          state.items[templateIndex] = { ...state.items[templateIndex], ...action.meta.arg };
        }
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        state.loadingState = LoadingState.SUCCESS;
        state.optimisticUpdates.delete(action.payload.id);
        const index = state.items.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(updateTemplate.rejected, (state, action) => {
        state.loadingState = LoadingState.ERROR;
        // Revert optimistic update
        const templateId = action.meta.arg.id;
        const originalTemplate = state.optimisticUpdates.get(templateId);
        if (originalTemplate) {
          const index = state.items.findIndex(t => t.id === templateId);
          if (index !== -1) {
            state.items[index] = originalTemplate;
          }
          state.optimisticUpdates.delete(templateId);
        }
        if (Array.isArray(action.payload)) {
          state.validationErrors.set(templateId, action.payload);
        } else {
          state.error = 'Failed to update template';
        }
      })
      
      // Delete template
      .addCase(deleteTemplate.pending, (state, action) => {
        state.loadingState = LoadingState.LOADING;
        // Optimistic delete
        const templateIndex = state.items.findIndex(t => t.id === action.meta.arg);
        if (templateIndex !== -1) {
          state.optimisticUpdates.set(action.meta.arg, state.items[templateIndex]);
          state.items.splice(templateIndex, 1);
          state.pagination.total -= 1;
        }
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.loadingState = LoadingState.SUCCESS;
        state.optimisticUpdates.delete(action.payload);
      })
      .addCase(deleteTemplate.rejected, (state, action) => {
        state.loadingState = LoadingState.ERROR;
        // Revert optimistic delete
        const templateId = action.meta.arg;
        const originalTemplate = state.optimisticUpdates.get(templateId);
        if (originalTemplate) {
          state.items.push(originalTemplate);
          state.optimisticUpdates.delete(templateId);
          state.pagination.total += 1;
        }
        state.error = 'Failed to delete template';
      });
  },
});

// Export actions
export const {
  setSelectedTemplate,
  setFilters,
  setSort,
  clearValidationErrors,
  resetTemplatesState,
} = templatesSlice.actions;

// Selectors
export const selectTemplates = (state: RootState) => state.templates.items;
export const selectSelectedTemplate = (state: RootState) => state.templates.selectedTemplate;
export const selectTemplatesLoadingState = (state: RootState) => state.templates.loadingState;
export const selectTemplatesError = (state: RootState) => state.templates.error;
export const selectTemplatesPagination = (state: RootState) => state.templates.pagination;
export const selectTemplatesFilters = (state: RootState) => state.templates.filters;
export const selectTemplatesSort = (state: RootState) => state.templates.sort;

// Memoized selectors
export const selectTemplateById = createSelector(
  [selectTemplates, (_state: RootState, templateId: string) => templateId],
  (templates, templateId) => templates.find(t => t.id === templateId)
);

export const selectActiveTemplates = createSelector(
  [selectTemplates],
  (templates) => templates.filter(t => t.isActive)
);

export const selectTemplatesWithMeta = createSelector(
  [selectTemplates, selectTemplatesLoadingState, selectTemplatesError],
  (templates, loadingState, error) => ({
    templates,
    loadingState,
    error,
  })
);

// Export reducer
export default templatesSlice.reducer;