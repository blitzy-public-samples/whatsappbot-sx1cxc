import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, beforeEach, afterEach } from 'vitest';
import { axe } from '@axe-core/react';
import { WebSocket, Server } from 'mock-socket';

import { ContactList } from '../../../../web/src/components/contacts/ContactList';
import { TestDataGenerator } from '../../../utils/test-data-generator';
import { Contact } from '../../../../web/src/types/contacts';
import { LoadingState } from '../../../../web/src/types/common';

// Mock WebSocket
global.WebSocket = WebSocket as any;

// Constants for testing
const MOCK_WEBSOCKET_URL = 'ws://localhost:1234';
const TEST_TIMEOUT = 5000;
const VIEWPORT_SIZES = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 }
};

describe('ContactList Component', () => {
  let mockServer: Server;
  let testDataGenerator: TestDataGenerator;
  let mockContacts: Contact[];
  let mockOnSelect: vi.Mock;
  let mockOnDelete: vi.Mock;

  beforeEach(() => {
    // Initialize WebSocket mock server
    mockServer = new Server(MOCK_WEBSOCKET_URL);
    
    // Initialize test data generator
    testDataGenerator = new TestDataGenerator();
    
    // Generate mock contacts
    mockContacts = testDataGenerator.generateBulk('contact', 25);
    
    // Initialize mock handlers
    mockOnSelect = vi.fn();
    mockOnDelete = vi.fn();

    // Reset viewport
    window.innerWidth = VIEWPORT_SIZES.desktop.width;
    window.innerHeight = VIEWPORT_SIZES.desktop.height;
  });

  afterEach(() => {
    mockServer.close();
    vi.clearAllMocks();
  });

  it('should render contact list with data correctly', async () => {
    render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.SUCCESS}
        />
      </ThemeProvider>
    );

    // Verify table headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Phone Number')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Last Contacted')).toBeInTheDocument();

    // Verify contact data
    mockContacts.slice(0, 10).forEach(contact => {
      expect(screen.getByText(`${contact.firstName} ${contact.lastName}`)).toBeInTheDocument();
      expect(screen.getByText(contact.phoneNumber)).toBeInTheDocument();
      expect(screen.getByText(contact.email)).toBeInTheDocument();
    });
  });

  it('should handle search functionality correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.SUCCESS}
        />
      </ThemeProvider>
    );

    const searchInput = screen.getByPlaceholderText('Search contacts...');
    await user.type(searchInput, mockContacts[0].firstName);

    await waitFor(() => {
      expect(screen.getByText(`${mockContacts[0].firstName} ${mockContacts[0].lastName}`)).toBeInTheDocument();
    });
  });

  it('should handle bulk selection and actions correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.SUCCESS}
        />
      </ThemeProvider>
    );

    // Select all contacts
    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
    await user.click(selectAllCheckbox);

    // Verify bulk action bar appears
    expect(screen.getByText(/contacts selected/i)).toBeInTheDocument();
    expect(screen.getByText(/delete selected/i)).toBeInTheDocument();

    // Perform bulk delete
    const deleteButton = screen.getByText(/delete selected/i);
    await user.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalled();
  });

  it('should handle real-time updates via WebSocket', async () => {
    render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.SUCCESS}
        />
      </ThemeProvider>
    );

    // Simulate WebSocket message for contact update
    const updatedContact = { ...mockContacts[0], firstName: 'Updated' };
    mockServer.emit('message', JSON.stringify({
      type: 'CONTACT_UPDATE',
      payload: updatedContact
    }));

    await waitFor(() => {
      expect(screen.getByText(`Updated ${updatedContact.lastName}`)).toBeInTheDocument();
    });
  });

  it('should be accessible', async () => {
    const { container } = render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.SUCCESS}
        />
      </ThemeProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle responsive layout correctly', async () => {
    const { rerender } = render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.SUCCESS}
        />
      </ThemeProvider>
    );

    // Test mobile layout
    window.innerWidth = VIEWPORT_SIZES.mobile.width;
    window.innerHeight = VIEWPORT_SIZES.mobile.height;
    fireEvent(window, new Event('resize'));
    rerender(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.SUCCESS}
        />
      </ThemeProvider>
    );

    // Verify mobile-specific elements
    expect(screen.getByRole('table')).toHaveStyle({ width: '100%' });
  });

  it('should handle loading states correctly', () => {
    render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={[]}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.LOADING}
        />
      </ThemeProvider>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should handle error states correctly', () => {
    render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={[]}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.ERROR}
          error="Failed to load contacts"
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Failed to load contacts')).toBeInTheDocument();
  });

  it('should handle sorting functionality correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.SUCCESS}
        />
      </ThemeProvider>
    );

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    // Verify sort indicator appears
    expect(nameHeader).toHaveAttribute('aria-sort');
  });

  it('should handle keyboard navigation correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeProvider theme={{}}>
        <ContactList
          contacts={mockContacts}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          loadingState={LoadingState.SUCCESS}
        />
      </ThemeProvider>
    );

    // Focus first row
    const firstRow = screen.getAllByRole('row')[1];
    firstRow.focus();

    // Navigate with arrow keys
    await user.keyboard('[ArrowDown]');
    expect(screen.getAllByRole('row')[2]).toHaveFocus();

    await user.keyboard('[Space]');
    expect(mockOnSelect).toHaveBeenCalled();
  });
});