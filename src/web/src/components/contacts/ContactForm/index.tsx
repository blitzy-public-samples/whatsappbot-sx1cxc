// @version React ^18.2.0
// @version react-hook-form ^7.45.0
// @version @hookform/resolvers/yup ^3.1.0
// @version yup ^1.2.0
// @version lodash ^4.17.21

import React, { useCallback, useEffect, useState } from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { debounce } from 'lodash';
import { 
  TextField, 
  Button, 
  CircularProgress, 
  Alert,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography
} from '@mui/material';

import { 
  FormContainer, 
  FormSection, 
  FormActions, 
  FormErrorBoundary 
} from './styles';
import { 
  Contact, 
  ContactFormData, 
  ContactValidation 
} from '../../../types/contacts';
import { useContacts } from '../../../hooks/useContacts';
import { LoadingState } from '../../../types/common';

// Phone number validation regex following E.164 format
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

// Form validation schema
const validationSchema = yup.object().shape({
  phoneNumber: yup
    .string()
    .required('Phone number is required')
    .matches(PHONE_REGEX, 'Phone number must be in E.164 format'),
  firstName: yup
    .string()
    .required('First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters'),
  lastName: yup
    .string()
    .required('Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format'),
  tags: yup
    .array()
    .of(yup.string())
    .min(0)
    .max(10, 'Maximum 10 tags allowed'),
  groupIds: yup
    .array()
    .of(yup.string())
    .min(0)
    .max(5, 'Maximum 5 groups allowed')
});

