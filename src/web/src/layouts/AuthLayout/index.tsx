import React, { useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components'; // ^5.3.11
import Card from '../../components/common/Card';
import logo from '../../assets/images/logo.svg';

// Styled components for layout structure
const Container = styled.main`
  min-height: calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 5vw, 24px);
  background: var(--auth-background, #f5f5f5);
  position: relative;
  overflow-x: hidden;
`;

const Logo = styled.img`
  margin-bottom: clamp(24px, 5vw, 32px);
  height: clamp(24px, 5vw, 32px);
  width: auto;
  user-select: none;
`;

const CardWrapper = styled.div`
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
`;

interface AuthLayoutProps extends React.PropsWithChildren {
  /** Optional title for the auth page */
  title?: string;
  /** Optional description for screen readers */
  description?: string;
}

/**
 * AuthLayout provides a consistent layout structure for authentication pages
 * with enhanced accessibility features and responsive design.
 *
 * @component
 * @version 1.0.0
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title = 'Authentication',
  description = 'Please authenticate to access the application'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      // Keep focus within the auth card when tabbing
      const focusableElements = cardRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, []);

  // Set up keyboard event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown]);

  // Focus management on mount
  useEffect(() => {
    const firstInput = cardRef.current?.querySelector(
      'input:not([type="hidden"]), button'
    ) as HTMLElement;
    
    if (firstInput) {
      firstInput.focus();
    }
  }, []);

  return (
    <Container
      ref={containerRef}
      role="main"
      aria-labelledby="auth-title"
    >
      <Logo
        src={logo}
        alt="WhatsApp Web Enhancement Application"
        role="img"
        draggable={false}
      />

      <CardWrapper ref={cardRef}>
        {/* Hidden title for screen readers */}
        <h1 id="auth-title" className="visually-hidden">
          {title}
        </h1>
        
        <Card
          elevation={2}
          size="medium"
          role="region"
          aria-label={description}
        >
          {children}
        </Card>
      </CardWrapper>

      {/* Skip link for keyboard navigation */}
      <div className="visually-hidden">
        <a href="#main-content" tabIndex={0}>
          Skip to main content
        </a>
      </div>

      {/* Inject global styles for accessibility */}
      <style>
        {`
          .visually-hidden {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }

          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }
        `}
      </style>
    </Container>
  );
};

export default AuthLayout;