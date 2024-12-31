// @version react ^18.2.0
// @version @tiptap/react ^2.1.0
// @version @tiptap/starter-kit ^2.1.0

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import {
  EditorContainer,
  EditorHeader,
  EditorContent as StyledEditorContent,
  EditorToolbar,
  VariablePanel
} from './styles';
import {
  Template,
  TemplateVariable,
  TemplateEditorProps,
  TemplateValidation,
  TEMPLATE_CONTENT_MAX_LENGTH,
  TEMPLATE_NAME_MAX_LENGTH
} from '../../../types/templates';
import { useTemplates } from '../../../hooks/useTemplates';
import { LoadingState } from '../../../types/common';

// Constants for editor configuration
const AUTOSAVE_DELAY = 2000;
const VALIDATION_DELAY = 500;
const TOOLBAR_ITEMS = [
  'bold',
  'italic',
  'strike',
  'bulletList',
  'orderedList',
  'undo',
  'redo'
] as const;

/**
 * Enhanced template editor component with real-time validation,
 * accessibility support, and performance optimizations
 */
const TemplateEditor: React.FC<TemplateEditorProps> = React.memo(({
  template,
  onSave,
  onCancel,
  onValidationChange,
  className,
  style,
  testId = 'template-editor'
}) => {
  // Local state management
  const [editorState, setEditorState] = useState({
    name: template?.name || '',
    content: template?.content || '',
    variables: template?.variables || [],
    isDirty: false,
    isAutosaving: false,
    validation: { isValid: true, errors: [] } as TemplateValidation
  });

  // Custom hooks
  const { validateTemplate } = useTemplates();
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);

  // Initialize TipTap editor with enhanced configuration
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start typing your template content...'
      }),
      CharacterCount.configure({
        limit: TEMPLATE_CONTENT_MAX_LENGTH
      })
    ],
    content: editorState.content,
    editorProps: {
      attributes: {
        class: 'editor-main',
        'data-testid': `${testId}-content`,
        role: 'textbox',
        'aria-label': 'Template content editor',
        'aria-multiline': 'true'
      }
    },
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      handleContentChange(content);
    }
  });

  // Memoized variable insertion handler
  const handleVariableInsert = useCallback((variable: TemplateVariable) => {
    if (editor && !editor.isDestroyed) {
      const variableText = `{${variable.name}}`;
      editor.commands.insertContent(variableText);
      editor.commands.focus();
    }
  }, [editor]);

  // Debounced content validation
  useEffect(() => {
    const validationTimer = setTimeout(async () => {
      if (editorState.isDirty) {
        const validationResult = await validateTemplate({
          ...template,
          name: editorState.name,
          content: editorState.content,
          variables: editorState.variables
        });

        setEditorState(prev => ({
          ...prev,
          validation: validationResult
        }));

        onValidationChange?.(validationResult);
      }
    }, VALIDATION_DELAY);

    return () => clearTimeout(validationTimer);
  }, [editorState.content, editorState.name, editorState.isDirty, validateTemplate, onValidationChange, template]);

  // Auto-save functionality
  useEffect(() => {
    const autosaveTimer = setTimeout(async () => {
      if (editorState.isDirty && editorState.validation.isValid) {
        await handleSave();
      }
    }, AUTOSAVE_DELAY);

    return () => clearTimeout(autosaveTimer);
  }, [editorState.isDirty, editorState.validation.isValid]);

  // Content change handler with validation
  const handleContentChange = useCallback((content: string) => {
    setEditorState(prev => ({
      ...prev,
      content,
      isDirty: true
    }));
  }, []);

  // Name change handler with validation
  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value.slice(0, TEMPLATE_NAME_MAX_LENGTH);
    setEditorState(prev => ({
      ...prev,
      name,
      isDirty: true
    }));
  }, []);

  // Save handler with validation and error handling
  const handleSave = async () => {
    try {
      setLoadingState(LoadingState.LOADING);
      
      if (!editorState.validation.isValid) {
        throw new Error('Template validation failed');
      }

      const templateData = {
        ...(template?.id ? { id: template.id } : {}),
        name: editorState.name,
        content: editorState.content,
        variables: editorState.variables,
        organizationId: template?.organizationId || ''
      };

      await onSave(templateData);

      setEditorState(prev => ({
        ...prev,
        isDirty: false,
        isAutosaving: false
      }));

      setLoadingState(LoadingState.SUCCESS);

      // Announce success for screen readers
      announceStatus('Template saved successfully');
    } catch (error) {
      setLoadingState(LoadingState.ERROR);
      announceStatus('Error saving template', true);
      console.error('Save error:', error);
    }
  };

  // Accessibility announcement utility
  const announceStatus = (message: string, isError = false) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', isError ? 'alert' : 'status');
    announcement.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Memoized toolbar buttons
  const toolbarButtons = useMemo(() => TOOLBAR_ITEMS.map(item => (
    <button
      key={item}
      onClick={() => editor?.chain().focus()[item]().run()}
      className={editor?.isActive(item) ? 'active' : ''}
      aria-label={`Toggle ${item}`}
      disabled={loadingState === LoadingState.LOADING}
    >
      {item}
    </button>
  )), [editor, loadingState]);

  return (
    <EditorContainer
      className={className}
      style={style}
      data-testid={testId}
      role="region"
      aria-label="Template editor"
    >
      <EditorHeader>
        <input
          type="text"
          value={editorState.name}
          onChange={handleNameChange}
          placeholder="Template name"
          maxLength={TEMPLATE_NAME_MAX_LENGTH}
          aria-label="Template name"
          data-testid={`${testId}-name`}
          disabled={loadingState === LoadingState.LOADING}
        />
        <div className="actions">
          <button
            onClick={onCancel}
            disabled={loadingState === LoadingState.LOADING}
            aria-label="Cancel editing"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!editorState.validation.isValid || loadingState === LoadingState.LOADING}
            aria-label="Save template"
          >
            {loadingState === LoadingState.LOADING ? 'Saving...' : 'Save'}
          </button>
        </div>
      </EditorHeader>

      <StyledEditorContent>
        <EditorToolbar>{toolbarButtons}</EditorToolbar>
        <EditorContent editor={editor} />
        
        <VariablePanel>
          <div className="panel-header">Variables</div>
          <div className="variable-list">
            {editorState.variables.map(variable => (
              <div
                key={variable.name}
                className="variable-item"
                onClick={() => handleVariableInsert(variable)}
                role="button"
                tabIndex={0}
                aria-label={`Insert ${variable.name} variable`}
              >
                {variable.name}
                <span className="variable-type">{variable.type}</span>
              </div>
            ))}
          </div>
        </VariablePanel>
      </StyledEditorContent>

      {editorState.validation.errors.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="validation-errors"
        >
          {editorState.validation.errors.map((error, index) => (
            <div key={index} className="error-message">
              {error.message}
            </div>
          ))}
        </div>
      )}
    </EditorContainer>
  );
});

TemplateEditor.displayName = 'TemplateEditor';

export default TemplateEditor;