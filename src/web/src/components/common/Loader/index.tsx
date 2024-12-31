// @version React ^18.2.0
import React, { useEffect, useRef } from 'react';
import { Size } from '../../types/common';
import { LoaderContainer, SpinnerWrapper, Spinner } from './styles';

/**
 * Interface for Loader component props with comprehensive accessibility support
 */
interface LoaderProps {
  /** Size variant of the loader - SMALL, MEDIUM, or LARGE */
  size?: Size;
  /** Custom color for the spinner - defaults to theme primary color */
  color?: string;
  /** Whether to display loader in fullscreen overlay mode */
  fullscreen?: boolean;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Test ID for component testing */
  testId?: string;
  /** Custom accessibility label for screen readers */
  ariaLabel?: string;
}

/**
 * Enhanced loading spinner component with comprehensive accessibility support
 * and performance optimizations. Follows Material Design guidelines and supports
 * reduced motion preferences.
 *
 * @param props - LoaderProps interface properties
 * @returns JSX.Element - Rendered loader component
 */
const Loader: React.FC<LoaderProps> = ({
  size = Size.MEDIUM,
  color,
  fullscreen = false,
  className,
  testId = 'loader',
  ariaLabel,
}) => {
  // Ref for the loader container to manage focus
  const loaderRef = useRef<HTMLDivElement>(null);

  // Effect to manage focus when fullscreen mode is active
  useEffect(() => {
    if (fullscreen && loaderRef.current) {
      // Store previous focus
      const previousFocus = document.activeElement as HTMLElement;
      // Focus the loader
      loaderRef.current.focus();

      // Restore focus on cleanup
      return () => {
        previousFocus?.focus();
      };
    }
  }, [fullscreen]);

  // Convert size enum to style variant
  const getSizeVariant = (size: Size): string => {
    switch (size) {
      case Size.SMALL:
        return 'small';
      case Size.LARGE:
        return 'large';
      default:
        return 'medium';
    }
  };

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <LoaderContainer
      ref={loaderRef}
      fullscreen={fullscreen}
      className={className}
      data-testid={testId}
      ariaLabel={ariaLabel || 'Content is loading...'}
      tabIndex={fullscreen ? 0 : -1} // Make focusable only when fullscreen
      role="progressbar"
      aria-busy="true"
      aria-live="polite"
    >
      <SpinnerWrapper
        size={getSizeVariant(size)}
        aria-hidden="true" // Hide from screen readers as container has aria-label
      >
        <Spinner
          color={color}
          duration={prefersReducedMotion ? 1.5 : 0.8}
          data-testid={`${testId}-spinner`}
        />
      </SpinnerWrapper>
    </LoaderContainer>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(Loader);

// Export size variants for external usage
export { Size as LoaderSize };