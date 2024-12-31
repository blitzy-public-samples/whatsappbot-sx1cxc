import React from 'react'; // ^18.2.0
import { SelectContainer, SelectInput, SelectLabel, SelectError } from './styles';
import { Size, Variant, BaseComponentProps } from '../../../types/common';

interface SelectProps extends BaseComponentProps {
  /** The label text for the select input */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Size variant of the select */
  size?: Size;
  /** Visual variant of the select */
  variant?: Variant;
  /** Current selected value */
  value: string;
  /** Callback fired when the value changes */
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  /** Array of options to display */
  options: Array<{ value: string; label: string }>;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Whether the select is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Name attribute for the select element */
  name?: string;
  /** ID for the select element */
  id?: string;
  /** Additional class name */
  className?: string;
  /** Aria label for accessibility */
  'aria-label'?: string;
  /** ID of element that describes the select */
  'aria-describedby'?: string;
}

/**
 * A Material Design select component that provides an accessible dropdown selection interface
 * with comprehensive state management and error handling.
 * 
 * @component
 * @example
 * ```tsx
 * <Select
 *   label="Country"
 *   value={selectedCountry}
 *   onChange={handleCountryChange}
 *   options={[
 *     { value: 'us', label: 'United States' },
 *     { value: 'uk', label: 'United Kingdom' }
 *   ]}
 * />
 * ```
 */
export const Select = React.memo<SelectProps>(({
  label,
  error,
  size = Size.MEDIUM,
  variant = Variant.PRIMARY,
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  placeholder,
  name,
  id: providedId,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  style,
  testId,
}) => {
  // Generate unique IDs for accessibility
  const uniqueId = React.useId();
  const selectId = providedId || `select-${uniqueId}`;
  const errorId = error ? `${selectId}-error` : undefined;
  const labelId = label ? `${selectId}-label` : undefined;

  // Convert size enum to style prop
  const sizeMap = {
    [Size.SMALL]: 'small',
    [Size.MEDIUM]: 'medium',
    [Size.LARGE]: 'large',
  };

  // Convert variant enum to style prop
  const variantMap = {
    [Variant.PRIMARY]: 'outlined',
    [Variant.SECONDARY]: 'filled',
    [Variant.SUCCESS]: 'outlined',
    [Variant.WARNING]: 'outlined',
    [Variant.ERROR]: 'outlined',
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent<HTMLSelectElement>) => {
    switch (event.key) {
      case 'Space':
      case 'Enter':
        // Native select handles these
        break;
      case 'Escape':
        event.currentTarget.blur();
        break;
      default:
        break;
    }
  };

  return (
    <SelectContainer
      className={className}
      style={style}
      size={sizeMap[size]}
      variant={variantMap[variant]}
      data-testid={testId}
    >
      {label && (
        <SelectLabel
          htmlFor={selectId}
          id={labelId}
          error={!!error}
          required={required}
        >
          {label}
        </SelectLabel>
      )}

      <SelectInput
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        required={required}
        error={!!error}
        size={sizeMap[size]}
        variant={variantMap[variant]}
        aria-label={ariaLabel || label}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={[
          ariaDescribedBy,
          errorId,
          labelId
        ].filter(Boolean).join(' ') || undefined}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map(({ value: optionValue, label: optionLabel }) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </SelectInput>

      {error && (
        <SelectError
          id={errorId}
          role="alert"
        >
          {error}
        </SelectError>
      )}
    </SelectContainer>
  );
});

Select.displayName = 'Select';

export default Select;