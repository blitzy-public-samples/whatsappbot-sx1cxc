// @version react ^18.2.0
// @version react-router-dom ^6.15.0
// @version react-virtual ^2.10.4

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import TemplateList from '../../components/templates/TemplateList';
import TemplateEditor from '../../components/templates/TemplateEditor';
import { useTemplates } from '../../hooks/useTemplates';
import { Template } from '../../types/templates';
import { LoadingState } from '../../types/common';

// View type constants for template display
const VIEW_TYPES = {
  GRID: 'grid',
  TABLE: 'table',
  ANALYTICS: 'analytics'
} as const;

// Bulk action types
const BULK_ACTIONS = {
  DELETE: 'delete',
  DUPLICATE: 'duplicate',
  ARCHIVE: 'archive',
  ACTIVATE: 'activate'
} as const;

type ViewType = typeof VIEW_TYPES[keyof typeof VIEW_TYPES];
type BulkAction = typeof BULK_ACTIONS[keyof typeof BULK_ACTIONS];

/**
 * Enhanced templates management page component with analytics and bulk operations
 */
const TemplatesPage: React.FC = React.memo(() => {
  // State management
  const [viewType, setViewType] = useState<ViewType>(VIEW_TYPES.GRID);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  
  // Custom hooks
  const navigate = useNavigate();
  const {
    templates,
    loading,
    selectedTemplate,
    validation,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    selectTemplate,
    clearSelectedTemplate,
    validateTemplate,
    previewTemplate,
    getTemplateAnalytics,
    performBulkAction
  } = useTemplates();

  // Virtualization configuration for large template lists
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: templates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  });

  // Handlers for template operations
  const handleCreateTemplate = useCallback(() => {
    clearSelectedTemplate();
    setIsEditorOpen(true);
  }, [clearSelectedTemplate]);

  const handleEditTemplate = useCallback((template: Template) => {
    selectTemplate(template.id);
    setIsEditorOpen(true);
  }, [selectTemplate]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    try {
      await deleteTemplate(id);
      announceSuccess('Template deleted successfully');
    } catch (error) {
      announceError('Failed to delete template');
      console.error('Delete error:', error);
    }
  }, [deleteTemplate]);

  const handleSaveTemplate = useCallback(async (templateData: Template) => {
    try {
      if (templateData.id) {
        await updateTemplate(templateData);
      } else {
        await createTemplate(templateData);
      }
      setIsEditorOpen(false);
      announceSuccess('Template saved successfully');
    } catch (error) {
      announceError('Failed to save template');
      console.error('Save error:', error);
    }
  }, [updateTemplate, createTemplate]);

  const handleBulkAction = useCallback(async (action: BulkAction) => {
    if (selectedTemplates.size === 0) return;

    try {
      const templateIds = Array.from(selectedTemplates);
      await performBulkAction(action, templateIds);
      setSelectedTemplates(new Set());
      announceSuccess(`Bulk ${action} completed successfully`);
    } catch (error) {
      announceError(`Failed to perform bulk ${action}`);
      console.error('Bulk action error:', error);
    }
  }, [selectedTemplates, performBulkAction]);

  // Memoized computed values
  const templateAnalytics = useMemo(() => {
    if (viewType === VIEW_TYPES.ANALYTICS) {
      return templates.map(template => ({
        ...template,
        analytics: getTemplateAnalytics(template.id)
      }));
    }
    return [];
  }, [templates, viewType, getTemplateAnalytics]);

  // Accessibility announcements
  const announceSuccess = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  const announceError = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Render functions
  const renderTemplateList = () => (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <TemplateList
        viewType={viewType}
        templates={templates}
        onEdit={handleEditTemplate}
        onDelete={handleDeleteTemplate}
        onBulkAction={handleBulkAction}
        selectedTemplates={selectedTemplates}
        onSelectionChange={setSelectedTemplates}
        loadingState={loading}
      />
    </div>
  );

  const renderTemplateEditor = () => (
    <TemplateEditor
      template={selectedTemplate}
      onSave={handleSaveTemplate}
      onCancel={() => setIsEditorOpen(false)}
      onValidationChange={validateTemplate}
      onPreview={previewTemplate}
    />
  );

  const renderAnalytics = () => (
    <div className="template-analytics" role="region" aria-label="Template analytics">
      {templateAnalytics.map(template => (
        <div key={template.id} className="analytics-card">
          <h3>{template.name}</h3>
          <div className="analytics-metrics">
            <div>Usage: {template.analytics.usage}</div>
            <div>Success Rate: {template.analytics.successRate}%</div>
            <div>Avg Response Time: {template.analytics.avgResponseTime}ms</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div 
      className="templates-page"
      role="main"
      aria-label="Template management"
    >
      <header className="templates-header">
        <h1>Templates</h1>
        <div className="header-actions">
          <button
            onClick={handleCreateTemplate}
            disabled={loading === LoadingState.LOADING}
            aria-label="Create new template"
          >
            Create Template
          </button>
          <div className="view-toggles">
            {Object.values(VIEW_TYPES).map(type => (
              <button
                key={type}
                onClick={() => setViewType(type)}
                className={viewType === type ? 'active' : ''}
                aria-pressed={viewType === type}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="templates-content">
        {isEditorOpen ? renderTemplateEditor() : (
          viewType === VIEW_TYPES.ANALYTICS ? renderAnalytics() : renderTemplateList()
        )}
      </main>

      {validation.errors.length > 0 && (
        <div 
          className="validation-errors"
          role="alert"
          aria-live="polite"
        >
          {validation.errors.map((error, index) => (
            <div key={index} className="error-message">
              {error.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

TemplatesPage.displayName = 'TemplatesPage';

export default TemplatesPage;