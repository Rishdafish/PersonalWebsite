import React, { useMemo } from 'react';
import { WorkEntry } from '../lib/supabase';

interface DailyHoursLineGraphProps {
  workEntries: WorkEntry[];
  className?: string;
}

interface MonthlyDataPoint {
  month: string;
  monthIndex: number;
  totalHours: number;
  daysWorked: number;
  averageHours: number;
}

const DailyHoursLineGraph: React.FC<DailyHoursLineGraphProps> = ({ 
  workEntries, 
  className = '' 
}) => {
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Group entries by month and calculate totals
    const monthlyData: MonthlyDataPoint[] = months.map((month, index) => {
      const monthEntries = workEntries.filter(entry => {
        const entryDate = new Date(entry.entry_date);
        return entryDate.getMonth() === index && entryDate.getFullYear() === currentYear;
      });

      const totalHours = monthEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const uniqueDays = new Set(monthEntries.map(entry => entry.entry_date)).size;

      return {
        month,
        monthIndex: index,
        totalHours,
        daysWorked: uniqueDays,
        averageHours: uniqueDays > 0 ? totalHours / uniqueDays : 0
      };
    });

    return monthlyData;
  }, [workEntries]);

  if (chartData.every(d => d.totalHours === 0)) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-lg border border-gray-100 ${className}`}>
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Daily Work Hours</h3>
        <div className="text-center py-12 text-gray-500">
          <p>No work entries to display</p>
        </div>
      </div>
    );
  }

  // Calculate chart dimensions and scales
  const chartWidth = 800;
  const chartHeight = 400;
  const padding = { top: 40, right: 60, bottom: 80, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Calculate scales
  const maxHours = Math.max(...chartData.map(d => d.totalHours), 10);
  const minHours = 0;
  const hoursRange = maxHours - minHours;

  // Create scale functions
  const xScale = (index: number) => (index / (chartData.length - 1)) * innerWidth;
  const yScale = (hours: number) => innerHeight - ((hours - minHours) / hoursRange) * innerHeight;

  // Generate path for the line
  const linePath = chartData
    .map((point, index) => {
      const x = xScale(index);
      const y = yScale(point.totalHours);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate grid lines
  const horizontalGridLines = [];
  const verticalGridLines = [];
  
  // Horizontal grid lines (hours)
  const hourStep = Math.max(1, Math.ceil(maxHours / 8));
  for (let i = 0; i <= maxHours; i += hourStep) {
    const y = yScale(i);
    horizontalGridLines.push(
      <g key={`h-grid-${i}`}>
        <line
          x1={0}
          y1={y}
          x2={innerWidth}
          y2={y}
          stroke="#e5e7eb"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
        <text
          x={-10}
          y={y + 4}
          textAnchor="end"
          className="text-xs fill-gray-600"
        >
          {i}h
        </text>
      </g>
    );
  }

  // Vertical grid lines (months)
  chartData.forEach((point, index) => {
    const x = xScale(index);
    verticalGridLines.push(
      <g key={`v-grid-${index}`}>
        <line
          x1={x}
          y1={0}
          x2={x}
          y2={innerHeight}
          stroke="#e5e7eb"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
        <text
          x={x}
          y={innerHeight + 20}
          textAnchor="middle"
          className="text-xs fill-gray-600"
        >
          {point.month}
        </text>
      </g>
    );
  });

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-lg border border-gray-100 ${className}`}>
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Daily Work Hours</h3>
      
      <div className="w-full overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight}
          className="mx-auto"
          style={{ minWidth: '600px' }}
        >
          {/* Chart area background */}
          <rect
            x={padding.left}
            y={padding.top}
            width={innerWidth}
            height={innerHeight}
            fill="#fafafa"
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          
          {/* Grid lines */}
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {horizontalGridLines}
            {verticalGridLines}
          </g>
          
          {/* Data line */}
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            <path
              d={linePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Data points */}
            {chartData.map((point, index) => {
              const x = xScale(index);
              const y = yScale(point.totalHours);
              
              return (
                <g key={`point-${index}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={point.totalHours > 0 ? 5 : 3}
                    fill={point.totalHours > 0 ? "#3b82f6" : "#d1d5db"}
                    stroke="white"
                    strokeWidth={2}
                    className="hover:r-7 transition-all cursor-pointer"
                  />
                  
                  {/* Tooltip on hover */}
                  <g className="opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                    <rect
                      x={x - 45}
                      y={y - 50}
                      width={90}
                      height={40}
                      fill="rgba(0, 0, 0, 0.8)"
                      rx={4}
                    />
                    <text
                      x={x}
                      y={y - 32}
                      textAnchor="middle"
                      className="text-xs fill-white"
                    >
                      {point.month}: {point.totalHours}h
                    </text>
                    <text
                      x={x}
                      y={y - 18}
                      textAnchor="middle"
                      className="text-xs fill-white"
                    >
                      {point.daysWorked} days worked
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
          
          {/* Axis labels */}
          <text
            x={chartWidth / 2}
            y={chartHeight - 10}
            textAnchor="middle"
            className="text-sm font-medium fill-gray-700"
          >
            Month
          </text>
          
          <text
            x={20}
            y={chartHeight / 2}
            textAnchor="middle"
            className="text-sm font-medium fill-gray-700"
            transform={`rotate(-90, 20, ${chartHeight / 2})`}
          >
            Total Hours
          </text>
          
          {/* Chart title */}
          <text
            x={chartWidth / 2}
            y={25}
            textAnchor="middle"
            className="text-lg font-semibold fill-gray-900"
          >
            Monthly Work Hours Progress
          </text>
        </svg>
      </div>
      
      {/* Legend and stats */}
      <div className="mt-6 flex justify-between items-center text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-blue-500"></div>
            <span>Monthly Total Hours</span>
          </div>
        </div>
        
        <div className="flex space-x-6">
          <div>
            <span className="font-medium">Active Months: </span>
            <span>{chartData.filter(d => d.totalHours > 0).length}</span>
          </div>
          <div>
            <span className="font-medium">Total Hours: </span>
            <span>
              {chartData.reduce((sum, d) => sum + d.totalHours, 0).toFixed(1)}h
            </span>
          </div>
          <div>
            <span className="font-medium">Best Month: </span>
            <span>
              {chartData.reduce((max, d) => d.totalHours > max.totalHours ? d : max, chartData[0]).totalHours.toFixed(1)}h
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyHoursLineGraph;