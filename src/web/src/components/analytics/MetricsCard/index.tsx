import React, { useMemo } from 'react';
import { Tooltip, CircularProgress } from '@mui/material';
import { 
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Info as InfoIcon 
} from '@mui/icons-material';
import Card from '../../common/Card';
import {
  MetricsCardContainer,
  MetricsTitle,
  MetricsValue,
  MetricsChange
} from './styles';

/**
 * Props interface for the MetricsCard component
 */
interface MetricsCardProps {
  /** Title of the metric */
  title: string;
  /** Current value of the metric */
  value: number;
  /** Percentage change in the metric value */
  change: number;
  /** Optional function to format the displayed value */
  formatter?: (value: number) => string;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Custom tooltip content for detailed information */
  tooltipContent?: React.ReactNode;
  /** Threshold values for metric highlighting */
  thresholds?: {
    warning: number;
    critical: number;
  };
}

/**
 * Formats the change value as a percentage string
 * @param change - The change value to format
 * @returns Formatted percentage string
 */
const formatChange = (change: number): string => {
  if (!change && change !== 0) return '0%';
  
  const formattedValue = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'always'
  }).format(change);

  return `${formattedValue}%`;
};

/**
 * A reusable analytics metrics card component that displays metric values
 * with titles, values, and change indicators. Implements Material Design
 * specifications with enhanced accessibility and responsive design.
 *
 * @version 1.0.0
 * @component
 */
const MetricsCard: React.FC<MetricsCardProps> = React.memo(({
  title,
  value,
  change,
  formatter = (val: number) => val.toLocaleString(),
  isLoading = false,
  tooltipContent,
  thresholds
}) => {
  /**
   * Determines the appropriate trend icon based on change value
   */
  const TrendIcon = useMemo(() => {
    if (change > 0) return TrendingUpIcon;
    if (change < 0) return TrendingDownIcon;
    return TrendingFlatIcon;
  }, [change]);

  /**
   * Generates appropriate ARIA label for change indicator
   */
  const changeAriaLabel = useMemo(() => {
    const direction = change > 0 ? 'increase' : change < 0 ? 'decrease' : 'no change';
    return `${Math.abs(change)}% ${direction} from previous period`;
  }, [change]);

  /**
   * Determines if the value exceeds defined thresholds
   */
  const getThresholdStatus = useMemo(() => {
    if (!thresholds || !value) return 'normal';
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return 'normal';
  }, [value, thresholds]);

  return (
    <Card
      elevation={1}
      size="medium"
      role="region"
      aria-label={`${title} metrics card`}
    >
      <MetricsCardContainer>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <MetricsTitle>
            {title}
            {tooltipContent && (
              <Tooltip 
                title={tooltipContent}
                placement="top"
                arrow
              >
                <InfoIcon 
                  fontSize="small" 
                  style={{ 
                    marginLeft: '8px',
                    verticalAlign: 'middle',
                    cursor: 'help'
                  }} 
                />
              </Tooltip>
            )}
          </MetricsTitle>
        </div>

        {isLoading ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: '80px' 
          }}>
            <CircularProgress size={32} />
          </div>
        ) : (
          <>
            <MetricsValue
              role="text"
              aria-label={`Current value: ${formatter(value)}`}
              data-threshold={getThresholdStatus}
            >
              {formatter(value)}
            </MetricsValue>

            <MetricsChange
              change={change}
              aria-label={changeAriaLabel}
              role="status"
            >
              <TrendIcon aria-hidden="true" />
              {formatChange(change)}
            </MetricsChange>
          </>
        )}
      </MetricsCardContainer>
    </Card>
  );
});

// Display name for debugging
MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;

// Type export for component props
export type { MetricsCardProps };