import styled from 'styled-components'; // v5.3.x
import '../../../assets/styles/variables.css';

// Helper function to determine status color
const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'success':
      return 'var(--color-success)';
    case 'failed':
    case 'error':
      return 'var(--color-error)';
    case 'pending':
    case 'sending':
      return 'var(--color-warning)';
    default:
      return 'var(--color-text-secondary)';
  }
};

export const MessageListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background-color: var(--color-background-paper);
  border-radius: var(--border-radius);
  box-shadow: var(--elevation-1);
  transition: box-shadow var(--transition-duration) var(--transition-timing);
  width: 100%;
  max-width: var(--container-max-width);
  margin: 0 auto;

  @media (min-width: var(--breakpoint-sm)) {
    padding: var(--spacing-lg);
  }

  @media (min-width: var(--breakpoint-md)) {
    gap: var(--spacing-lg);
  }
`;

export const MessageItem = styled.div`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background-color: var(--color-background);
  border-radius: var(--border-radius);
  box-shadow: var(--elevation-1);
  transition: all var(--transition-duration) var(--transition-timing);
  cursor: pointer;
  position: relative;

  &:hover {
    box-shadow: var(--elevation-2);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  /* Accessibility - Focus state */
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  @media (min-width: var(--breakpoint-sm)) {
    grid-template-columns: 1fr auto 120px;
    gap: var(--spacing-md);
  }
`;

export const MessageStatus = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  color: var(--color-background);
  background-color: ${props => getStatusColor(props.status)};
  text-transform: capitalize;

  /* Ensure minimum touch target size for mobile */
  min-height: 24px;
  
  @media (min-width: var(--breakpoint-sm)) {
    min-width: 80px;
    justify-content: center;
  }
`;

export const MessageTime = styled.span`
  color: var(--color-text-secondary);
  font-size: var(--font-size-caption);
  white-space: nowrap;
  
  @media (min-width: var(--breakpoint-sm)) {
    font-size: var(--font-size-body2);
  }
`;

export const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) 0;
  margin-top: var(--spacing-md);
  border-top: 1px solid rgba(0, 0, 0, 0.12);

  /* Ensure touch targets are large enough on mobile */
  button {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (min-width: var(--breakpoint-md)) {
    gap: var(--spacing-md);
    padding: var(--spacing-lg) 0;
  }
`;