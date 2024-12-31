// External dependencies
import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { Provider } from 'react-redux'; // v8.1.0
import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { jest } from '@jest/globals'; // v29.0.0
import WS from 'jest-websocket-mock'; // v3.0.0

// Internal dependencies
import { useContacts } from '../../../../web/src/hooks/useContacts';
import { TestDataGenerator } from '../../../utils/test-data-generator';
import { contactsActions } from '../../../../web/src/store/slices/contactsSlice';
import { Contact, ContactFormData } from '../../../../web/src/types/contacts';
import { LoadingState } from '../../../../web/src/types/common';

describe('useContacts Hook', () => {
  // Test environment setup
  let mockStore: ReturnType<typeof configureStore>;
  let mockWebSocket: WS;
  let testDataGenerator: TestDataGenerator;
  let cleanupFunctions: Array<() => void> = [];

  beforeAll(() => {
    // Initialize WebSocket mock server
    mockWebSocket = new WS('ws://localhost:3000/ws');
  });

  beforeEach(() => {
    // Create fresh test data generator
    testDataGenerator = new TestDataGenerator();

    // Configure mock store
    mockStore = configureStore({
      reducer: {
        contacts: contactsActions
      }
    });

    // Wrap component with store provider
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>
        {children}
      </Provider>
    );

    // Store cleanup function
    cleanupFunctions.push(() => {
      mockStore.dispatch({ type: 'RESET_STATE' });
    });
  });

  afterEach(() => {
    // Clean up after each test
    cleanupFunctions.forEach(cleanup => cleanup());
    cleanupFunctions = [];
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Clean up WebSocket mock
    mockWebSocket.close();
  });

  describe('Initial Loading', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useContacts(), {
        wrapper: Provider({ store: mockStore })
      });

      expect(result.current.contacts).toEqual([]);
      expect(result.current.selectedContacts).toEqual([]);
      expect(result.current.loadingState).toEqual({});
      expect(result.current.error).toEqual({});
      expect(result.current.pagination).toBeDefined();
      expect(result.current.filters).toBeDefined();
    });

    it('should fetch contacts on mount', async () => {
      const mockContacts = testDataGenerator.generateBulkContacts(10);
      const fetchSpy = jest.spyOn(contactsActions, 'fetchContacts');

      const { result, waitForNextUpdate } = renderHook(() => useContacts(), {
        wrapper: Provider({ store: mockStore })
      });

      expect(result.current.loadingState.fetch).toBe(LoadingState.LOADING);
      
      await waitForNextUpdate();

      expect(fetchSpy).toHaveBeenCalledWith({
        page: 0,
        pageSize: 20,
        search: '',
        filters: {}
      });
      expect(result.current.loadingState.fetch).toBe(LoadingState.SUCCESS);
    });
  });

  describe('Contact CRUD Operations', () => {
    it('should create contact with optimistic update', async () => {
      const newContact: ContactFormData = {
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+1234567890',
        email: 'john@example.com',
        tags: ['VIP'],
        groupIds: []
      };

      const { result } = renderHook(() => useContacts(), {
        wrapper: Provider({ store: mockStore })
      });

      await act(async () => {
        await result.current.actions.createContact(newContact);
      });

      expect(result.current.contacts).toContainEqual(
        expect.objectContaining({
          firstName: newContact.firstName,
          lastName: newContact.lastName
        })
      );
    });

    it('should update contact with optimistic update', async () => {
      const existingContact = testDataGenerator.generateContact();
      const updateData = {
        firstName: 'Updated Name',
        tags: ['New Tag']
      };

      const { result } = renderHook(() => useContacts(), {
        wrapper: Provider({ store: mockStore })
      });

      await act(async () => {
        await result.current.actions.updateContact(existingContact.id, updateData);
      });

      const updatedContact = result.current.contacts.find(
        c => c.id === existingContact.id
      );
      expect(updatedContact).toMatchObject(updateData);
    });

    it('should delete contacts with confirmation', async () => {
      const contactsToDelete = testDataGenerator.generateBulkContacts(3);
      const contactIds = contactsToDelete.map(c => c.id);

      const { result } = renderHook(() => useContacts(), {
        wrapper: Provider({ store: mockStore })
      });

      await act(async () => {
        await result.current.actions.deleteContacts(contactIds);
      });

      expect(result.current.contacts).not.toEqual(
        expect.arrayContaining(contactsToDelete)
      );
      expect(result.current.selectedContacts).not.toEqual(
        expect.arrayContaining(contactIds)
      );
    });
  });

  describe('Real-time Updates', () => {
    it('should handle WebSocket connection and updates', async () => {
      const { result } = renderHook(() => useContacts({ enableRealtime: true }), {
        wrapper: Provider({ store: mockStore })
      });

      // Simulate WebSocket connection
      await mockWebSocket.connected;

      // Simulate contact update event
      const updatedContact = testDataGenerator.generateContact();
      await act(async () => {
        mockWebSocket.send(JSON.stringify({
          type: 'CONTACT_UPDATED',
          payload: updatedContact
        }));
      });

      expect(result.current.contacts).toContainEqual(updatedContact);
    });

    it('should handle WebSocket reconnection', async () => {
      const { result } = renderHook(() => useContacts({ enableRealtime: true }), {
        wrapper: Provider({ store: mockStore })
      });

      await mockWebSocket.connected;
      mockWebSocket.close();

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(result.current.error.websocket).toBe('WebSocket connection error');
    });
  });

  describe('Filtering and Pagination', () => {
    it('should handle search with debouncing', async () => {
      const { result } = renderHook(() => useContacts({ search: 'John' }), {
        wrapper: Provider({ store: mockStore })
      });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(result.current.loadingState.search).toBe(LoadingState.LOADING);
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      expect(result.current.loadingState.search).toBe(LoadingState.SUCCESS);
    });

    it('should apply and clear filters', async () => {
      const { result } = renderHook(() => useContacts(), {
        wrapper: Provider({ store: mockStore })
      });

      await act(async () => {
        result.current.actions.updateFilters({
          tags: ['VIP'],
          groupIds: ['group1']
        });
      });

      expect(result.current.filters).toEqual({
        tags: ['VIP'],
        groupIds: ['group1']
      });

      await act(async () => {
        result.current.actions.resetFilters();
      });

      expect(result.current.filters).toEqual({
        tags: [],
        groupIds: []
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures with retry', async () => {
      const fetchError = new Error('Network error');
      jest.spyOn(contactsActions, 'fetchContacts').mockRejectedValueOnce(fetchError);

      const { result, waitForNextUpdate } = renderHook(() => useContacts(), {
        wrapper: Provider({ store: mockStore })
      });

      await waitForNextUpdate();

      expect(result.current.error.fetch).toBe('Failed to fetch contacts');
      expect(result.current.loadingState.fetch).toBe(LoadingState.ERROR);
    });

    it('should handle validation errors', async () => {
      const invalidContact: ContactFormData = {
        firstName: '',
        lastName: '',
        phoneNumber: 'invalid',
        email: 'invalid',
        tags: [],
        groupIds: []
      };

      const { result } = renderHook(() => useContacts(), {
        wrapper: Provider({ store: mockStore })
      });

      await act(async () => {
        try {
          await result.current.actions.createContact(invalidContact);
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = testDataGenerator.generateBulkContacts(1000);
      
      const { result, waitForNextUpdate } = renderHook(() => useContacts(), {
        wrapper: Provider({ store: mockStore })
      });

      const startTime = performance.now();
      await waitForNextUpdate();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should render within 1 second
      expect(result.current.contacts.length).toBe(1000);
    });

    it('should cleanup subscriptions on unmount', () => {
      const { unmount } = renderHook(() => useContacts({ enableRealtime: true }), {
        wrapper: Provider({ store: mockStore })
      });

      unmount();

      expect(mockWebSocket.server.clients().length).toBe(0);
    });
  });
});