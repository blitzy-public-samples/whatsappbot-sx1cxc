import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { debounce } from 'lodash';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ImportExport as ImportExportIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';

import {
  ContactListContainer,
  SearchContainer,
  ActionBar,
  ContactTableContainer,
  PaginationContainer,
} from './styles';
import Table from '../../common/Table';
import { useContacts } from '../../../hooks/useContacts';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { Contact, ContactListProps } from '../../../types/contacts';
import { LoadingState } from '../../../types/common';

// Table column configuration
const TABLE_COLUMNS = [
  { id: 'name', label: 'Name', sortable: true, width: '25%' },
  { id: 'phoneNumber', label: 'Phone Number', sortable: true, width: '20%' },
  { id: 'email', label: 'Email', sortable: true, width: '25%' },
  { id: 'lastContactedAt', label: 'Last Contacted', sortable: true, width: '20%' },
  { id: 'actions', label: 'Actions', sortable: false, width: '10%' }
];

// Items per page options
const ITEMS_PER_PAGE = 10;

/**
 * ContactList Component
 * Displays a paginated, searchable list of contacts with real-time updates
 */
const ContactList: React.FC<ContactListProps> = React.memo(({
  onSelect,
  onDelete,
  className,
  style,
  testId = 'contact-list'
}) => {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [sortConfig, setSortConfig] = useState({ field: 'name', order: 'asc' });
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  // Custom hooks for contacts and real-time updates
  const {
    contacts,
    loadingState,
    error,
    pagination,
    actions: {
      fetchContacts,
      deleteContacts,
      updateFilters,
      importContacts,
      exportContacts
    }
  } = useContacts({
    initialPage: currentPage,
    pageSize: ITEMS_PER_PAGE,
    search: searchQuery,
    enableRealtime: true
  });

  // WebSocket connection for real-time updates
  const { isConnected } = useWebSocket(localStorage.getItem('whatsapp_web_token') || '', {
    onMessage: (message) => {
      if (message.type === 'CONTACT_UPDATE') {
        fetchContacts();
      }
    }
  });

  // Debounced search handler
  const handleSearch = useMemo(
    () => debounce((query: string) => {
      setSearchQuery(query);
      setCurrentPage(0);
    }, 300),
    []
  );

  // Sort handler
  const handleSort = useCallback((field: string) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Selection handlers
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedContacts(checked ? contacts.map(c => c.id) : []);
  }, [contacts]);

  const handleSelectContact = useCallback((contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  }, []);

  // Bulk action handlers
  const handleBulkDelete = useCallback(async () => {
    try {
      await deleteContacts(selectedContacts);
      setSelectedContacts([]);
    } catch (error) {
      console.error('Failed to delete contacts:', error);
    }
  }, [deleteContacts, selectedContacts]);

  // Import/Export handlers
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await importContacts(file);
      } catch (error) {
        console.error('Failed to import contacts:', error);
      }
    }
  }, [importContacts]);

  const handleExport = useCallback(async (format: 'csv' | 'xlsx' | 'json') => {
    try {
      await exportContacts(format);
    } catch (error) {
      console.error('Failed to export contacts:', error);
    }
  }, [exportContacts]);

  // Effect to fetch contacts when dependencies change
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts, currentPage, sortConfig, searchQuery]);

  return (
    <ContactListContainer
      className={className}
      style={style}
      data-testid={testId}
    >
      <SearchContainer>
        <TextField
          fullWidth
          placeholder="Search contacts..."
          InputProps={{
            startAdornment: <SearchIcon />,
          }}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <Box display="flex" gap={1}>
          <Tooltip title="Filter contacts">
            <IconButton onClick={() => updateFilters({})}>
              <FilterIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Import/Export">
            <IconButton onClick={() => handleExport('csv')}>
              <ImportExportIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => onSelect?.(null)}
          >
            Add Contact
          </Button>
        </Box>
      </SearchContainer>

      {selectedContacts.length > 0 && (
        <ActionBar hasSelection>
          <Typography variant="subtitle1">
            {selectedContacts.length} contacts selected
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
            >
              Delete Selected
            </Button>
          </Box>
        </ActionBar>
      )}

      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Real-time updates are currently unavailable
        </Alert>
      )}

      <ContactTableContainer>
        <Table
          columns={TABLE_COLUMNS}
          data={contacts}
          sortable
          selectable
          selectedRows={selectedContacts}
          onSort={handleSort}
          onRowSelect={handleSelectContact}
          onSelectAll={handleSelectAll}
          loading={loadingState.fetch === LoadingState.LOADING}
          emptyMessage="No contacts found"
        />
      </ContactTableContainer>

      <PaginationContainer>
        <Typography variant="body2">
          Showing {contacts.length} of {pagination.total} contacts
        </Typography>
        {loadingState.fetch === LoadingState.LOADING && (
          <CircularProgress size={20} />
        )}
      </PaginationContainer>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error.fetch}
        </Alert>
      )}

      <input
        type="file"
        accept=".csv,.xlsx"
        style={{ display: 'none' }}
        onChange={handleImport}
        id="contact-import-input"
      />
    </ContactListContainer>
  );
});

ContactList.displayName = 'ContactList';

export default ContactList;