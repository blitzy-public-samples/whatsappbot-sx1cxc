// @version react ^18.2.0
// @version @tanstack/react-virtual ^3.0.0
// @version @sentry/react ^7.0.0

import React, { useMemo, useCallback, memo, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ErrorBoundary } from '@sentry/react';
import { Template, TemplateListProps, TemplateValidation } from '../../../types/templates';
import { useTemplates } from '../../../hooks/useTemplates';
import { LoadingState } from '../../../types/common';

// Constants for virtualization and accessibility
const VIRTUALIZATION_CONFIG = {
  itemSize: 60,
  overscan: 5,
  scrollThreshold: 0.8,
} as const;

const ACCESSIBILITY_LABELS = {
  gridView: 'Template grid view',
  tableView: 'Template table view',
  loadingState: 'Loading templates',
  emptyState: 'No templates found',
  bulkSelect: 'Select all templates',
  deleteConfirm: 'Are you sure you want to delete the selected templates?',
} as const;

// Interface for component props
interface TemplateListViewProps extends TemplateListProps {
  viewType?: 'grid' | 'table';
  className?: string;
  virtualScrollConfig?: typeof VIRTUALIZATION_CONFIG;
  accessibilityLabels?: typeof ACCESSIBILITY_LABELS;
}

// Interface for template selection state
interface TemplateSelection {
  [key: string]: boolean;
}

/**
 * Enterprise-grade template list component with virtualization and accessibility
 */
const TemplateList: React.FC<TemplateListViewProps> = memo(({
  viewType = 'grid',
  className = '',
  virtualScrollConfig = VIRTUALIZATION_CONFIG,
  accessibilityLabels = ACCESSIBILITY_LABELS,
  ...props
}) => {
  // Local state
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateSelection>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom hook for template management
  const {
    templates,
    loading,
    deleteTemplate,
    bulkDeleteTemplates,
    optimisticUpdate,
  } = useTemplates();

  // Memoized selected templates count
  const selectedCount = useMemo(() => 
    Object.values(selectedTemplates).filter(Boolean).length,
    [selectedTemplates]
  );

  // Virtual list configuration
  const virtualizer = useVirtualizer({
    count: templates.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => virtualScrollConfig.itemSize,
    overscan: virtualScrollConfig.overscan,
  });

  // Handlers
  const handleTemplateSelect = useCallback((templateId: string, selected: boolean) => {
    setSelectedTemplates(prev => ({
      ...prev,
      [templateId]: selected,
    }));
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    const newSelection = templates.reduce((acc, template) => ({
      ...acc,
      [template.id]: selected,
    }), {});
    setSelectedTemplates(newSelection);
  }, [templates]);

  const handleDelete = useCallback(async (templateId: string) => {
    try {
      setIsDeleting(true);
      await deleteTemplate(templateId);
      // Clear selection after successful delete
      setSelectedTemplates(prev => {
        const { [templateId]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      console.error('Failed to delete template:', error);
      // Announce error for screen readers
      announceError('Failed to delete template. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTemplate]);

  const handleBulkDelete = useCallback(async () => {
    if (!window.confirm(accessibilityLabels.deleteConfirm)) return;

    try {
      setIsDeleting(true);
      const templateIds = Object.entries(selectedTemplates)
        .filter(([_, selected]) => selected)
        .map(([id]) => id);

      await bulkDeleteTemplates(templateIds);
      setSelectedTemplates({});
    } catch (error) {
      console.error('Failed to delete templates:', error);
      announceError('Failed to delete selected templates. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedTemplates, bulkDeleteTemplates, accessibilityLabels.deleteConfirm]);

  // Accessibility announcements
  const announceError = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Render functions
  const renderGridView = () => (
    <div 
      className="template-grid"
      role="grid"
      aria-label={accessibilityLabels.gridView}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const template = templates[virtualRow.index];
        return (
          <div
            key={template.id}
            className="template-grid-item"
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
            role="gridcell"
          >
            <TemplateCard
              template={template}
              selected={selectedTemplates[template.id]}
              onSelect={handleTemplateSelect}
              onDelete={handleDelete}
              disabled={isDeleting}
            />
          </div>
        );
      })}
    </div>
  );

  const renderTableView = () => (
    <div 
      className="template-table"
      role="table"
      aria-label={accessibilityLabels.tableView}
    >
      <div className="template-table-header" role="rowheader">
        <div className="template-table-checkbox">
          <input
            type="checkbox"
            checked={selectedCount === templates.length}
            onChange={(e) => handleSelectAll(e.target.checked)}
            aria-label={accessibilityLabels.bulkSelect}
          />
        </div>
        <div className="template-table-columns">
          <div>Name</div>
          <div>Created</div>
          <div>Modified</div>
          <div>Actions</div>
        </div>
      </div>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const template = templates[virtualRow.index];
        return (
          <div
            key={template.id}
            className="template-table-row"
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
            role="row"
          >
            <TemplateTableRow
              template={template}
              selected={selectedTemplates[template.id]}
              onSelect={handleTemplateSelect}
              onDelete={handleDelete}
              disabled={isDeleting}
            />
          </div>
        );
      })}
    </div>
  );

  // Loading state
  if (loading === LoadingState.LOADING) {
    return (
      <div 
        className="template-list-loading"
        role="status"
        aria-label={accessibilityLabels.loadingState}
      >
        <LoadingSpinner />
      </div>
    );
  }

  // Empty state
  if (!templates.length) {
    return (
      <div 
        className="template-list-empty"
        role="status"
        aria-label={accessibilityLabels.emptyState}
      >
        <EmptyState message="No templates found" />
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<ErrorState onRetry={() => window.location.reload()} />}>
      <div 
        ref={containerRef}
        className={`template-list ${className} ${viewType}`}
        style={{ height: '100%', overflow: 'auto' }}
      >
        {selectedCount > 0 && (
          <BulkActions
            selectedCount={selectedCount}
            onDelete={handleBulkDelete}
            disabled={isDeleting}
          />
        )}
        {viewType === 'grid' ? renderGridView() : renderTableView()}
      </div>
    </ErrorBoundary>
  );
});

TemplateList.displayName = 'TemplateList';

export default TemplateList;