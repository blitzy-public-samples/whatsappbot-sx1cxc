// @package @reduxjs/toolkit ^1.9.7
// @package lodash ^4.17.21

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import { 
  Contact, 
  ContactGroup, 
  ContactFormData,
  ContactListResponse,
  BulkOperationResponse 
} from '../../types/contacts';
import { 
  LoadingState,
  PaginationParams,
  ApiError 
} from '../../types/common';
import { contactsApi } from '../../services/api/contacts';

// State interface with optimistic updates support
interface ContactsState {
  contacts: Contact[];
  groups: ContactGroup[];
  selectedContacts: string[];
  loadingState: Record<string, LoadingState>;
  error: Record<string, ApiError | null>;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  searchQuery: string;
  filters: {
    tags: string[];
    groupIds: string[];
    dateRange?: {
      start: string;
      end: string;
    };
    consentStatus?: boolean;
  };
  lastUpdated: string;
  optimisticUpdates: Record<string, Contact>;
}

// Initial state
const initialState: ContactsState = {
  contacts: [],
  groups: [],
  selectedContacts: [],
  loadingState: {},
  error: {},
  pagination: {
    page: 0,
    limit: 20,
    total: 0
  },
  searchQuery: '',
  filters: {
    tags: [],
    groupIds: []
  },
  lastUpdated: '',
  optimisticUpdates: {}
};

// Async thunks
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async (params: PaginationParams, { rejectWithValue }) => {
    try {
      const response = await contactsApi.getContacts({
        ...params,
        page: params.page || 0,
        pageSize: params.pageSize || 20
      });
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const bulkDeleteContacts = createAsyncThunk(
  'contacts/bulkDelete',
  async (contactIds: string[], { rejectWithValue }) => {
    try {
      const response = await contactsApi.bulkDeleteContacts(contactIds);
      return { contactIds, response };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const importContacts = createAsyncThunk(
  'contacts/import',
  async (file: File, { rejectWithValue }) => {
    try {
      const response = await contactsApi.importContacts(file, {
        format: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
        skipExisting: true,
        fieldMappings: {},
        defaultValues: {}
      });
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const exportContacts = createAsyncThunk(
  'contacts/export',
  async (format: 'csv' | 'xlsx' | 'json', { rejectWithValue }) => {
    try {
      const response = await contactsApi.exportContacts({
        format,
        fields: ['id', 'firstName', 'lastName', 'phoneNumber', 'email', 'tags'],
        includeGroups: true,
        includeMessageHistory: false
      });
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Debounced search thunk
export const searchContacts = debounce(
  createAsyncThunk(
    'contacts/search',
    async (query: string, { getState, dispatch }) => {
      const state = getState() as { contacts: ContactsState };
      const response = await contactsApi.getContacts({
        query,
        page: state.contacts.pagination.page,
        pageSize: state.contacts.pagination.limit,
        tags: state.contacts.filters.tags,
        groupIds: state.contacts.filters.groupIds
      });
      return response;
    }
  ),
  300
);

// Slice definition
const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    setSelectedContacts: (state, action: PayloadAction<string[]>) => {
      state.selectedContacts = action.payload;
    },
    updateFilters: (state, action: PayloadAction<Partial<ContactsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    addOptimisticUpdate: (state, action: PayloadAction<Contact>) => {
      state.optimisticUpdates[action.payload.id] = action.payload;
    },
    removeOptimisticUpdate: (state, action: PayloadAction<string>) => {
      delete state.optimisticUpdates[action.payload];
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch contacts
      .addCase(fetchContacts.pending, (state) => {
        state.loadingState['fetch'] = LoadingState.LOADING;
        state.error['fetch'] = null;
      })
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.contacts = action.payload.items;
        state.pagination.total = action.payload.total;
        state.loadingState['fetch'] = LoadingState.SUCCESS;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.loadingState['fetch'] = LoadingState.ERROR;
        state.error['fetch'] = action.payload as ApiError;
      })
      // Bulk delete
      .addCase(bulkDeleteContacts.pending, (state) => {
        state.loadingState['bulkDelete'] = LoadingState.LOADING;
      })
      .addCase(bulkDeleteContacts.fulfilled, (state, action) => {
        state.contacts = state.contacts.filter(
          contact => !action.payload.contactIds.includes(contact.id)
        );
        state.selectedContacts = [];
        state.loadingState['bulkDelete'] = LoadingState.SUCCESS;
      })
      .addCase(bulkDeleteContacts.rejected, (state, action) => {
        state.loadingState['bulkDelete'] = LoadingState.ERROR;
        state.error['bulkDelete'] = action.payload as ApiError;
      })
      // Import contacts
      .addCase(importContacts.pending, (state) => {
        state.loadingState['import'] = LoadingState.LOADING;
      })
      .addCase(importContacts.fulfilled, (state) => {
        state.loadingState['import'] = LoadingState.SUCCESS;
      })
      .addCase(importContacts.rejected, (state, action) => {
        state.loadingState['import'] = LoadingState.ERROR;
        state.error['import'] = action.payload as ApiError;
      })
      // Search contacts
      .addCase(searchContacts.pending, (state) => {
        state.loadingState['search'] = LoadingState.LOADING;
      })
      .addCase(searchContacts.fulfilled, (state, action) => {
        state.contacts = action.payload.items;
        state.pagination.total = action.payload.total;
        state.loadingState['search'] = LoadingState.SUCCESS;
      })
      .addCase(searchContacts.rejected, (state, action) => {
        state.loadingState['search'] = LoadingState.ERROR;
        state.error['search'] = action.payload as ApiError;
      });
  }
});

// Selectors
export const selectContacts = (state: { contacts: ContactsState }) => state.contacts.contacts;
export const selectSelectedContacts = (state: { contacts: ContactsState }) => state.contacts.selectedContacts;
export const selectLoadingState = (state: { contacts: ContactsState }, operation: string) => 
  state.contacts.loadingState[operation];
export const selectError = (state: { contacts: ContactsState }, operation: string) => 
  state.contacts.error[operation];
export const selectPagination = (state: { contacts: ContactsState }) => state.contacts.pagination;
export const selectFilters = (state: { contacts: ContactsState }) => state.contacts.filters;

// Memoized selectors
export const selectFilteredContacts = createSelector(
  [selectContacts, selectFilters],
  (contacts, filters) => {
    return contacts.filter(contact => {
      const matchesTags = filters.tags.length === 0 || 
        filters.tags.some(tag => contact.tags.includes(tag));
      const matchesGroups = filters.groupIds.length === 0 || 
        filters.groupIds.some(groupId => contact.groupIds.includes(groupId));
      const matchesConsent = filters.consentStatus === undefined || 
        contact.consentStatus === filters.consentStatus;
      
      return matchesTags && matchesGroups && matchesConsent;
    });
  }
);

export const { 
  setSelectedContacts, 
  updateFilters, 
  resetFilters,
  addOptimisticUpdate,
  removeOptimisticUpdate
} = contactsSlice.actions;

export default contactsSlice.reducer;