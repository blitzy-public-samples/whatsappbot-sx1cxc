// @version @reduxjs/toolkit ^1.9.x
import { createSlice, createAsyncThunk, createEntityAdapter, PayloadAction } from '@reduxjs/toolkit';
import { 
  Message, 
  MessageStatus, 
  MessageFilter,
  ComposeMessageRequest,
  MessageContent,
  MESSAGE_CONSTRAINTS
} from '../../types/messages';
import { 
  sendMessage, 
  scheduleMessage, 
  sendBulkMessages, 
  getMessageStatus, 
  updateMessage 
} from '../../services/api/messages';
import { RootState } from '../store';
import { isAxiosError } from '../../types/api';

// Entity adapter for normalized message state management
export const messagesAdapter = createEntityAdapter<Message>({
  selectId: (message) => message.id,
  sortComparer: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
});

// Interface for message slice state
interface MessagesState {
  loading: boolean;
  error: string | null;
  selectedMessageId: string | null;
  filter: MessageFilter | null;
  realTimeConnection: boolean;
  retryQueue: string[];
  lastSync: string | null;
  metrics: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
  };
}

// Initial state with entity adapter state
const initialState = messagesAdapter.getInitialState<MessagesState>({
  loading: false,
  error: null,
  selectedMessageId: null,
  filter: null,
  realTimeConnection: false,
  retryQueue: [],
  lastSync: null,
  metrics: {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
  },
});

// Async thunks for message operations
export const fetchMessages = createAsyncThunk(
  'messages/fetchMessages',
  async (filter: MessageFilter | null = null, { rejectWithValue }) => {
    try {
      const response = await getMessages(filter);
      return response;
    } catch (error) {
      if (isAxiosError(error)) {
        return rejectWithValue(error.response?.data?.message || 'Failed to fetch messages');
      }
      return rejectWithValue('An unexpected error occurred');
    }
  }
);

export const sendNewMessage = createAsyncThunk(
  'messages/sendNewMessage',
  async (request: ComposeMessageRequest, { rejectWithValue }) => {
    try {
      const message = await sendMessage(request);
      return message;
    } catch (error) {
      if (isAxiosError(error)) {
        return rejectWithValue(error.response?.data?.message || 'Failed to send message');
      }
      return rejectWithValue('An unexpected error occurred');
    }
  }
);

export const scheduleNewMessage = createAsyncThunk(
  'messages/scheduleNewMessage',
  async (request: ComposeMessageRequest, { rejectWithValue }) => {
    try {
      const message = await scheduleMessage(request);
      return message;
    } catch (error) {
      if (isAxiosError(error)) {
        return rejectWithValue(error.response?.data?.message || 'Failed to schedule message');
      }
      return rejectWithValue('An unexpected error occurred');
    }
  }
);

export const sendBulkMessageRequests = createAsyncThunk(
  'messages/sendBulkMessages',
  async (requests: ComposeMessageRequest[], { dispatch, rejectWithValue }) => {
    try {
      const result = await sendBulkMessages(requests, {
        onProgress: (progress) => {
          dispatch(updateBulkProgress(progress));
        },
      });
      return result;
    } catch (error) {
      if (isAxiosError(error)) {
        return rejectWithValue(error.response?.data?.message || 'Bulk send operation failed');
      }
      return rejectWithValue('An unexpected error occurred');
    }
  }
);

export const updateMessageStatus = createAsyncThunk(
  'messages/updateStatus',
  async ({ messageId, status }: { messageId: string; status: MessageStatus }, { rejectWithValue }) => {
    try {
      const message = await updateMessage({ id: messageId, status });
      return message;
    } catch (error) {
      if (isAxiosError(error)) {
        return rejectWithValue(error.response?.data?.message || 'Failed to update message status');
      }
      return rejectWithValue('An unexpected error occurred');
    }
  }
);

// Create the messages slice
const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setSelectedMessage: (state, action: PayloadAction<string | null>) => {
      state.selectedMessageId = action.payload;
    },
    setFilter: (state, action: PayloadAction<MessageFilter | null>) => {
      state.filter = action.payload;
    },
    updateRealTimeConnection: (state, action: PayloadAction<boolean>) => {
      state.realTimeConnection = action.payload;
    },
    updateBulkProgress: (state, action: PayloadAction<number>) => {
      // Handle bulk operation progress updates
    },
    addToRetryQueue: (state, action: PayloadAction<string>) => {
      if (!state.retryQueue.includes(action.payload)) {
        state.retryQueue.push(action.payload);
      }
    },
    removeFromRetryQueue: (state, action: PayloadAction<string>) => {
      state.retryQueue = state.retryQueue.filter(id => id !== action.payload);
    },
    updateMetrics: (state, action: PayloadAction<Partial<MessagesState['metrics']>>) => {
      state.metrics = { ...state.metrics, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch messages
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.lastSync = new Date().toISOString();
        messagesAdapter.setAll(state, action.payload);
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Send new message
      .addCase(sendNewMessage.fulfilled, (state, action) => {
        messagesAdapter.addOne(state, action.payload);
        state.metrics.totalSent++;
      })
      // Schedule message
      .addCase(scheduleNewMessage.fulfilled, (state, action) => {
        messagesAdapter.addOne(state, action.payload);
      })
      // Bulk messages
      .addCase(sendBulkMessageRequests.fulfilled, (state, action) => {
        messagesAdapter.addMany(state, action.payload.successful);
        state.metrics.totalSent += action.payload.successful.length;
        state.metrics.totalFailed += action.payload.failed.length;
      })
      // Update status
      .addCase(updateMessageStatus.fulfilled, (state, action) => {
        messagesAdapter.updateOne(state, {
          id: action.payload.id,
          changes: { status: action.payload.status },
        });
        // Update metrics based on status
        if (action.payload.status === MessageStatus.DELIVERED) {
          state.metrics.totalDelivered++;
        } else if (action.payload.status === MessageStatus.FAILED) {
          state.metrics.totalFailed++;
        }
      });
  },
});

// Export actions
export const {
  setSelectedMessage,
  setFilter,
  updateRealTimeConnection,
  updateBulkProgress,
  addToRetryQueue,
  removeFromRetryQueue,
  updateMetrics,
} = messagesSlice.actions;

// Export selectors
export const {
  selectAll: selectAllMessages,
  selectById: selectMessageById,
  selectIds: selectMessageIds,
} = messagesAdapter.getSelectors<RootState>((state) => state.messages);

// Custom selectors
export const selectFailedMessages = (state: RootState) =>
  selectAllMessages(state).filter(message => message.status === MessageStatus.FAILED);

export const selectMessagesByStatus = (state: RootState, status: MessageStatus) =>
  selectAllMessages(state).filter(message => message.status === status);

export const selectMessagesMetrics = (state: RootState) => state.messages.metrics;

export const selectMessageLoadingState = (state: RootState) => ({
  loading: state.messages.loading,
  error: state.messages.error,
});

// Export reducer
export default messagesSlice.reducer;