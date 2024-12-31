import styled from 'styled-components'; // v5.3.0
import '../../../assets/styles/variables.css';

// Constants for component dimensions and breakpoints
const EDITOR_MIN_HEIGHT = '400px';
const TOOLBAR_HEIGHT = '48px';
const VARIABLE_PANEL_WIDTH = '280px';

const BREAKPOINTS = {
  xs: '0px',
  sm: '600px',
  md: '960px',
  lg: '1280px',
  xl: '1920px'
} as const;

const TRANSITIONS = {
  standard: '0.3s cubic-bezier(0.4, 0, 0.2, 1)'
} as const;

// Helper function for generating responsive styles
const createResponsiveStyles = (styleConfig: Record<keyof typeof BREAKPOINTS, string>) => {
  return Object.entries(styleConfig)
    .map(([breakpoint, styles]) => {
      const minWidth = BREAKPOINTS[breakpoint as keyof typeof BREAKPOINTS];
      return `
        @media (min-width: ${minWidth}) {
          ${styles}
        }
      `;
    })
    .join('');
};

// Main container for the template editor
export const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  border-radius: var(--border-radius);
  box-shadow: var(--elevation-1);
  min-height: ${EDITOR_MIN_HEIGHT};
  margin: var(--spacing-md);
  font-family: var(--font-family-primary);
  position: relative;
  transition: box-shadow ${TRANSITIONS.standard};

  &:hover {
    box-shadow: var(--elevation-2);
  }

  ${createResponsiveStyles({
    xs: `
      margin: var(--spacing-sm);
      width: calc(100% - var(--spacing-md));
    `,
    sm: `
      margin: var(--spacing-md);
      width: calc(100% - var(--spacing-xl));
    `,
    md: `
      margin: var(--spacing-lg);
      width: calc(100% - var(--spacing-xl) * 2);
    `,
    lg: 'max-width: var(--container-max-width);',
    xl: 'margin: var(--spacing-xl) auto;'
  })}
`;

// Header section containing title and actions
export const EditorHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  min-height: ${TOOLBAR_HEIGHT};
  background-color: var(--color-background-paper);
  border-radius: var(--border-radius) var(--border-radius) 0 0;

  h2 {
    margin: 0;
    font-size: var(--font-size-h4);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  ${createResponsiveStyles({
    xs: `
      flex-direction: column;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm);
    `,
    sm: `
      flex-direction: row;
      padding: var(--spacing-md);
    `,
    md: '',
    lg: '',
    xl: ''
  })}
`;

// Main content area with rich text capabilities
export const EditorContent = styled.div`
  flex: 1;
  display: flex;
  position: relative;
  min-height: calc(${EDITOR_MIN_HEIGHT} - ${TOOLBAR_HEIGHT});
  background-color: var(--color-background);

  .editor-main {
    flex: 1;
    padding: var(--spacing-md);
    font-size: var(--font-size-body1);
    color: var(--color-text-primary);
    line-height: 1.5;
    outline: none;

    &:focus-visible {
      box-shadow: inset 0 0 0 2px var(--color-primary);
    }
  }

  ${createResponsiveStyles({
    xs: `
      flex-direction: column;
      padding: var(--spacing-sm);
    `,
    sm: `
      flex-direction: row;
      padding: var(--spacing-md);
    `,
    md: '',
    lg: '',
    xl: ''
  })}
`;

// Floating toolbar with formatting options
export const EditorToolbar = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  background-color: var(--color-secondary);
  border-radius: var(--border-radius);
  padding: var(--spacing-xs) var(--spacing-sm);
  box-shadow: var(--elevation-2);
  z-index: 10;
  transition: opacity ${TRANSITIONS.standard}, transform ${TRANSITIONS.standard};

  button {
    color: white;
    padding: var(--spacing-xs);
    margin: 0 var(--spacing-xs);
    border-radius: var(--border-radius);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color ${TRANSITIONS.standard};

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    &:active {
      background-color: rgba(255, 255, 255, 0.2);
    }
  }

  ${createResponsiveStyles({
    xs: `
      width: calc(100% - var(--spacing-md));
      transform: translateX(-50%) translateY(var(--spacing-md));
    `,
    sm: `
      width: auto;
      transform: translateX(-50%) translateY(calc(var(--spacing-md) * -1.5));
    `,
    md: '',
    lg: '',
    xl: ''
  })}
`;

// Collapsible side panel for template variables
export const VariablePanel = styled.div`
  width: ${VARIABLE_PANEL_WIDTH};
  background-color: var(--color-background-paper);
  border-left: 1px solid rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  transition: transform ${TRANSITIONS.standard};

  .panel-header {
    padding: var(--spacing-md);
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    font-weight: var(--font-weight-medium);
  }

  .variable-list {
    padding: var(--spacing-sm);
  }

  .variable-item {
    padding: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
    border-radius: var(--border-radius);
    background-color: var(--color-background);
    cursor: pointer;
    transition: background-color ${TRANSITIONS.standard};

    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }
  }

  ${createResponsiveStyles({
    xs: `
      width: 100%;
      border-left: none;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
    `,
    sm: `
      width: ${VARIABLE_PANEL_WIDTH};
      transform: translateX(${VARIABLE_PANEL_WIDTH});
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      
      &.open {
        transform: translateX(0);
      }
    `,
    md: '',
    lg: '',
    xl: ''
  })}
`;