import styled from 'styled-components'; // v5.3.10
import '../../assets/styles/variables.css';
import '../../assets/styles/animations.css';

// Modal size configurations with responsive breakpoints
const modalSizes = {
  small: '400px',
  medium: '600px',
  large: '800px',
  mobile: '90vw'
} as const;

// Helper function to calculate modal width based on size and screen width
const getModalWidth = (size: keyof typeof modalSizes, screenWidth: number): string => {
  if (screenWidth < 600) {
    return modalSizes.mobile;
  }
  return modalSizes[size] || modalSizes.medium;
};

// Helper function for combined animation properties
const getModalAnimation = (animationType: 'enter' | 'exit', isClosing: boolean): string => {
  const direction = isClosing ? 'exit' : 'enter';
  return `
    animation: 
      fade-${direction} var(--transition-duration) var(--transition-timing),
      slide-up-${direction} var(--transition-duration) var(--transition-timing);
  `;
};

// Modal overlay with enhanced backdrop animation
export const ModalOverlay = styled.div<{ isClosing: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: var(--z-index-modal);
  ${({ isClosing }) => getModalAnimation('fade', isClosing)};
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: opacity var(--transition-duration) var(--transition-timing);
  }
`;

// Modal container with responsive sizing and RTL support
export const ModalContainer = styled.div<{
  size: keyof typeof modalSizes;
  isClosing: boolean;
}>`
  position: relative;
  width: ${({ size }) => getModalWidth(size, window.innerWidth)};
  max-width: 90vw;
  max-height: 90vh;
  background-color: var(--color-background);
  border-radius: var(--border-radius);
  box-shadow: var(--elevation-3);
  overflow: hidden;
  ${({ isClosing }) => getModalAnimation('slide-up', isClosing)};
  direction: inherit;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: opacity var(--transition-duration) var(--transition-timing);
  }

  @media (max-width: 600px) {
    width: ${modalSizes.mobile};
    margin: calc(var(--spacing-unit) * 2);
  }
`;

// Modal header with consistent spacing
export const ModalHeader = styled.div`
  padding: calc(var(--spacing-unit) * 2);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    margin: 0;
    font-size: var(--font-size-h4);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  button {
    margin-left: var(--spacing-unit);
  }

  [dir="rtl"] & button {
    margin-left: 0;
    margin-right: var(--spacing-unit);
  }
`;

// Modal content with enhanced scrolling behavior
export const ModalContent = styled.div`
  padding: calc(var(--spacing-unit) * 2);
  max-height: calc(90vh - 120px);
  overflow-y: auto;
  color: var(--color-text-primary);
  
  /* Enhanced scrollbar styling */
  scrollbar-width: thin;
  scrollbar-color: var(--color-secondary-light) transparent;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: var(--color-secondary-light);
    border-radius: 3px;
  }

  @media (max-width: 600px) {
    max-height: calc(90vh - 180px);
    padding: calc(var(--spacing-unit) * 1.5);
  }
`;

// Modal footer with flexible layout
export const ModalFooter = styled.div`
  padding: calc(var(--spacing-unit) * 2);
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-unit);

  [dir="rtl"] & {
    flex-direction: row-reverse;
  }

  @media (max-width: 600px) {
    padding: calc(var(--spacing-unit) * 1.5);
    flex-direction: column;
    gap: calc(var(--spacing-unit) * 1.5);

    button {
      width: 100%;
    }
  }
`;