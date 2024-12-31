import React, { memo, useCallback, useEffect, useRef } from 'react';
import { useVirtual } from 'react-virtual';
import {
  TableContainer,
  StyledTable,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell
} from './styles';
import { BaseComponentProps } from '../../../types/common';

// Types and Interfaces
export type SortOrder = 'asc' | 'desc' | null;

export interface TableColumn {
  id: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  frozen?: boolean;
}

export interface TableProps extends BaseComponentProps {
  columns: TableColumn[];
  data: Array<any>;
  sortable?: boolean;
  selectable?: boolean;
  resizable?: boolean;
  virtualScroll?: boolean;
  frozenColumns?: number;
  onSort?: (column: string, order: SortOrder) => void;
  onRowSelect?: (selectedRows: Array<any>) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  selectedRows?: Array<any>;
  loading?: boolean;
  emptyMessage?: string;
}

export const Table = memo<TableProps>(({
  columns,
  data,
  sortable = false,
  selectable = false,
  resizable = false,
  virtualScroll = false,
  frozenColumns = 0,
  onSort,
  onRowSelect,
  onColumnResize,
  selectedRows = [],
  loading = false,
  emptyMessage = 'No data available',
  className,
  style,
  id,
  testId = 'table-component'
}) => {
  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const focusTrackingRef = useRef<number>(-1);

  // Virtual scroll setup
  const { virtualItems, totalSize } = useVirtual({
    size: virtualScroll ? data.length : 0,
    parentRef: tableContainerRef,
    estimateSize: useCallback(() => 48, []), // Default row height
    overscan: 5
  });

  // Sort state management
  const [sortState, setSortState] = React.useState<{
    column: string | null;
    order: SortOrder;
  }>({ column: null, order: null });

  // Column resize state
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({});

  // RTL support
  const isRTL = document.dir === 'rtl';

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!selectable) return;

    const currentFocus = focusTrackingRef.current;
    let newFocus = currentFocus;

    switch (event.key) {
      case 'ArrowDown':
        newFocus = Math.min(data.length - 1, currentFocus + 1);
        event.preventDefault();
        break;
      case 'ArrowUp':
        newFocus = Math.max(0, currentFocus - 1);
        event.preventDefault();
        break;
      case 'Space':
        if (currentFocus >= 0 && onRowSelect) {
          const selectedRow = data[currentFocus];
          onRowSelect([...selectedRows, selectedRow]);
          event.preventDefault();
        }
        break;
    }

    focusTrackingRef.current = newFocus;
  }, [data, selectable, selectedRows, onRowSelect]);

  // Column resize handler
  const handleColumnResize = useCallback((columnId: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [columnId]: width }));
    onColumnResize?.(columnId, width);
  }, [onColumnResize]);

  // Sort handler
  const handleSort = useCallback((columnId: string) => {
    if (!sortable) return;

    const newOrder: SortOrder = 
      sortState.column === columnId 
        ? sortState.order === 'asc' 
          ? 'desc' 
          : sortState.order === 'desc' 
            ? null 
            : 'asc'
        : 'asc';

    setSortState({ column: columnId, order: newOrder });
    onSort?.(columnId, newOrder);
  }, [sortable, sortState, onSort]);

  // Row selection handler
  const handleRowSelect = useCallback((row: any) => {
    if (!selectable || !onRowSelect) return;

    const isSelected = selectedRows.includes(row);
    const newSelection = isSelected
      ? selectedRows.filter(selected => selected !== row)
      : [...selectedRows, row];

    onRowSelect(newSelection);
  }, [selectable, selectedRows, onRowSelect]);

  // Setup resize observers
  useEffect(() => {
    if (!resizable || !tableRef.current) return;

    resizeObserverRef.current = new ResizeObserver(entries => {
      entries.forEach(entry => {
        const column = entry.target.getAttribute('data-column-id');
        if (column) {
          handleColumnResize(column, entry.contentRect.width);
        }
      });
    });

    const headerCells = tableRef.current.querySelectorAll('th');
    headerCells.forEach(cell => {
      resizeObserverRef.current?.observe(cell);
    });

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [resizable, handleColumnResize]);

  // Render table header
  const renderHeader = () => (
    <TableHeader>
      <TableRow>
        {columns.map((column, index) => (
          <TableHeaderCell
            key={column.id}
            align={column.align}
            style={{ width: columnWidths[column.id] || column.width }}
            onClick={() => column.sortable && handleSort(column.id)}
            aria-sort={sortState.column === column.id ? sortState.order : undefined}
            data-column-id={column.id}
            isRTL={isRTL}
          >
            {column.label}
            {resizable && index < columns.length - 1 && (
              <div
                className="resize-handle"
                onMouseDown={e => {
                  // Resize logic
                }}
              />
            )}
          </TableHeaderCell>
        ))}
      </TableRow>
    </TableHeader>
  );

  // Render table body
  const renderBody = () => (
    <TableBody>
      {virtualScroll
        ? virtualItems.map(virtualRow => (
            <TableRow
              key={virtualRow.index}
              isSelected={selectedRows.includes(data[virtualRow.index])}
              isClickable={selectable}
              onClick={() => handleRowSelect(data[virtualRow.index])}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              tabIndex={selectable ? 0 : undefined}
            >
              {columns.map(column => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  isRTL={isRTL}
                >
                  {data[virtualRow.index][column.id]}
                </TableCell>
              ))}
            </TableRow>
          ))
        : data.map((row, index) => (
            <TableRow
              key={index}
              isSelected={selectedRows.includes(row)}
              isClickable={selectable}
              onClick={() => handleRowSelect(row)}
              tabIndex={selectable ? 0 : undefined}
            >
              {columns.map(column => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  isRTL={isRTL}
                >
                  {row[column.id]}
                </TableCell>
              ))}
            </TableRow>
          ))}
    </TableBody>
  );

  return (
    <TableContainer
      ref={tableContainerRef}
      className={className}
      style={style}
      isLoading={loading}
      data-testid={testId}
      id={id}
      onKeyDown={handleKeyDown}
      role="grid"
      aria-busy={loading}
      aria-rowcount={data.length}
    >
      <StyledTable ref={tableRef}>
        {renderHeader()}
        {data.length > 0 ? (
          renderBody()
        ) : (
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={columns.length}
                align="center"
                aria-label={emptyMessage}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          </TableBody>
        )}
      </StyledTable>
    </TableContainer>
  );
});

Table.displayName = 'Table';

export default Table;