export interface ContactFormProps {
  contact?: Contact | null;
  onSubmit: (contact: Contact) => void;
  onCancel: () => void;
  isEdit?: boolean;
  validationRules?: ContactValidation;
  analyticsEnabled?: boolean;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  contact,
  onSubmit,
  onCancel,
  isEdit = false,
  validationRules,
  analyticsEnabled = true
}) => {
  // Form state management
  const methods = useForm<ContactFormData>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      phoneNumber: contact?.phoneNumber || '',
      firstName: contact?.firstName || '',
      lastName: contact?.lastName || '',
      email: contact?.email || '',
      tags: contact?.tags || [],
      groupIds: contact?.groupIds || []
    },
    mode: 'onChange'
  });

  const { handleSubmit, control, formState: { errors, isSubmitting, isDirty } } = methods;

  // Custom hooks
  const { actions: { createContact, updateContact }, loadingState } = useContacts();

  // Local state
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Handle form submission with optimistic updates
  const onSubmitForm = useCallback(async (formData: ContactFormData) => {
    try {
      setSubmitError(null);
      
      const contactData = {
        ...formData,
        // Ensure proper data formatting
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.toLowerCase().trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim()
      };

      let result;
      if (isEdit && contact) {
        result = await updateContact(contact.id, contactData);
      } else {
        result = await createContact(contactData);
      }

      // Track analytics if enabled
      if (analyticsEnabled) {
        window.gtag?.('event', isEdit ? 'contact_updated' : 'contact_created', {
          contact_id: result.id,
          form_completion_time: Date.now() - formStartTime
        });
      }

      onSubmit(result);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save contact');
      
      // Log error for monitoring
      console.error('[ContactForm] Submit error:', error);
    }
  }, [isEdit, contact, createContact, updateContact, onSubmit, analyticsEnabled]);

  // Debounced validation handler
  const handleValidation = debounce(async (fieldName: keyof ContactFormData, value: any) => {
    try {
      setIsValidating(true);
      await validationSchema.validateAt(fieldName, { [fieldName]: value });
    } catch (error) {
      // Validation errors are handled by react-hook-form
    } finally {
      setIsValidating(false);
    }
  }, 300);

  // Track form start time for analytics
  const formStartTime = React.useRef(Date.now());

  // Effect for handling validation rules updates
  useEffect(() => {
    if (validationRules) {
      // Update validation schema with custom rules
      const updatedSchema = validationSchema.concat(yup.object().shape(validationRules));
      methods.clearErrors();
    }
  }, [validationRules, methods]);

  return (
    <FormErrorBoundary>
      <FormProvider {...methods}>
        <FormContainer
          role="form"
          aria-label={isEdit ? 'Edit Contact Form' : 'New Contact Form'}
        >
          {submitError && (
            <Alert 
              severity="error" 
              onClose={() => setSubmitError(null)}
              sx={{ marginBottom: 2 }}
            >
              {submitError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmitForm)} noValidate>
            <FormSection>
              <Typography variant="h6" component="h2" gutterBottom>
                Contact Information
              </Typography>

              <Controller
                name="phoneNumber"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Phone Number"
                    required
                    fullWidth
                    error={!!errors.phoneNumber}
                    helperText={errors.phoneNumber?.message}
                    placeholder="+1234567890"
                    inputMode="tel"
                    onChange={(e) => {
                      field.onChange(e);
                      handleValidation('phoneNumber', e.target.value);
                    }}
                    margin="normal"
                    InputProps={{
                      'aria-label': 'Phone number',
                      'aria-invalid': !!errors.phoneNumber,
                      'aria-describedby': errors.phoneNumber ? 'phone-number-error' : undefined
                    }}
                  />
                )}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Controller
                  name="firstName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="First Name"
                      required
                      fullWidth
                      error={!!errors.firstName}
                      helperText={errors.firstName?.message}
                      margin="normal"
                      InputProps={{
                        'aria-label': 'First name',
                        'aria-invalid': !!errors.firstName,
                        'aria-describedby': errors.firstName ? 'first-name-error' : undefined
                      }}
                    />
                  )}
                />

                <Controller
                  name="lastName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Last Name"
                      required
                      fullWidth
                      error={!!errors.lastName}
                      helperText={errors.lastName?.message}
                      margin="normal"
                      InputProps={{
                        'aria-label': 'Last name',
                        'aria-invalid': !!errors.lastName,
                        'aria-describedby': errors.lastName ? 'last-name-error' : undefined
                      }}
                    />
                  )}
                />
              </Box>

              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Email"
                    required
                    fullWidth
                    type="email"
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    margin="normal"
                    InputProps={{
                      'aria-label': 'Email address',
                      'aria-invalid': !!errors.email,
                      'aria-describedby': errors.email ? 'email-error' : undefined
                    }}
                  />
                )}
              />
            </FormSection>

            <FormSection>
              <Typography variant="h6" component="h2" gutterBottom>
                Additional Information
              </Typography>

              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth margin="normal">
                    <InputLabel id="tags-label">Tags</InputLabel>
                    <Select
                      {...field}
                      labelId="tags-label"
                      multiple
                      error={!!errors.tags}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={value} />
                          ))}
                        </Box>
                      )}
                    >
                      {/* Add tag options here */}
                    </Select>
                    {errors.tags && (
                      <FormHelperText error>{errors.tags.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />

              <Controller
                name="groupIds"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth margin="normal">
                    <InputLabel id="groups-label">Groups</InputLabel>
                    <Select
                      {...field}
                      labelId="groups-label"
                      multiple
                      error={!!errors.groupIds}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={value} />
                          ))}
                        </Box>
                      )}
                    >
                      {/* Add group options here */}
                    </Select>
                    {errors.groupIds && (
                      <FormHelperText error>{errors.groupIds.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </FormSection>

            <FormActions>
              <Button
                onClick={onCancel}
                disabled={isSubmitting}
                variant="outlined"
                color="secondary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !isDirty || isValidating}
                variant="contained"
                color="primary"
                startIcon={isSubmitting && <CircularProgress size={20} />}
              >
                {isEdit ? 'Update Contact' : 'Create Contact'}
              </Button>
            </FormActions>
          </form>
        </FormContainer>
      </FormProvider>
    </FormErrorBoundary>
  );
};

export default ContactForm;