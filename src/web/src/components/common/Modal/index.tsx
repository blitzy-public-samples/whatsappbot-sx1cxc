// @version React ^18.2.0
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom'; // @version react-dom ^18.2.0
import { Button } from '../Button';
import { Size, BaseComponentProps } from '../../../types/common';
import {
  ModalOverlay,
  ModalContainer,
  ModalHeader,
  ModalContent,
  ModalFooter
} from './styles';

/**
 * Interface for Modal component props extending BaseComponentProps
 */
interface ModalProps extends BaseComponentProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Callback function when modal closes */
  onClose: () => void;
  /** Modal title for header */
  title?: string;
  /** Modal size variant */
  size?: Size;
  /** Modal content */
  children: React.ReactNode;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Controls if clicking overlay closes modal */
  closeOnOverlayClick?: boolean;
  /** Controls visibility of close button */
  showCloseButton?: boolean;
  /** Element to receive focus when modal opens */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Element to receive focus when modal closes */
  finalFocusRef?: React.RefObject<HTMLElement>;
  /** Z-index for nested modals */
  stackIndex?: number;
  /** Text direction for RTL support */
  direction?: 'ltr' | 'rtl';
}

/**
 * Custom hook for managing focus trap within modal
 */
const useFocusTrap = (
  modalRef: React.RefObject<HTMLDivElement>,
  isOpen: boolean,
  initialFocusRef?: React.RefObject<HTMLElement>
) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store current active element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Set initial focus
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }

      return () => {
        // Restore focus on unmount
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, initialFocusRef, modalRef]);

  // Handle tab key navigation
  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (!modalRef.current || !isOpen) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }
  }, [isOpen, modalRef]);

  useEffect(() => {
    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [handleTabKey]);
};

/**
 * Enterprise-grade Modal component with enhanced accessibility and animation features
 */
export const Modal = React.memo<ModalProps>(({
  isOpen,
  onClose,
  title,
  size = Size.MEDIUM,
  children,
  footer,
  closeOnOverlayClick = true,
  showCloseButton = true,
  initialFocusRef,
  finalFocusRef,
  stackIndex = 0,
  direction = 'ltr',
  className,
  style,
  id,
  testId,
  ariaLabel
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // Initialize focus trap
  useFocusTrap(modalRef, isOpen, initialFocusRef);

  // Create portal container
  useEffect(() => {
    if (!portalRef.current) {
      portalRef.current = document.createElement('div');
      portalRef.current.setAttribute('data-modal-container', '');
      document.body.appendChild(portalRef.current);
    }

    return () => {
      if (portalRef.current) {
        document.body.removeChild(portalRef.current);
        portalRef.current = null;
      }
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
      if (finalFocusRef?.current) {
        finalFocusRef.current.focus();
      }
    }, 200); // Match animation duration
  }, [onClose, finalFocusRef]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      handleClose();
    }
  }, [closeOnOverlayClick, handleClose]);

  if (!isOpen && !isClosing) return null;

  const modal = (
    <ModalOverlay
      onClick={handleOverlayClick}
      isClosing={isClosing}
      style={{ zIndex: 1000 + stackIndex }}
      data-testid={testId}
      dir={direction}
    >
      <ModalContainer
        ref={modalRef}
        size={size}
        isClosing={isClosing}
        className={className}
        style={style}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `modal-title-${id}` : undefined}
        aria-label={!title ? ariaLabel : undefined}
      >
        {(title || showCloseButton) && (
          <ModalHeader>
            {title && (
              <h2 id={`modal-title-${id}`}>{title}</h2>
            )}
            {showCloseButton && (
              <Button
                variant="secondary"
                size={Size.SMALL}
                onClick={handleClose}
                ariaLabel="Close modal"
              >
                ✕
              </Button>
            )}
          </ModalHeader>
        )}
        <ModalContent>
          {children}
        </ModalContent>
        {footer && (
          <ModalFooter>
            {footer}
          </ModalFooter>
        )}
      </ModalContainer>
    </ModalOverlay>
  );

  return portalRef.current ? createPortal(modal, portalRef.current) : null;
});

Modal.displayName = 'Modal';

export default Modal;