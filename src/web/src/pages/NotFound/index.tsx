/**
 * @fileoverview A comprehensive 404 Not Found page component that provides user-friendly
 * error messages, multiple navigation options, and accessibility features while
 * maintaining consistent design system principles.
 * @version 1.0.0
 * @license MIT
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import MainLayout from '../../layouts/MainLayout';
import Button from '../../components/common/Button';
import { Size, Variant } from '../../types/common';
import { theme } from '../../config/theme';

// Styled components for the 404 page
const NotFoundContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 64px);
  padding: ${theme.spacing(4)}px;
  text-align: center;

  @media (max-width: ${theme.breakpoints.values.sm}px) {
    padding: ${theme.spacing(2)}px;
    min-height: calc(100vh - 56px);
  }
`;

const ErrorCode = styled.h1`
  font-size: 6rem;
  color: ${theme.palette.primary.main};
  margin: 0;
  font-weight: ${theme.typography.fontWeightBold};

  @media (max-width: ${theme.breakpoints.values.sm}px) {
    font-size: 4rem;
  }
`;

const ErrorMessage = styled.h2`
  font-size: 2rem;
  color: ${theme.palette.text.primary};
  margin: ${theme.spacing(2)}px 0;
  font-weight: ${theme.typography.fontWeightMedium};

  @media (max-width: ${theme.breakpoints.values.sm}px) {
    font-size: 1.5rem;
  }
`;

const ErrorDescription = styled.p`
  font-size: 1.125rem;
  color: ${theme.palette.text.secondary};
  margin: ${theme.spacing(2)}px 0 ${theme.spacing(4)}px;
  max-width: 600px;
  line-height: 1.6;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: ${theme.spacing(2)}px;
  margin-top: ${theme.spacing(2)}px;

  @media (max-width: ${theme.breakpoints.values.sm}px) {
    flex-direction: column;
    width: 100%;
    max-width: 300px;
  }
`;

/**
 * NotFound component that displays a user-friendly 404 error page with
 * multiple navigation options and accessibility features.
 */
const NotFound: React.FC = React.memo(() => {
  const navigate = useNavigate();

  /**
   * Handles navigation back to the dashboard
   */
  const handleBackToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  /**
   * Handles browser back navigation
   */
  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  /**
   * Effect for setting page title and meta description
   */
  useEffect(() => {
    document.title = '404 - Page Not Found | WhatsApp Web Enhancement';
    
    // Update meta description for SEO
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'The requested page could not be found. Please check the URL or navigate back to the dashboard.'
      );
    }
  }, []);

  /**
   * Effect for handling keyboard navigation
   */
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleGoBack();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleGoBack]);

  return (
    <MainLayout>
      <NotFoundContainer role="main" aria-labelledby="error-title">
        <ErrorCode aria-hidden="true">404</ErrorCode>
        
        <ErrorMessage id="error-title">
          Page Not Found
        </ErrorMessage>
        
        <ErrorDescription>
          The page you're looking for doesn't exist or has been moved.
          Please check the URL or use the navigation options below.
        </ErrorDescription>
        
        <ButtonContainer>
          <Button
            variant={Variant.PRIMARY}
            size={Size.LARGE}
            onClick={handleBackToDashboard}
            aria-label="Return to dashboard"
          >
            Back to Dashboard
          </Button>
          
          <Button
            variant={Variant.SECONDARY}
            size={Size.LARGE}
            onClick={handleGoBack}
            aria-label="Go back to previous page"
          >
            Go Back
          </Button>
        </ButtonContainer>
      </NotFoundContainer>
    </MainLayout>
  );
});

// Display name for debugging
NotFound.displayName = 'NotFound';

export default NotFound;