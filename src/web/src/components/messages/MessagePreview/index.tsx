import React, { memo, useCallback, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { PreviewContainer, PreviewHeader, PreviewContent, VariableHighlight, MediaPreview } from './styles';
import { Message } from '../../../types/messages';

// @version react ^18.2.0
// @version react-intersection-observer ^9.0.0

/**
 * Interface for message preview component props
 */
interface MessagePreviewProps {
  /** Message object containing content and metadata */
  message: Message;
  /** Optional CSS class name */
  className?: string;
  /** Text direction for content rendering */
  direction?: 'ltr' | 'rtl';
  /** Callback for media load events */
  onMediaLoad?: (success: boolean) => void;
  /** Enhanced accessibility mode */
  accessibilityMode?: 'high-contrast' | 'screen-reader' | 'default';
}

/**
 * Error messages for various failure scenarios
 */
const ERROR_MESSAGES = {
  INVALID_TEMPLATE: 'Invalid template format',
  MEDIA_LOAD_FAILED: 'Failed to load media attachment',
  MISSING_VARIABLES: 'Template variables are missing',
  MEDIA_NOT_SUPPORTED: 'Media type not supported'
} as const;

/**
 * MessagePreview component for rendering WhatsApp message previews
 * with enhanced template support and accessibility features
 */
const MessagePreview: React.FC<MessagePreviewProps> = memo(({
  message,
  className,
  direction = 'ltr',
  onMediaLoad,
  accessibilityMode = 'default'
}) => {
  // Intersection observer for lazy loading media
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1
  });

  /**
   * Renders template variables with proper highlighting and accessibility
   */
  const renderTemplateContent = useCallback((content: string, variables: Record<string, unknown>) => {
    const parts = content.split(/(\{[^}]+\})/g);
    
    return parts.map((part, index) => {
      const isVariable = /^\{([^}]+)\}$/.test(part);
      
      if (isVariable) {
        const varName = part.slice(1, -1);
        const value = variables[varName];
        
        return (
          <VariableHighlight
            key={`var-${index}`}
            role="text"
            aria-label={`Template variable ${varName}: ${value}`}
            tabIndex={0}
          >
            {value?.toString() || part}
          </VariableHighlight>
        );
      }
      
      return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
    });
  }, []);

  /**
   * Handles media attachment preview rendering with lazy loading
   */
  const renderMediaPreview = useCallback(() => {
    if (!message.content.mediaUrl) return null;

    const handleMediaLoad = (success: boolean) => {
      onMediaLoad?.(success);
    };

    const mediaContent = () => {
      switch (message.content.mediaType) {
        case 'image':
          return (
            <img
              src={inView ? message.content.mediaUrl : ''}
              alt={message.content.caption || 'Message image'}
              onLoad={() => handleMediaLoad(true)}
              onError={() => handleMediaLoad(false)}
              loading="lazy"
            />
          );
        case 'video':
          return (
            <video
              src={inView ? message.content.mediaUrl : ''}
              controls
              onLoadedData={() => handleMediaLoad(true)}
              onError={() => handleMediaLoad(false)}
              aria-label={message.content.caption || 'Message video'}
            />
          );
        default:
          return (
            <div role="alert" aria-label={ERROR_MESSAGES.MEDIA_NOT_SUPPORTED}>
              Unsupported media type
            </div>
          );
      }
    };

    return (
      <MediaPreview ref={ref} role="img" aria-label="Media attachment">
        {mediaContent()}
        {message.content.caption && (
          <div aria-label="Media caption" className="caption">
            {message.content.caption}
          </div>
        )}
      </MediaPreview>
    );
  }, [message.content, inView, onMediaLoad]);

  /**
   * Memoized message content based on type and template
   */
  const messageContent = useMemo(() => {
    if (message.type === 'TEMPLATE' && message.template) {
      return renderTemplateContent(
        message.template.content,
        message.template.variables
      );
    }
    return message.content.text;
  }, [message, renderTemplateContent]);

  return (
    <PreviewContainer
      className={className}
      elevation={2}
      role="article"
      aria-label="Message preview"
      dir={direction}
      data-accessibility-mode={accessibilityMode}
    >
      <PreviewHeader>
        <span role="heading" aria-level={2}>
          Message Preview
        </span>
        {message.type === 'TEMPLATE' && (
          <span aria-label="Template name">
            Template: {message.template?.name}
          </span>
        )}
      </PreviewHeader>
      
      <PreviewContent>
        <div role="textbox" aria-multiline="true">
          {messageContent}
        </div>
        {renderMediaPreview()}
      </PreviewContent>
    </PreviewContainer>
  );
});

// Display name for debugging
MessagePreview.displayName = 'MessagePreview';

export default MessagePreview;

// Type export for component props
export type { MessagePreviewProps };