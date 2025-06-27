import React, { useMemo } from 'react';
import { WorkEntry } from '../lib/supabase';

interface DailyHoursLineGraphProps {
  workEntries: WorkEntry[];
  className?: string;
}

interface DataPoint {
  date: string;
  hours: number;
  formattedDate: string;
}

const DailyHoursLineGraph: React.FC<DailyHoursLineGraphProps> = ({ 
  workEntries, 
  className = '' 
}) => {
  const chartData = useMemo(() => {
    // Group entries by date and sum hours
    const dailyTotals = workEntries.reduce((acc, entry) => {
      const date = entry.entry_date;
      acc[date] = (acc[date] || 0) + entry.hours;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort by date
    const dataPoints: DataPoint[] = Object.entries(dailyTotals)
      .map(([date, hours]) => ({
        date,
        hours,
        formattedDate: new Date(date).toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        })
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return dataPoints;
  }, [workEntries]);

  if (chartData.length === 0) {
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
  const maxHours = Math.max(...chartData.map(d => d.hours), 24);
  const minHours = 0;
  const hoursRange = maxHours - minHours;

  // Create scale functions
  const xScale = (index: number) => (index / (chartData.length - 1)) * innerWidth;
  const yScale = (hours: number) => innerHeight - ((hours - minHours) / hoursRange) * innerHeight;

  // Generate path for the line
  const linePath = chartData
    .map((point, index) => {
      const x = xScale(index);
      const y = yScale(point.hours);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate grid lines
  const horizontalGridLines = [];
  const verticalGridLines = [];
  
  // Horizontal grid lines (hours)
  const hourStep = Math.ceil(maxHours / 8);
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

  // Vertical grid lines (dates) - show every few dates to avoid crowding
  const dateStep = Math.max(1, Math.floor(chartData.length / 8));
  for (let i = 0; i < chartData.length; i += dateStep) {
    const x = xScale(i);
    verticalGridLines.push(
      <g key={`v-grid-${i}`}>
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
          transform={`rotate(-45, ${x}, ${innerHeight + 20})`}
        >
          {chartData[i].formattedDate}
        </text>
      </g>
    );
  }

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
              const y = yScale(point.hours);
              
              return (
                <g key={`point-${index}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={4}
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth={2}
                    className="hover:r-6 transition-all cursor-pointer"
                  />
                  
                  {/* Tooltip on hover */}
                  <g className="opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                    <rect
                      x={x - 35}
                      y={y - 35}
                      width={70}
                      height={25}
                      fill="rgba(0, 0, 0, 0.8)"
                      rx={4}
                    />
                    <text
                      x={x}
                      y={y - 18}
                      textAnchor="middle"
                      className="text-xs fill-white"
                    >
                      {point.hours}h
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
            Date (MM/DD/YYYY)
          </text>
          
          <text
            x={20}
            y={chartHeight / 2}
            textAnchor="middle"
            className="text-sm font-medium fill-gray-700"
            transform={`rotate(-90, 20, ${chartHeight / 2})`}
          >
            Hours Worked
          </text>
          
          {/* Chart title */}
          <text
            x={chartWidth / 2}
            y={25}
            textAnchor="middle"
            className="text-lg font-semibold fill-gray-900"
          >
            Daily Work Hours
          </text>
        </svg>
      </div>
      
      {/* Legend and stats */}
      <div className="mt-6 flex justify-between items-center text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-blue-500"></div>
            <span>Daily Hours</span>
          </div>
        </div>
        
        <div className="flex space-x-6">
          <div>
            <span className="font-medium">Total Days: </span>
            <span>{chartData.length}</span>
          </div>
          <div>
            <span className="font-medium">Avg Hours: </span>
            <span>
              {(chartData.reduce((sum, d) => sum + d.hours, 0) / chartData.length).toFixed(1)}h
            </span>
          </div>
          <div>
            <span className="font-medium">Max Hours: </span>
            <span>{Math.max(...chartData.map(d => d.hours)).toFixed(1)}h</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyHoursLineGraph;