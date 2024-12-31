// React and core dependencies
import React, { useState, useCallback } from 'react';
import { useFormik } from 'formik'; // v2.4.5
import * as yup from 'yup'; // v1.3.2

// Styled components
import {
  FormContainer,
  FormTitle,
  FormField,
  SubmitButton,
  ErrorMessage,
} from './styles';

// Types and interfaces
interface User {
  id: string;
  email: string;
  role: string;
}

interface LoginFormProps {
  onSuccess?: (user: User) => void;
  rememberMe?: boolean;
  enableMFA?: boolean;
}

// Validation schema with security requirements
const loginValidationSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .max(255, 'Email must not exceed 255 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
});

// Rate limiting configuration
const RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
};

/**
 * LoginForm Component
 * Implements secure authentication with rate limiting and MFA support
 */
export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  rememberMe = false,
  enableMFA = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);

  // Check rate limiting
  const checkRateLimit = useCallback((): boolean => {
    if (!lastAttemptTime) return true;
    
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTime;
    
    if (loginAttempts >= RATE_LIMIT.maxAttempts && 
        timeSinceLastAttempt < RATE_LIMIT.windowMs) {
      return false;
    }
    
    if (timeSinceLastAttempt >= RATE_LIMIT.windowMs) {
      setLoginAttempts(0);
    }
    
    return true;
  }, [loginAttempts, lastAttemptTime]);

  // Form handling with Formik
  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: loginValidationSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      try {
        if (!checkRateLimit()) {
          setErrors({
            email: `Too many login attempts. Please try again in ${
              Math.ceil((RATE_LIMIT.windowMs - (Date.now() - (lastAttemptTime || 0))) / 60000)
            } minutes`,
          });
          return;
        }

        setIsLoading(true);
        setLoginAttempts(prev => prev + 1);
        setLastAttemptTime(Date.now());

        // Simulated API call - replace with actual authentication logic
        const response = await new Promise<User>((resolve, reject) => {
          setTimeout(() => {
            if (values.email === 'test@example.com') {
              resolve({
                id: '1',
                email: values.email,
                role: 'user',
              });
            } else {
              reject(new Error('Invalid credentials'));
            }
          }, 1000);
        });

        // Handle MFA if enabled
        if (enableMFA) {
          // Implement MFA logic here
          console.log('MFA enabled, additional verification required');
        }

        // Handle successful login
        if (rememberMe) {
          // Implement remember me logic
          localStorage.setItem('rememberMe', 'true');
        }

        onSuccess?.(response);
      } catch (error) {
        setErrors({
          email: 'Invalid email or password',
        });
      } finally {
        setIsLoading(false);
        setSubmitting(false);
      }
    },
  });

  return (
    <FormContainer>
      <FormTitle>Sign In</FormTitle>
      <form onSubmit={formik.handleSubmit} noValidate>
        <FormField error={!!(formik.touched.email && formik.errors.email)}>
          <label htmlFor="email">
            <span className="sr-only">Email Address</span>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              aria-label="Email Address"
              aria-invalid={!!(formik.touched.email && formik.errors.email)}
              aria-describedby={formik.errors.email ? "email-error" : undefined}
              placeholder="Email Address"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.email}
              disabled={isLoading}
            />
          </label>
          {formik.touched.email && formik.errors.email && (
            <ErrorMessage id="email-error" role="alert">
              {formik.errors.email}
            </ErrorMessage>
          )}
        </FormField>

        <FormField error={!!(formik.touched.password && formik.errors.password)}>
          <label htmlFor="password">
            <span className="sr-only">Password</span>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-label="Password"
              aria-invalid={!!(formik.touched.password && formik.errors.password)}
              aria-describedby={formik.errors.password ? "password-error" : undefined}
              placeholder="Password"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.password}
              disabled={isLoading}
            />
          </label>
          {formik.touched.password && formik.errors.password && (
            <ErrorMessage id="password-error" role="alert">
              {formik.errors.password}
            </ErrorMessage>
          )}
        </FormField>

        <SubmitButton
          type="submit"
          disabled={!formik.isValid || formik.isSubmitting || isLoading}
          loading={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </SubmitButton>
      </form>
    </FormContainer>
  );
};

export default LoginForm;