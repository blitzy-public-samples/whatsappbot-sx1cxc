import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3'; // v7.8.5
import styled from 'styled-components'; // v6.0.7
import { debounce } from 'lodash'; // v4.17.21
import Card from '../../common/Card';
import { TimeRangeFilter } from '../../../types/analytics';

// Styled components for chart elements
const ChartContainer = styled.div`
  position: relative;
  width: 100%;
  height: ${props => props.height}px;
`;

const SVGContainer = styled.svg`
  width: 100%;
  height: 100%;
  overflow: visible;
`;

const Tooltip = styled.div`
  position: absolute;
  padding: 8px;
  background: ${props => props.theme.palette.background.paper};
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  pointer-events: none;
  z-index: 100;
  font-size: 12px;
  transition: opacity 0.2s;
`;

// Chart margin configuration
const MARGIN = { top: 20, right: 30, bottom: 30, left: 50 };

// Interface for data point structure
interface DataPoint {
  timestamp: Date;
  value: number;
}

// Props interface for the LineChart component
interface LineChartProps {
  data: DataPoint[];
  title: string;
  yAxisLabel: string;
  timeRange: TimeRangeFilter;
  color?: string;
  height?: number;
  animationDuration?: number;
  tooltipFormat?: (value: number) => string;
}

/**
 * Custom hook for managing chart dimensions
 */
const useChartDimensions = (defaultHeight: number) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({
    width: 0,
    height: defaultHeight,
    boundedWidth: 0,
    boundedHeight: 0,
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const width = containerRef.current.clientWidth;
      setDimensions({
        width,
        height: defaultHeight,
        boundedWidth: width - MARGIN.left - MARGIN.right,
        boundedHeight: defaultHeight - MARGIN.top - MARGIN.bottom,
      });
    };

    const debouncedUpdateDimensions = debounce(updateDimensions, 250);

    updateDimensions();
    window.addEventListener('resize', debouncedUpdateDimensions);

    return () => {
      window.removeEventListener('resize', debouncedUpdateDimensions);
      debouncedUpdateDimensions.cancel();
    };
  }, [defaultHeight]);

  return { dimensions, containerRef };
};

/**
 * LineChart component for visualizing time series data
 * with enterprise-grade features and accessibility support
 */
const LineChart: React.FC<LineChartProps> = React.memo(({
  data,
  title,
  yAxisLabel,
  timeRange,
  color = '#1976D2',
  height = 300,
  animationDuration = 300,
  tooltipFormat = (value: number) => value.toLocaleString(),
}) => {
  const { dimensions, containerRef } = useChartDimensions(height);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Memoized scales and line generator
  const { xScale, yScale, lineGenerator } = useMemo(() => {
    if (!dimensions.boundedWidth || !dimensions.boundedHeight) {
      return { xScale: null, yScale: null, lineGenerator: null };
    }

    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.timestamp) as [Date, Date])
      .range([0, dimensions.boundedWidth])
      .nice();

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) as number * 1.1])
      .range([dimensions.boundedHeight, 0])
      .nice();

    const lineGenerator = d3.line<DataPoint>()
      .x(d => xScale(d.timestamp))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    return { xScale, yScale, lineGenerator };
  }, [data, dimensions]);

  // Update chart when data or dimensions change
  useEffect(() => {
    if (!svgRef.current || !xScale || !yScale || !lineGenerator) return;

    const svg = d3.select(svgRef.current);
    
    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(d => d3.timeFormat(timeRange === 'last_24h' ? '%H:%M' : '%b %d')(d as Date));

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => d.toString());

    // Update axes
    svg.select<SVGGElement>('.x-axis')
      .transition()
      .duration(animationDuration)
      .call(xAxis);

    svg.select<SVGGElement>('.y-axis')
      .transition()
      .duration(animationDuration)
      .call(yAxis);

    // Update line path
    const path = svg.select<SVGPathElement>('.line-path')
      .datum(data)
      .attr('d', lineGenerator);

    const totalLength = path.node()?.getTotalLength() || 0;

    path
      .attr('stroke-dasharray', `${totalLength},${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(animationDuration)
      .attr('stroke-dashoffset', 0);

  }, [data, dimensions, xScale, yScale, lineGenerator, timeRange, animationDuration]);

  // Handle mouse interactions
  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!tooltipRef.current || !xScale || !yScale) return;

    const [xPos, yPos] = d3.pointer(event);
    const xDate = xScale.invert(xPos - MARGIN.left);
    
    const bisect = d3.bisector<DataPoint, Date>(d => d.timestamp).left;
    const index = bisect(data, xDate);
    const dataPoint = data[index];

    if (dataPoint) {
      tooltipRef.current.style.opacity = '1';
      tooltipRef.current.style.transform = `translate(
        ${xScale(dataPoint.timestamp) + MARGIN.left}px,
        ${yScale(dataPoint.value) + MARGIN.top - 40}px
      )`;
      tooltipRef.current.textContent = tooltipFormat(dataPoint.value);
    }
  }, [data, xScale, yScale, tooltipFormat]);

  const handleMouseLeave = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
    }
  }, []);

  return (
    <Card elevation={1}>
      <ChartContainer
        ref={containerRef}
        height={height}
        role="img"
        aria-label={title}
      >
        <SVGContainer
          ref={svgRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <g
            transform={`translate(${MARGIN.left},${MARGIN.top})`}
            aria-hidden="true"
          >
            <g
              className="x-axis"
              transform={`translate(0,${dimensions.boundedHeight})`}
            />
            <g className="y-axis" />
            <path
              className="line-path"
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </SVGContainer>
        <Tooltip ref={tooltipRef} aria-hidden="true" />
      </ChartContainer>
    </Card>
  );
});

LineChart.displayName = 'LineChart';

export default LineChart;