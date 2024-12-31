import React, { useRef, useEffect, useCallback, memo } from 'react';
import * as d3 from 'd3'; // version ^7.8.0
import { debounce } from 'lodash'; // version ^4.17.21
import Card from '../../common/Card';
import { MessageMetrics, EngagementMetrics } from '../../../types/analytics';

/**
 * Props interface for the PieChart component with accessibility and customization options
 */
interface PieChartProps {
  /** Data object with labels as keys and values for pie chart segments */
  data: Record<string, number>;
  /** Title of the pie chart for accessibility and display */
  title: string;
  /** Width of the chart in pixels */
  width?: number;
  /** Height of the chart in pixels */
  height?: number;
  /** Array of WCAG compliant colors for pie segments */
  colors?: string[];
  /** Duration of transitions in milliseconds */
  animationDuration?: number;
  /** Custom tooltip content formatter */
  tooltipFormat?: (value: number, label: string) => string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

/**
 * Custom hook for D3.js pie chart creation and updates with performance optimization
 */
const useD3PieChart = (
  data: Record<string, number>,
  svgRef: React.RefObject<SVGSVGElement>,
  width: number,
  height: number,
  colors: string[],
  animationDuration: number,
  tooltipFormat?: (value: number, label: string) => string
) => {
  useEffect(() => {
    if (!svgRef.current || !data) return;

    // Clear existing content
    d3.select(svgRef.current).selectAll('*').remove();

    // Setup dimensions
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const radius = Math.min(width - margin.left - margin.right, 
                          height - margin.top - margin.bottom) / 2;

    // Create SVG container
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Create color scale
    const colorScale = d3.scaleOrdinal()
      .domain(Object.keys(data))
      .range(colors);

    // Create pie generator
    const pie = d3.pie<any>()
      .value(d => d[1])
      .sort(null);

    // Create arc generator
    const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(radius);

    // Create arc for hover state
    const arcHover = d3.arc()
      .innerRadius(0)
      .outerRadius(radius * 1.1);

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'pie-chart-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', '#ffffff')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .attr('role', 'tooltip');

    // Create pie segments
    const segments = svg.selectAll('path')
      .data(pie(Object.entries(data)))
      .enter()
      .append('path')
      .attr('d', arc as any)
      .attr('fill', d => colorScale(d.data[0]))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('role', 'presentation')
      .attr('tabindex', 0)
      .attr('aria-label', d => 
        `${d.data[0]}: ${d.data[1]} (${(d.value! * 100 / d3.sum(Object.values(data))).toFixed(1)}%)`
      );

    // Add interactivity
    segments
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arcHover as any);

        const tooltipContent = tooltipFormat 
          ? tooltipFormat(d.value!, d.data[0])
          : `${d.data[0]}: ${d.data[1]} (${(d.value! * 100 / d3.sum(Object.values(data))).toFixed(1)}%)`;

        tooltip
          .style('visibility', 'visible')
          .html(tooltipContent);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('top', `${event.pageY - 10}px`)
          .style('left', `${event.pageX + 10}px`);
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arc as any);

        tooltip.style('visibility', 'hidden');
      })
      .on('focus', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arcHover as any);
      })
      .on('blur', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arc as any);
      });

    // Add animations
    segments
      .transition()
      .duration(animationDuration)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) {
          return arc(interpolate(t)) as string;
        };
      });

    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [data, width, height, colors, animationDuration, tooltipFormat]);
};

/**
 * A reusable pie chart component for visualizing analytics data distribution
 * with accessibility support and animations
 */
const PieChart: React.FC<PieChartProps> = memo(({
  data,
  title,
  width = 300,
  height = 300,
  colors = [
    '#1976D2', '#388E3C', '#FFA000', '#D32F2F', '#7B1FA2',
    '#0288D1', '#689F38', '#FBC02D', '#C2185B', '#455A64'
  ],
  animationDuration = 750,
  tooltipFormat,
  ariaLabel
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Handle window resize with debounce
  const handleResize = useCallback(
    debounce(() => {
      if (svgRef.current) {
        const container = svgRef.current.parentElement;
        if (container) {
          const { width: newWidth } = container.getBoundingClientRect();
          svgRef.current.setAttribute('width', newWidth.toString());
          svgRef.current.setAttribute('height', newWidth.toString());
        }
      }
    }, 250),
    []
  );

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Initialize D3 chart
  useD3PieChart(data, svgRef, width, height, colors, animationDuration, tooltipFormat);

  return (
    <Card
      role="figure"
      aria-label={ariaLabel || title}
      header={<h3>{title}</h3>}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <svg
          ref={svgRef}
          style={{ maxWidth: '100%', height: 'auto' }}
          role="img"
          aria-label={`Pie chart showing ${title}`}
        >
          <title>{title}</title>
          <desc>
            {`Pie chart visualizing ${title} with ${Object.keys(data).length} segments`}
          </desc>
        </svg>
      </div>
    </Card>
  );
});

PieChart.displayName = 'PieChart';

export default PieChart;