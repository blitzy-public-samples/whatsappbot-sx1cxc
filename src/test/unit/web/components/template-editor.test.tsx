// @version react ^18.2.0
// @version @testing-library/react ^14.0.0
// @version @testing-library/user-event ^14.0.0
// @version @jest/globals ^29.0.0
// @version @axe-core/react ^4.7.3

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import TemplateEditor from '../../../../web/src/components/templates/TemplateEditor';
import { Template, TemplateVariable, VariableType } from '../../../../web/src/types/templates';
import { LoadingState } from '../../../../web/src/types/common';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock hooks and dependencies
jest.mock('../../../../web/src/hooks/useTemplates', () => ({
  useTemplates: () => ({
    validateTemplate: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
    previewTemplate: jest.fn(),
    loadingState: LoadingState.IDLE
  })
}));

// Test utilities and helpers
const renderTemplateEditor = async (props: {
  template?: Template | null;
  onSave?: jest.Mock;
  onCancel?: jest.Mock;
  testId?: string;
}) => {
  const user = userEvent.setup();
  const defaultProps = {
    template: null,
    onSave: jest.fn(),
    onCancel: jest.fn(),
    testId: 'template-editor',
    ...props
  };

  const utils = render(<TemplateEditor {...defaultProps} />);
  const results = await axe(utils.container);

  return {
    ...utils,
    user,
    axeResults: results
  };
};

const mockTemplate = (overrides: Partial<Template> = {}): Template => ({
  id: 'test-id',
  name: 'Test Template',
  content: 'Hello {firstName}',
  variables: [{
    name: 'firstName',
    type: VariableType.TEXT,
    required: true,
    defaultValue: null,
    validation: null
  }],
  organizationId: 'org-id',
  createdBy: 'user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true,
  ...overrides
});

describe('TemplateEditor Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Rendering and Initialization', () => {
    it('should render empty editor with proper ARIA labels', async () => {
      const { axeResults } = await renderTemplateEditor({});
      
      expect(axeResults).toHaveNoViolations();
      expect(screen.getByRole('region', { name: /template editor/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /template name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /template content editor/i })).toBeInTheDocument();
    });

    it('should initialize with template data when provided', async () => {
      const template = mockTemplate();
      const { axeResults } = await renderTemplateEditor({ template });

      expect(axeResults).toHaveNoViolations();
      expect(screen.getByDisplayValue(template.name)).toBeInTheDocument();
      expect(screen.getByText(template.content)).toBeInTheDocument();
    });
  });

  describe('Accessibility Compliance', () => {
    it('should support keyboard navigation', async () => {
      const { user } = await renderTemplateEditor({});
      
      await user.tab();
      expect(screen.getByRole('textbox', { name: /template name/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('textbox', { name: /template content editor/i })).toHaveFocus();
    });

    it('should announce validation errors to screen readers', async () => {
      const { user } = await renderTemplateEditor({});
      
      await user.click(screen.getByRole('button', { name: /save template/i }));
      
      expect(screen.getByRole('alert')).toHaveTextContent(/template name is required/i);
    });

    it('should maintain focus management during template editing', async () => {
      const { user } = await renderTemplateEditor({});
      const nameInput = screen.getByRole('textbox', { name: /template name/i });
      
      await user.click(nameInput);
      await user.keyboard('Test Template');
      
      expect(nameInput).toHaveValue('Test Template');
      expect(nameInput).toHaveFocus();
    });
  });

  describe('Template Operations', () => {
    it('should handle template save with validation', async () => {
      const onSave = jest.fn();
      const template = mockTemplate();
      const { user } = await renderTemplateEditor({ template, onSave });

      await user.clear(screen.getByRole('textbox', { name: /template name/i }));
      await user.type(screen.getByRole('textbox', { name: /template name/i }), 'Updated Template');
      await user.click(screen.getByRole('button', { name: /save template/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
          id: template.id,
          name: 'Updated Template'
        }));
      });
    });

    it('should handle variable insertion', async () => {
      const template = mockTemplate({
        variables: [{
          name: 'firstName',
          type: VariableType.TEXT,
          required: true,
          defaultValue: null,
          validation: null
        }]
      });
      const { user } = await renderTemplateEditor({ template });

      const variableButton = screen.getByRole('button', { name: /insert firstname variable/i });
      await user.click(variableButton);

      const editor = screen.getByRole('textbox', { name: /template content editor/i });
      expect(editor).toHaveTextContent('{firstName}');
    });
  });

  describe('Error Handling', () => {
    it('should display validation errors with proper styling', async () => {
      const { user } = await renderTemplateEditor({});
      
      await user.click(screen.getByRole('button', { name: /save template/i }));
      
      const errorMessages = screen.getAllByRole('alert');
      expect(errorMessages[0]).toHaveClass('error-message');
      expect(errorMessages[0]).toHaveTextContent(/template name is required/i);
    });

    it('should handle API errors gracefully', async () => {
      const onSave = jest.fn().mockRejectedValue(new Error('API Error'));
      const { user } = await renderTemplateEditor({ onSave });

      await user.type(screen.getByRole('textbox', { name: /template name/i }), 'Test');
      await user.click(screen.getByRole('button', { name: /save template/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/error saving template/i);
      });
    });
  });

  describe('Performance', () => {
    it('should debounce template validation', async () => {
      const { user } = await renderTemplateEditor({});
      const nameInput = screen.getByRole('textbox', { name: /template name/i });

      await user.type(nameInput, 'Test Template');

      // Wait for debounce
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      }, { timeout: 500 });
    });
  });
});