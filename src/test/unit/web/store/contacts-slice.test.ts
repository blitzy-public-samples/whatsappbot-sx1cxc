// @package @jest/globals ^29.0.0
// @package @reduxjs/toolkit 1.9.x

import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import {
  reducer as contactsReducer,
  actions,
  selectors,
  thunks,
} from '../../../../web/src/store/slices/contactsSlice';
import { Contact } from '../../../../web/src/types/contacts';
import { MockContactManager } from '../../../mocks/contact-service';
import { TestDataGenerator } from '../../../utils/test-data-generator';
import { LoadingState } from '../../../../web/src/types/common';

describe('contactsSlice', () => {
  let store: ReturnType<typeof configureStore>;
  let mockContactManager: MockContactManager;
  let testDataGenerator: TestDataGenerator;

  beforeEach(() => {
    // Initialize test dependencies
    mockContactManager = new MockContactManager();
    testDataGenerator = new TestDataGenerator();

    // Configure test store
    store = configureStore({
      reducer: {
        contacts: contactsReducer
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await mockContactManager.resetMockData();
  });

  describe('Selectors', () => {
    it('should select contacts from state', () => {
      const testContact = testDataGenerator.generateContact();
      store.dispatch(actions.setContacts([testContact]));

      const contacts = selectors.selectContacts(store.getState());
      expect(contacts).toHaveLength(1);
      expect(contacts[0].id).toBe(testContact.id);
    });

    it('should select filtered contacts based on current filters', () => {
      const contacts = [
        testDataGenerator.generateContact({ tags: ['vip'] }),
        testDataGenerator.generateContact({ tags: ['standard'] })
      ];
      store.dispatch(actions.setContacts(contacts));
      store.dispatch(actions.updateFilters({ tags: ['vip'] }));

      const filteredContacts = selectors.selectFilteredContacts(store.getState());
      expect(filteredContacts).toHaveLength(1);
      expect(filteredContacts[0].tags).toContain('vip');
    });

    it('should select loading state for specific operations', () => {
      store.dispatch(thunks.fetchContacts.pending('', { page: 0, pageSize: 10 }));
      
      const loadingState = selectors.selectLoadingState(store.getState(), 'fetch');
      expect(loadingState).toBe(LoadingState.LOADING);
    });
  });

  describe('Actions', () => {
    it('should handle setSelectedContacts', () => {
      const contactIds = ['1', '2', '3'];
      store.dispatch(actions.setSelectedContacts(contactIds));

      const selectedContacts = selectors.selectSelectedContacts(store.getState());
      expect(selectedContacts).toEqual(contactIds);
    });

    it('should handle updateFilters', () => {
      const filters = {
        tags: ['vip'],
        groupIds: ['group1'],
        dateRange: {
          start: '2023-01-01',
          end: '2023-12-31'
        }
      };

      store.dispatch(actions.updateFilters(filters));
      const currentFilters = selectors.selectFilters(store.getState());
      expect(currentFilters).toMatchObject(filters);
    });

    it('should handle resetFilters', () => {
      // First set some filters
      store.dispatch(actions.updateFilters({
        tags: ['vip'],
        groupIds: ['group1']
      }));

      // Then reset them
      store.dispatch(actions.resetFilters());
      const filters = selectors.selectFilters(store.getState());
      
      expect(filters.tags).toHaveLength(0);
      expect(filters.groupIds).toHaveLength(0);
    });
  });

  describe('Thunks', () => {
    it('should handle fetchContacts.fulfilled', async () => {
      const testContacts = await testDataGenerator.generateBulk<Contact>('contact', 5);
      mockContactManager.getContacts.mockResolvedValue({
        items: testContacts,
        total: testContacts.length,
        page: 0,
        pageSize: 10
      });

      await store.dispatch(thunks.fetchContacts({ page: 0, pageSize: 10 }));

      const contacts = selectors.selectContacts(store.getState());
      const loadingState = selectors.selectLoadingState(store.getState(), 'fetch');

      expect(contacts).toHaveLength(5);
      expect(loadingState).toBe(LoadingState.SUCCESS);
    });

    it('should handle fetchContacts.rejected', async () => {
      const error = new Error('Network error');
      mockContactManager.getContacts.mockRejectedValue(error);

      await store.dispatch(thunks.fetchContacts({ page: 0, pageSize: 10 }));

      const loadingState = selectors.selectLoadingState(store.getState(), 'fetch');
      const apiError = selectors.selectError(store.getState(), 'fetch');

      expect(loadingState).toBe(LoadingState.ERROR);
      expect(apiError).toBeTruthy();
    });

    it('should handle bulkDeleteContacts.fulfilled', async () => {
      const testContacts = await testDataGenerator.generateBulk<Contact>('contact', 3);
      store.dispatch(actions.setContacts(testContacts));

      const contactIds = testContacts.map(c => c.id);
      mockContactManager.bulkDelete.mockResolvedValue({ successful: contactIds.length });

      await store.dispatch(thunks.bulkDeleteContacts(contactIds));

      const remainingContacts = selectors.selectContacts(store.getState());
      const selectedContacts = selectors.selectSelectedContacts(store.getState());

      expect(remainingContacts).toHaveLength(0);
      expect(selectedContacts).toHaveLength(0);
    });

    it('should handle importContacts.fulfilled', async () => {
      const file = new File(['test data'], 'contacts.csv', { type: 'text/csv' });
      const importResponse = {
        successful: 5,
        failed: 0,
        failedIds: [],
        errors: {}
      };

      mockContactManager.bulkCreate.mockResolvedValue(importResponse);

      await store.dispatch(thunks.importContacts(file));

      const loadingState = selectors.selectLoadingState(store.getState(), 'import');
      expect(loadingState).toBe(LoadingState.SUCCESS);
    });

    it('should handle searchContacts with debouncing', async () => {
      jest.useFakeTimers();
      
      const searchResults = await testDataGenerator.generateBulk<Contact>('contact', 2);
      mockContactManager.searchContacts.mockResolvedValue({
        items: searchResults,
        total: searchResults.length,
        page: 0,
        pageSize: 10
      });

      store.dispatch(thunks.searchContacts('test query'));
      
      // Fast-forward debounce timeout
      jest.advanceTimersByTime(300);

      const contacts = selectors.selectContacts(store.getState());
      expect(contacts).toHaveLength(2);

      jest.useRealTimers();
    });
  });

  describe('Optimistic Updates', () => {
    it('should handle optimistic contact updates', () => {
      const contact = testDataGenerator.generateContact();
      store.dispatch(actions.addOptimisticUpdate(contact));

      const state = store.getState().contacts;
      expect(state.optimisticUpdates[contact.id]).toEqual(contact);
    });

    it('should remove optimistic updates after confirmation', () => {
      const contact = testDataGenerator.generateContact();
      
      // Add optimistic update
      store.dispatch(actions.addOptimisticUpdate(contact));
      
      // Remove it
      store.dispatch(actions.removeOptimisticUpdate(contact.id));

      const state = store.getState().contacts;
      expect(state.optimisticUpdates[contact.id]).toBeUndefined();
    });
  });
});