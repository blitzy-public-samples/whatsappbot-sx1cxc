// @package react ^18.2.0
// @package react-redux ^8.1.0
// @package use-debounce ^9.0.0

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDebounce } from 'use-debounce';
import {
  Contact,
  ContactGroup,
  ContactFormData,
  ContactFilter
} from '../../types/contacts';
import {
  fetchContacts,
  bulkDeleteContacts,
  importContacts,
  exportContacts,
  searchContacts,
  setSelectedContacts,
  updateFilters,
  resetFilters,
  addOptimisticUpdate,
  removeOptimisticUpdate,
  selectContacts,
  selectSelectedContacts,
  selectLoadingState,
  selectError,
  selectPagination,
  selectFilters,
  selectFilteredContacts
} from '../../store/slices/contactsSlice';
import { LoadingState } from '../../types/common';
import { contactsApi, debouncedContactSearch } from '../../services/api/contacts';

/**
 * Enhanced custom hook for managing contacts with advanced features
 * @param options Hook configuration options
 * @returns Object containing contacts state and management functions
 */
export const useContacts = ({
  initialPage = 0,
  pageSize = 20,
  search = '',
  filters = {},
  groupId = '',
  enableRealtime = false
}: {
  initialPage?: number;
  pageSize?: number;
  search?: string;
  filters?: ContactFilter;
  groupId?: string;
  enableRealtime?: boolean;
} = {}) => {
  // Redux hooks
  const dispatch = useDispatch();
  const contacts = useSelector(selectFilteredContacts);
  const selectedContacts = useSelector(selectSelectedContacts);
  const pagination = useSelector(selectPagination);
  const currentFilters = useSelector(selectFilters);

  // Local state
  const [debouncedSearch] = useDebounce(search, 300);
  const [localLoadingState, setLocalLoadingState] = useState<Record<string, LoadingState>>({});
  const [localError, setLocalError] = useState<Record<string, string | null>>({});
  const wsRef = useRef<WebSocket | null>(null);

  /**
   * Initializes WebSocket connection for real-time updates
   */
  const initializeWebSocket = useCallback(() => {
    if (!enableRealtime) return;

    const ws = new WebSocket(process.env.VITE_WS_URL || 'ws://localhost:3000/ws');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'CONTACT_UPDATED':
          dispatch(addOptimisticUpdate(data.payload));
          break;
        case 'CONTACT_DELETED':
          dispatch(setSelectedContacts(
            selectedContacts.filter(id => id !== data.payload.id)
          ));
          break;
        // Add more real-time event handlers as needed
      }
    };

    ws.onerror = (error) => {
      setLocalError(prev => ({
        ...prev,
        websocket: 'WebSocket connection error'
      }));
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [enableRealtime, dispatch, selectedContacts]);

  /**
   * Fetches contacts with error handling and retry logic
   */
  const fetchContactsWithRetry = useCallback(async (
    retryCount = 0,
    maxRetries = 3
  ) => {
    try {
      setLocalLoadingState(prev => ({
        ...prev,
        fetch: LoadingState.LOADING
      }));

      await dispatch(fetchContacts({
        page: initialPage,
        pageSize,
        search: debouncedSearch,
        filters: { ...currentFilters, ...filters },
        groupId
      })).unwrap();

      setLocalLoadingState(prev => ({
        ...prev,
        fetch: LoadingState.SUCCESS
      }));
    } catch (error) {
      if (retryCount < maxRetries) {
        setTimeout(() => {
          fetchContactsWithRetry(retryCount + 1, maxRetries);
        }, Math.pow(2, retryCount) * 1000);
      } else {
        setLocalLoadingState(prev => ({
          ...prev,
          fetch: LoadingState.ERROR
        }));
        setLocalError(prev => ({
          ...prev,
          fetch: 'Failed to fetch contacts'
        }));
      }
    }
  }, [dispatch, initialPage, pageSize, debouncedSearch, currentFilters, filters, groupId]);

  /**
   * Creates a new contact with optimistic updates
   */
  const createContact = useCallback(async (data: ContactFormData) => {
    const optimisticId = `temp-${Date.now()}`;
    const optimisticContact = {
      id: optimisticId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as Contact;

    try {
      dispatch(addOptimisticUpdate(optimisticContact));
      const response = await contactsApi.createContact(data);
      dispatch(removeOptimisticUpdate(optimisticId));
      return response;
    } catch (error) {
      dispatch(removeOptimisticUpdate(optimisticId));
      throw error;
    }
  }, [dispatch]);

  /**
   * Updates an existing contact with optimistic updates
   */
  const updateContact = useCallback(async (
    id: string,
    data: Partial<ContactFormData>
  ) => {
    const existingContact = contacts.find(c => c.id === id);
    if (!existingContact) return;

    const optimisticContact = {
      ...existingContact,
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      dispatch(addOptimisticUpdate(optimisticContact));
      const response = await contactsApi.updateContact(id, data);
      dispatch(removeOptimisticUpdate(id));
      return response;
    } catch (error) {
      dispatch(removeOptimisticUpdate(id));
      throw error;
    }
  }, [dispatch, contacts]);

  /**
   * Deletes contacts with optimistic updates
   */
  const deleteContacts = useCallback(async (ids: string[]) => {
    try {
      dispatch(setSelectedContacts(
        selectedContacts.filter(id => !ids.includes(id))
      ));
      await dispatch(bulkDeleteContacts(ids)).unwrap();
    } catch (error) {
      // Revert optimistic update on error
      dispatch(setSelectedContacts(selectedContacts));
      throw error;
    }
  }, [dispatch, selectedContacts]);

  // Effect for initializing WebSocket connection
  useEffect(() => {
    const cleanup = initializeWebSocket();
    return () => {
      cleanup?.();
    };
  }, [initializeWebSocket]);

  // Effect for fetching contacts on parameter changes
  useEffect(() => {
    fetchContactsWithRetry();
  }, [fetchContactsWithRetry]);

  // Effect for handling search
  useEffect(() => {
    if (debouncedSearch) {
      dispatch(searchContacts(debouncedSearch));
    }
  }, [debouncedSearch, dispatch]);

  return {
    // State
    contacts,
    selectedContacts,
    loadingState: { ...localLoadingState },
    error: { ...localError },
    pagination,
    filters: currentFilters,

    // Actions
    actions: {
      fetchContacts: fetchContactsWithRetry,
      createContact,
      updateContact,
      deleteContacts,
      selectContacts: (ids: string[]) => dispatch(setSelectedContacts(ids)),
      updateFilters: (newFilters: Partial<ContactFilter>) => 
        dispatch(updateFilters(newFilters)),
      resetFilters: () => dispatch(resetFilters()),
      importContacts: (file: File) => dispatch(importContacts(file)),
      exportContacts: (format: 'csv' | 'xlsx' | 'json') => 
        dispatch(exportContacts(format))
    }
  };
};