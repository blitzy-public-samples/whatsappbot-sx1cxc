import styled from 'styled-components';
import Card from '../../common/Card';

// @version styled-components ^5.3.10

/**
 * Main container for the message preview, extending the base Card component
 * with WhatsApp-specific styling and responsive design
 */
export const PreviewContainer = styled(Card)`
  width: 100%;
  max-width: 600px;
  margin: ${({ theme }) => theme.spacing(3)}px auto;
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${({ theme }) => theme.shape.borderRadiusLarge}px;
  box-shadow: ${({ theme, elevation }) => 
    elevation ? theme.shadows[elevation] : theme.shadows[1]};
  transition: box-shadow ${({ theme }) => theme.transitions.duration.standard}ms 
    ${({ theme }) => theme.transitions.easing.easeInOut};
  
  @media (prefers-color-scheme: dark) {
    background-color: ${({ theme }) => theme.palette.background.default};
    border: 1px solid ${({ theme }) => theme.palette.divider};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    margin: ${({ theme }) => theme.spacing(2)}px auto;
    border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  }

  &:hover {
    box-shadow: ${({ theme }) => theme.shadows[4]};
  }

  [dir='rtl'] & {
    text-align: right;
  }
`;

/**
 * Header section of the message preview with proper contrast and RTL support
 */
export const PreviewHeader = styled.div`
  padding: ${({ theme }) => `${theme.spacing(2)}px ${theme.spacing(3)}px`};
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  background-color: ${({ theme }) => theme.palette.primary.main};
  color: ${({ theme }) => theme.palette.primary.contrastText};
  border-top-left-radius: ${({ theme }) => theme.shape.borderRadiusLarge}px;
  border-top-right-radius: ${({ theme }) => theme.shape.borderRadiusLarge}px;
  font-size: ${({ theme }) => theme.typography.body1.fontSize};
  font-weight: ${({ theme }) => theme.typography.fontWeightMedium};
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  @media (prefers-color-scheme: dark) {
    background-color: ${({ theme }) => theme.palette.primary.dark};
    border-bottom-color: ${({ theme }) => 
      theme.palette.divider};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    padding: ${({ theme }) => `${theme.spacing(1.5)}px ${theme.spacing(2)}px`};
    border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  }

  [dir='rtl'] & {
    flex-direction: row-reverse;
  }
`;

/**
 * Content section of the message preview with proper text handling and spacing
 */
export const PreviewContent = styled.div`
  padding: ${({ theme }) => theme.spacing(3)}px;
  font-size: ${({ theme }) => theme.typography.body1.fontSize};
  line-height: 1.6;
  color: ${({ theme }) => theme.palette.text.primary};
  white-space: pre-wrap;
  word-break: break-word;
  
  @media (prefers-color-scheme: dark) {
    color: ${({ theme }) => theme.palette.text.primary};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    padding: ${({ theme }) => theme.spacing(2)}px;
  }

  [dir='rtl'] & {
    text-align: right;
  }
`;

/**
 * Styled component for template variables with proper highlighting and focus states
 */
export const VariableHighlight = styled.span`
  background-color: ${({ theme }) => theme.palette.primary.light};
  color: ${({ theme }) => theme.palette.primary.contrastText};
  padding: 2px ${({ theme }) => theme.spacing(1)}px;
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  font-weight: ${({ theme }) => theme.typography.fontWeightMedium};
  margin: 0 ${({ theme }) => theme.spacing(0.5)}px;
  transition: background-color ${({ theme }) => 
    theme.transitions.duration.shorter}ms ${({ theme }) => 
    theme.transitions.easing.easeInOut};
  
  @media (prefers-color-scheme: dark) {
    background-color: ${({ theme }) => theme.palette.primary.dark};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }

  &:hover {
    background-color: ${({ theme }) => theme.palette.primary.dark};
  }
`;

/**
 * Media attachment preview container with responsive behavior
 */
export const MediaPreview = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)}px;
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  overflow: hidden;
  max-width: 100%;
  
  img, video {
    max-width: 100%;
    height: auto;
    display: block;
    object-fit: contain;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    margin-top: ${({ theme }) => theme.spacing(1.5)}px;
  }

  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }
`;