// @version React ^18.2.0
// @version @mui/material ^5.14.0
// @version @mui/x-date-pickers ^6.11.0
// @version @mui/icons-material ^5.14.0

import React, { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import {
  TextField,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  Tooltip,
  CircularProgress,
  Alert,
  FormHelperText,
} from '@mui/material';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { AttachFile, Send, Schedule, Preview, Delete } from '@mui/icons-material';
import {
  ComposerContainer,
  TemplateSection,
  RecipientsSection,
  MessageSection,
  AttachmentsSection,
  ScheduleSection,
  ActionButtons,
} from './styles';
import { useMessages } from '../../../hooks/useMessages';
import { useTemplates } from '../../../hooks/useTemplates';
import { Message, MessageType, MessageStatus, ComposeMessageRequest } from '../../../types/messages';
import { Template } from '../../../types/templates';

// Constants for file handling and validation
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 16 * 1024 * 1024; // 16MB
const SUPPORTED_ATTACHMENT_TYPES = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
const MIN_SCHEDULE_DELAY = 5 * 60 * 1000; // 5 minutes

interface MessageComposerProps {
  onSuccess?: (message: Message) => void;
  onError?: (error: Error) => void;
  initialTemplate?: Template;
  className?: string;
}

const MessageComposer: React.FC<MessageComposerProps> = memo(({
  onSuccess,
  onError,
  initialTemplate,
  className
}) => {
  // Hooks
  const {
    sendMessageWithRetry,
    scheduleMessage,
    loading,
    error: messageError
  } = useMessages();

  const {
    templates,
    selectedTemplate,
    selectTemplate,
    previewTemplate,
    error: templateError
  } = useTemplates();

  // State management
  const [messageType, setMessageType] = useState<MessageType>(
    initialTemplate ? MessageType.TEMPLATE : MessageType.TEXT
  );
  const [recipients, setRecipients] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [scheduleTime, setScheduleTime] = useState<Date | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with initial template if provided
  useEffect(() => {
    if (initialTemplate) {
      selectTemplate(initialTemplate.id);
      setMessageContent(initialTemplate.content);
    }
  }, [initialTemplate, selectTemplate]);

  // Validation
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!recipients.length) {
      errors.recipients = 'At least one recipient is required';
    }

    if (messageType === MessageType.TEMPLATE && !selectedTemplate) {
      errors.template = 'Please select a template';
    }

    if (messageType === MessageType.TEXT && !messageContent.trim()) {
      errors.content = 'Message content is required';
    }

    if (isScheduled && !scheduleTime) {
      errors.schedule = 'Schedule time is required';
    }

    if (isScheduled && scheduleTime && scheduleTime.getTime() < Date.now() + MIN_SCHEDULE_DELAY) {
      errors.schedule = 'Schedule time must be at least 5 minutes in the future';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [recipients, messageType, selectedTemplate, messageContent, isScheduled, scheduleTime]);

  // File handling
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = SUPPORTED_ATTACHMENT_TYPES.some(type => 
        file.name.toLowerCase().endsWith(type)
      );
      const isValidSize = file.size <= MAX_ATTACHMENT_SIZE;
      return isValidType && isValidSize;
    });

    if (validFiles.length + attachments.length <= MAX_ATTACHMENTS) {
      setAttachments(prev => [...prev, ...validFiles]);
      setValidationErrors(prev => ({ ...prev, attachments: '' }));
    } else {
      setValidationErrors(prev => ({
        ...prev,
        attachments: `Maximum ${MAX_ATTACHMENTS} attachments allowed`
      }));
    }
  }, [attachments]);

  // Message submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const request: ComposeMessageRequest = {
        recipients,
        type: messageType,
        content: {
          text: messageContent,
          mediaUrl: null,
          mediaType: null,
          caption: null,
          fileSize: null,
          mimeType: null,
          thumbnailUrl: null
        },
        templateId: selectedTemplate?.id,
        scheduledAt: isScheduled ? scheduleTime?.toISOString() : undefined
      };

      const message = isScheduled
        ? await scheduleMessage(request)
        : await sendMessageWithRetry(request);

      onSuccess?.(message);
      resetForm();
    } catch (error) {
      onError?.(error as Error);
    }
  };

  // Form reset
  const resetForm = useCallback(() => {
    setMessageType(MessageType.TEXT);
    setRecipients([]);
    setMessageContent('');
    setAttachments([]);
    setScheduleTime(null);
    setIsScheduled(false);
    setValidationErrors({});
    setIsPreviewMode(false);
  }, []);

  // Preview content
  const previewContent = useMemo(() => {
    if (!isPreviewMode) return messageContent;
    
    if (messageType === MessageType.TEMPLATE && selectedTemplate) {
      return previewTemplate(selectedTemplate, {});
    }
    
    return messageContent;
  }, [isPreviewMode, messageContent, messageType, selectedTemplate, previewTemplate]);

  return (
    <ComposerContainer 
      component="form" 
      onSubmit={handleSubmit}
      className={className}
      role="form"
      aria-label="Message composer"
    >
      {/* Template Selection */}
      <TemplateSection>
        <FormControl fullWidth error={!!validationErrors.template}>
          <InputLabel id="template-select-label">Template</InputLabel>
          <Select
            labelId="template-select-label"
            value={selectedTemplate?.id || ''}
            onChange={(e) => selectTemplate(e.target.value)}
            disabled={messageType !== MessageType.TEMPLATE}
          >
            {templates.map(template => (
              <MenuItem key={template.id} value={template.id}>
                {template.name}
              </MenuItem>
            ))}
          </Select>
          {validationErrors.template && (
            <FormHelperText>{validationErrors.template}</FormHelperText>
          )}
        </FormControl>
      </TemplateSection>

      {/* Recipients Section */}
      <RecipientsSection>
        <TextField
          fullWidth
          label="Recipients"
          placeholder="Enter phone numbers separated by commas"
          value={recipients.join(', ')}
          onChange={(e) => setRecipients(e.target.value.split(',').map(r => r.trim()))}
          error={!!validationErrors.recipients}
          helperText={validationErrors.recipients}
          multiline
          rows={2}
        />
      </RecipientsSection>

      {/* Message Content */}
      <MessageSection>
        <TextField
          fullWidth
          label="Message"
          value={isPreviewMode ? previewContent : messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          error={!!validationErrors.content}
          helperText={validationErrors.content}
          multiline
          rows={4}
          disabled={isPreviewMode || messageType === MessageType.TEMPLATE}
        />
      </MessageSection>

      {/* Attachments Section */}
      <AttachmentsSection>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          multiple
          accept={SUPPORTED_ATTACHMENT_TYPES.join(',')}
        />
        <Button
          variant="outlined"
          startIcon={<AttachFile />}
          onClick={() => fileInputRef.current?.click()}
          disabled={attachments.length >= MAX_ATTACHMENTS}
        >
          Add Attachments
        </Button>
        {validationErrors.attachments && (
          <FormHelperText error>{validationErrors.attachments}</FormHelperText>
        )}
        {attachments.map((file, index) => (
          <div key={index}>
            {file.name}
            <IconButton
              size="small"
              onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
            >
              <Delete />
            </IconButton>
          </div>
        ))}
      </AttachmentsSection>

      {/* Schedule Section */}
      <ScheduleSection>
        <FormControlLabel
          control={
            <Checkbox
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
            />
          }
          label="Schedule Message"
        />
        {isScheduled && (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="Schedule Time"
              value={scheduleTime}
              onChange={setScheduleTime}
              minDateTime={new Date(Date.now() + MIN_SCHEDULE_DELAY)}
              slotProps={{
                textField: {
                  error: !!validationErrors.schedule,
                  helperText: validationErrors.schedule
                }
              }}
            />
          </LocalizationProvider>
        )}
      </ScheduleSection>

      {/* Action Buttons */}
      <ActionButtons>
        <Button
          variant="outlined"
          startIcon={<Preview />}
          onClick={() => setIsPreviewMode(!isPreviewMode)}
        >
          {isPreviewMode ? 'Edit' : 'Preview'}
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={isScheduled ? <Schedule /> : <Send />}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : isScheduled ? 'Schedule' : 'Send'}
        </Button>
      </ActionButtons>

      {/* Error Display */}
      {(messageError || templateError) && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {messageError || templateError}
        </Alert>
      )}
    </ComposerContainer>
  );
});

MessageComposer.displayName = 'MessageComposer';

export default MessageComposer;