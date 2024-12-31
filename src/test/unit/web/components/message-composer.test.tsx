// @version React ^18.2.0
// @version @testing-library/react ^14.0.0
// @version @testing-library/user-event ^14.0.0
// @version @jest/globals ^29.0.0
// @version jest-axe ^8.0.0

import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MessageComposer } from '../../../../web/src/components/messages/MessageComposer';
import { useMessages } from '../../../../web/src/hooks/useMessages';
import { useTemplates } from '../../../../web/src/hooks/useTemplates';
import { MessageType, MessageStatus } from '../../../../web/src/types/messages';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock hooks
jest.mock('../../../../web/src/hooks/useMessages');
jest.mock('../../../../web/src/hooks/useTemplates');

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('MessageComposer', () => {
  // Setup test data
  const mockTemplates = [
    { id: '1', name: 'Welcome Template', content: 'Welcome {name}!' },
    { id: '2', name: 'Support Template', content: 'How can we help {name}?' }
  ];

  const mockMessage = {
    id: '123',
    type: MessageType.TEXT,
    content: { text: 'Test message' },
    status: MessageStatus.SENT
  };

  // Setup mock functions
  const mockSendMessage = jest.fn();
  const mockScheduleMessage = jest.fn();
  const mockValidateMessage = jest.fn();
  const mockLoadTemplates = jest.fn();
  const mockSelectTemplate = jest.fn();
  const mockValidateTemplate = jest.fn();

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock useMessages hook
    (useMessages as jest.Mock).mockReturnValue({
      sendMessageWithRetry: mockSendMessage,
      scheduleMessage: mockScheduleMessage,
      validateMessage: mockValidateMessage,
      loading: false,
      error: null
    });

    // Mock useTemplates hook
    (useTemplates as jest.Mock).mockReturnValue({
      templates: mockTemplates,
      loadTemplates: mockLoadTemplates,
      selectTemplate: mockSelectTemplate,
      validateTemplate: mockValidateTemplate,
      selectedTemplate: null,
      error: null
    });
  });

  describe('Template Management', () => {
    it('should load and display available templates', async () => {
      render(<MessageComposer />);

      const templateSelect = screen.getByLabelText(/template/i);
      expect(templateSelect).toBeInTheDocument();

      mockTemplates.forEach(template => {
        expect(screen.getByText(template.name)).toBeInTheDocument();
      });
    });

    it('should handle template selection', async () => {
      render(<MessageComposer />);
      
      const templateSelect = screen.getByLabelText(/template/i);
      await userEvent.click(templateSelect);
      await userEvent.click(screen.getByText(mockTemplates[0].name));

      expect(mockSelectTemplate).toHaveBeenCalledWith(mockTemplates[0].id);
    });

    it('should validate template variables', async () => {
      const template = mockTemplates[0];
      (useTemplates as jest.Mock).mockReturnValue({
        ...useTemplates(),
        selectedTemplate: template
      });

      render(<MessageComposer />);
      
      const messageField = screen.getByLabelText(/message/i);
      expect(messageField).toBeDisabled();
      expect(messageField).toHaveValue(template.content);
    });
  });

  describe('Recipient Management', () => {
    it('should handle single recipient input', async () => {
      render(<MessageComposer />);
      
      const recipientField = screen.getByLabelText(/recipients/i);
      await userEvent.type(recipientField, '+1234567890');

      expect(recipientField).toHaveValue('+1234567890');
    });

    it('should handle multiple recipients', async () => {
      render(<MessageComposer />);
      
      const recipientField = screen.getByLabelText(/recipients/i);
      await userEvent.type(recipientField, '+1234567890, +9876543210');

      expect(recipientField).toHaveValue('+1234567890, +9876543210');
    });

    it('should validate recipient format', async () => {
      render(<MessageComposer />);
      
      const recipientField = screen.getByLabelText(/recipients/i);
      await userEvent.type(recipientField, 'invalid');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await userEvent.click(sendButton);

      expect(screen.getByText(/at least one recipient is required/i)).toBeInTheDocument();
    });
  });

  describe('Message Composition', () => {
    it('should handle text message input', async () => {
      render(<MessageComposer />);
      
      const messageField = screen.getByLabelText(/message/i);
      await userEvent.type(messageField, 'Test message content');

      expect(messageField).toHaveValue('Test message content');
    });

    it('should validate message content', async () => {
      render(<MessageComposer />);
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await userEvent.click(sendButton);

      expect(screen.getByText(/message content is required/i)).toBeInTheDocument();
    });

    it('should handle file attachments', async () => {
      render(<MessageComposer />);
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const attachButton = screen.getByRole('button', { name: /add attachments/i });
      const fileInput = screen.getByTestId('file-input');

      await userEvent.upload(fileInput, file);

      expect(screen.getByText('test.jpg')).toBeInTheDocument();
    });
  });

  describe('Message Scheduling', () => {
    it('should handle schedule selection', async () => {
      render(<MessageComposer />);
      
      const scheduleCheckbox = screen.getByRole('checkbox', { name: /schedule message/i });
      await userEvent.click(scheduleCheckbox);

      expect(screen.getByLabelText(/schedule time/i)).toBeInTheDocument();
    });

    it('should validate schedule time', async () => {
      render(<MessageComposer />);
      
      const scheduleCheckbox = screen.getByRole('checkbox', { name: /schedule message/i });
      await userEvent.click(scheduleCheckbox);

      const sendButton = screen.getByRole('button', { name: /schedule/i });
      await userEvent.click(sendButton);

      expect(screen.getByText(/schedule time is required/i)).toBeInTheDocument();
    });
  });

  describe('Message Submission', () => {
    it('should handle immediate message sending', async () => {
      render(<MessageComposer />);
      
      await userEvent.type(screen.getByLabelText(/recipients/i), '+1234567890');
      await userEvent.type(screen.getByLabelText(/message/i), 'Test message');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await userEvent.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should handle scheduled message sending', async () => {
      render(<MessageComposer />);
      
      await userEvent.type(screen.getByLabelText(/recipients/i), '+1234567890');
      await userEvent.type(screen.getByLabelText(/message/i), 'Test message');
      
      const scheduleCheckbox = screen.getByRole('checkbox', { name: /schedule message/i });
      await userEvent.click(scheduleCheckbox);

      // Set future date
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      
      const dateTimePicker = screen.getByLabelText(/schedule time/i);
      await userEvent.type(dateTimePicker, futureDate.toISOString());

      const scheduleButton = screen.getByRole('button', { name: /schedule/i });
      await userEvent.click(scheduleButton);

      expect(mockScheduleMessage).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<MessageComposer />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      render(<MessageComposer />);
      
      const firstInput = screen.getByLabelText(/template/i);
      firstInput.focus();

      await userEvent.tab();
      expect(screen.getByLabelText(/recipients/i)).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByLabelText(/message/i)).toHaveFocus();
    });

    it('should announce validation errors to screen readers', async () => {
      render(<MessageComposer />);
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await userEvent.click(sendButton);

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should display API errors', async () => {
      const errorMessage = 'Failed to send message';
      (useMessages as jest.Mock).mockReturnValue({
        ...useMessages(),
        error: errorMessage
      });

      render(<MessageComposer />);
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should handle template validation errors', async () => {
      const errorMessage = 'Invalid template';
      (useTemplates as jest.Mock).mockReturnValue({
        ...useTemplates(),
        error: errorMessage
      });

      render(<MessageComposer />);
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});