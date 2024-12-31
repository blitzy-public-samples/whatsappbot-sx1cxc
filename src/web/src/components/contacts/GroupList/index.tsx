import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { Typography, Skeleton, useTheme, useMediaQuery } from '@mui/material'; // v5.14.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { GroupListContainer, GroupItem } from './styles';
import Card from '../../common/Card';

/**
 * Interface for contact group data structure
 */
interface ContactGroup {
  id: string;
  name: string;
  memberCount: number;
  description?: string;
  createdAt: string;
  lastUpdated: string;
  isActive: boolean;
}

/**
 * Available actions that can be performed on a group
 */
type GroupAction = 'edit' | 'delete' | 'archive' | 'export';

/**
 * Props interface for the GroupList component
 */
interface GroupListProps {
  groups: ContactGroup[];
  selectedGroupId?: string | null;
  onGroupSelect: (group: ContactGroup) => void;
  onGroupAction?: (action: GroupAction, group: ContactGroup) => void;
  className?: string;
}

/**
 * Enhanced GroupList component with virtualization and accessibility features
 */
const GroupList: React.FC<GroupListProps> = React.memo(({
  groups,
  selectedGroupId,
  onGroupSelect,
  onGroupAction,
  className
}) => {
  // Theme and responsive breakpoints
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Container ref for virtualization
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate grid dimensions based on screen size
  const gridConfig = useMemo(() => {
    const width = isMobile ? 200 : isTablet ? 240 : 280;
    const columns = Math.floor((window.innerWidth - theme.spacing(4)) / width) || 1;
    return { width, columns };
  }, [isMobile, isTablet, theme]);

  // Virtual list configuration
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(groups.length / gridConfig.columns),
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback(() => 200, []), // Estimated row height
    overscan: 5 // Number of items to render outside viewport
  });

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent, group: ContactGroup) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onGroupSelect(group);
        break;
      case 'Delete':
        event.preventDefault();
        onGroupAction?.('delete', group);
        break;
      // Add more keyboard shortcuts as needed
    }
  }, [onGroupSelect, onGroupAction]);

  // Intersection observer for progressive loading
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Implement progressive loading logic here
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Render group item
  const renderGroupItem = useCallback((group: ContactGroup) => (
    <GroupItem
      key={group.id}
      role="button"
      tabIndex={0}
      className={selectedGroupId === group.id ? 'selected' : ''}
      onClick={() => onGroupSelect(group)}
      onKeyDown={(e) => handleKeyDown(e, group)}
      aria-selected={selectedGroupId === group.id}
      aria-label={`Group ${group.name} with ${group.memberCount} members`}
    >
      <Card
        elevation={selectedGroupId === group.id ? 3 : 1}
        size="medium"
        header={
          <Typography variant="h6" component="h3" noWrap>
            {group.name}
          </Typography>
        }
      >
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {group.memberCount} members
        </Typography>
        {group.description && (
          <Typography variant="body2" noWrap>
            {group.description}
          </Typography>
        )}
        <Typography variant="caption" color="textSecondary" display="block">
          Last updated: {new Date(group.lastUpdated).toLocaleDateString()}
        </Typography>
      </Card>
    </GroupItem>
  ), [selectedGroupId, handleKeyDown]);

  // Render loading skeleton
  const renderSkeleton = useCallback(() => (
    <GroupItem>
      <Card>
        <Skeleton variant="rectangular" height={24} width="80%" />
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="60%" />
      </Card>
    </GroupItem>
  ), []);

  // Virtual rows
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <GroupListContainer
      ref={containerRef}
      className={className}
      role="grid"
      aria-label="Contact groups grid"
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        position: 'relative'
      }}
    >
      {groups.length === 0 ? (
        <Typography variant="body1" color="textSecondary" align="center">
          No groups available
        </Typography>
      ) : (
        virtualRows.map((virtualRow) => {
          const rowStart = virtualRow.index * gridConfig.columns;
          const rowGroups = groups.slice(rowStart, rowStart + gridConfig.columns);

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {rowGroups.map((group) => (
                group ? renderGroupItem(group) : renderSkeleton()
              ))}
            </div>
          );
        })
      )}
    </GroupListContainer>
  );
});

// Display name for debugging
GroupList.displayName = 'GroupList';

export default GroupList;
export type { GroupListProps, ContactGroup, GroupAction };