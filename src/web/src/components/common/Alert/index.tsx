// @version React 18.2.x
import React, { memo, useCallback, useEffect, useState } from 'react';
// @version @mui/icons-material 5.14.x
import {
  CheckCircleOutline,
  ErrorOutline,
  InfoOutline,
  WarningAmberOutlined,
  Close as CloseIcon,
} from '@mui/icons-material';

import { Variant } from '../../../types/common';
import {
  AlertContainer,
  AlertContent,
  AlertIcon,
  AlertMessage,
  AlertVariant,
} from './styles';

/**
 * Interface for Alert component props with comprehensive accessibility support
 */
export interface AlertProps {
  /** The type of alert to display */
  variant: Variant;
  /** The message content of the alert */
  message: string;
  /** Optional callback when the alert is closed */
  onClose?: () => void;
  /** Optional duration in milliseconds before auto-hiding the alert */
  autoHideDuration?: number;
  /** ARIA role for the alert - defaults to 'alert' */
  role?: 'alert' | 'status' | 'log';
  /** ARIA live region setting */
  'aria-live'?: 'polite' | 'assertive';
  /** Custom aria-label for close button */
  closeButtonAriaLabel?: string;
  /** Text direction for RTL support */
  direction?: 'ltr' | 'rtl';
}

/**
 * Maps Variant enum to AlertVariant type for styling
 */
const variantMap: Record<Variant, AlertVariant> = {
  [Variant.SUCCESS]: 'success',
  [Variant.ERROR]: 'error',
  [Variant.WARNING]: 'warning',
  [Variant.INFO]: 'info',
  [Variant.PRIMARY]: 'info',
  [Variant.SECONDARY]: 'info',
};

/**
 * Memoized component that returns the appropriate icon based on alert variant
 */
const AlertIconComponent = memo(({ variant }: { variant: AlertVariant }) => {
  const iconProps = {
    'aria-hidden': 'true',
    fontSize: 'inherit',
  };

  switch (variant) {
    case 'success':
      return <CheckCircleOutline {...iconProps} />;
    case 'error':
      return <ErrorOutline {...iconProps} />;
    case 'warning':
      return <WarningAmberOutlined {...iconProps} />;
    case 'info':
    default:
      return <InfoOutline {...iconProps} />;
  }
});

AlertIconComponent.displayName = 'AlertIconComponent';

/**
 * Custom hook to manage alert visibility and animation states
 */
const useAlertAnimation = (
  autoHideDuration?: number,
  onClose?: () => void
): [boolean, () => void] => {
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Allow animation to complete before triggering onClose
    const animationTimeout = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300); // Match animation duration from styles

    return () => clearTimeout(animationTimeout);
  }, [onClose]);

  useEffect(() => {
    if (autoHideDuration) {
      const hideTimeout = setTimeout(handleClose, autoHideDuration);
      return () => clearTimeout(hideTimeout);
    }
  }, [autoHideDuration, handleClose]);

  return [isVisible, handleClose];
};

/**
 * Alert component that displays feedback messages with different severity levels
 * Implements WCAG 2.1 AA standards and Material Design principles
 */
export const Alert: React.FC<AlertProps> = memo(({
  variant,
  message,
  onClose,
  autoHideDuration,
  role = 'alert',
  'aria-live': ariaLive = 'polite',
  closeButtonAriaLabel = 'Close alert',
  direction = 'ltr',
}) => {
  const [isVisible, handleClose] = useAlertAnimation(autoHideDuration, onClose);
  const alertVariant = variantMap[variant];

  if (!isVisible) {
    return null;
  }

  return (
    <AlertContainer
      variant={alertVariant}
      role={role}
      aria-live={ariaLive}
      data-testid="alert-container"
      style={{ direction }}
    >
      <AlertContent variant={alertVariant}>
        <AlertIcon variant={alertVariant}>
          <AlertIconComponent variant={alertVariant} />
        </AlertIcon>
        
        <AlertMessage 
          variant={alertVariant}
          data-testid="alert-message"
        >
          {message}
        </AlertMessage>

        {onClose && (
          <button
            onClick={handleClose}
            aria-label={closeButtonAriaLabel}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
            data-testid="alert-close-button"
          >
            <CloseIcon 
              fontSize="small"
              aria-hidden="true"
            />
          </button>
        )}
      </AlertContent>
    </AlertContainer>
  );
});

Alert.displayName = 'Alert';

export default Alert;