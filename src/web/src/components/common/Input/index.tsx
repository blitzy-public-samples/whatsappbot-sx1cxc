import React, { useCallback, useState, forwardRef, memo } from 'react'; // v18.2.0
import { InputContainer, StyledInput, InputLabel, ErrorMessage } from './styles';
import { BaseComponentProps } from '../../../types/common';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';

export interface InputProps extends BaseComponentProps {
  /** Input name attribute */
  name: string;
  /** Input label text */
  label: string;
  /** Current input value */
  value: string;
  /** Input type */
  type?: InputType;
  /** Error message to display */
  error?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input is required */
  required?: boolean;
  /** Whether the input is read-only */
  readonly?: boolean;
  /** Full width flag */
  fullWidth?: boolean;
  /** Custom validation function */
  validate?: (value: string) => string | undefined;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Focus handler */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Blur handler */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum length */
  maxLength?: number;
  /** Minimum length */
  minLength?: number;
  /** Pattern for validation */
  pattern?: string;
  /** Auto-complete attribute */
  autoComplete?: string;
}

export const Input = memo(forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const {
    name,
    label,
    value,
    type = 'text',
    error,
    disabled = false,
    required = false,
    readonly = false,
    fullWidth = false,
    validate,
    onChange,
    onFocus,
    onBlur,
    placeholder,
    maxLength,
    minLength,
    pattern,
    autoComplete,
    className,
    style,
    id,
    testId,
    ariaLabel,
  } = props;

  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>();

  // Combine external and internal error states
  const displayError = error || (touched && validationError);
  const hasValue = value !== '';

  // Handle input validation
  const validateInput = useCallback((inputValue: string) => {
    if (validate) {
      const validationResult = validate(inputValue);
      setValidationError(validationResult);
      return validationResult;
    }
    return undefined;
  }, [validate]);

  // Handle focus event
  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(event);
  }, [onFocus]);

  // Handle blur event
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    setTouched(true);
    validateInput(event.target.value);
    onBlur?.(event);
  }, [onBlur, validateInput]);

  // Handle change event
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    validateInput(newValue);
    onChange?.(newValue);
  }, [onChange, validateInput]);

  // Generate unique IDs for accessibility
  const inputId = id || `input-${name}`;
  const errorId = `${inputId}-error`;
  const labelId = `${inputId}-label`;

  return (
    <InputContainer
      className={className}
      style={style}
      fullWidth={fullWidth}
      data-testid={testId}
    >
      <StyledInput
        ref={ref}
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        readOnly={readonly}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        minLength={minLength}
        pattern={pattern}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        aria-invalid={!!displayError}
        aria-required={required}
        aria-readonly={readonly}
        aria-disabled={disabled}
        aria-describedby={displayError ? errorId : undefined}
        error={!!displayError}
        focused={focused}
        hasValue={hasValue}
      />
      <InputLabel
        htmlFor={inputId}
        id={labelId}
        error={!!displayError}
        focused={focused}
        hasValue={hasValue}
        disabled={disabled}
        data-required={required}
      >
        {label}
      </InputLabel>
      {displayError && (
        <ErrorMessage
          id={errorId}
          role="alert"
          aria-live="polite"
        >
          {displayError}
        </ErrorMessage>
      )}
    </InputContainer>
  );
}));

Input.displayName = 'Input';

export default Input;