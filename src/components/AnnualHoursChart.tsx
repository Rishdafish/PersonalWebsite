import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, TrendingUp, Filter, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { workEntriesAPI } from '../lib/supabase';

interface ChartData {
  date: string;
  hours: number;
  dayOfYear: number;
  month: string;
  day: number;
}

interface AnnualHoursChartProps {
  onDataUpdate?: () => void;
}

const AnnualHoursChart: React.FC<AnnualHoursChartProps> = ({ onDataUpdate }) => {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dailyData, setDailyData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<ChartData | null>(null);
  const [showRunningAverage, setShowRunningAverage] = useState(true);

  useEffect(() => {
    if (user) {
      loadAnnualData();
    }
  }, [user, selectedYear]);

  useEffect(() => {
    if (onDataUpdate) {
      loadAnnualData();
    }
  }, [onDataUpdate]);

  const loadAnnualData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await workEntriesAPI.getDailyTotals(user.id, selectedYear);
      setDailyData(data);
    } catch (error) {
      console.error('Error loading annual data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    const data: ChartData[] = [];
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateString = d.toISOString().split('T')[0];
      const dayOfYear = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      data.push({
        date: dateString,
        hours: dailyData[dateString] || 0,
        dayOfYear,
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        day: d.getDate()
      });
    }
    
    return data;
  }, [dailyData, selectedYear]);

  const runningAverageData = useMemo(() => {
    const averages: number[] = [];
    let totalHours = 0;
    let daysWithData = 0;
    
    chartData.forEach((point, index) => {
      if (point.hours > 0) {
        totalHours += point.hours;
        daysWithData++;
      }
      
      // Calculate running average only for days that have passed
      const today = new Date();
      const pointDate = new Date(point.date);
      
      if (pointDate <= today) {
        averages.push(daysWithData > 0 ? totalHours / daysWithData : 0);
      } else {
        averages.push(0);
      }
    });
    
    return averages;
  }, [chartData]);

  const stats = useMemo(() => {
    const totalHours = chartData.reduce((sum, point) => sum + point.hours, 0);
    const daysWithData = chartData.filter(point => point.hours > 0).length;
    const maxHours = Math.max(...chartData.map(point => point.hours));
    const averageHours = daysWithData > 0 ? totalHours / daysWithData : 0;
    
    return { totalHours, daysWithData, maxHours, averageHours };
  }, [chartData]);

  const maxChartValue = Math.max(...chartData.map(point => point.hours), 1);
  const chartHeight = 300;
  const chartWidth = 800;
  const padding = { top: 20, right: 40, bottom: 60, left: 60 };

  const getXPosition = (dayOfYear: number) => {
    return padding.left + ((dayOfYear - 1) / 365) * (chartWidth - padding.left - padding.right);
  };

  const getYPosition = (hours: number) => {
    return chartHeight - padding.bottom - (hours / maxChartValue) * (chartHeight - padding.top - padding.bottom);
  };

  const handlePointClick = (point: ChartData) => {
    setSelectedPoint(selectedPoint?.date === point.date ? null : point);
  };

  const getMonthTicks = () => {
    const ticks = [];
    for (let month = 0; month < 12; month++) {
      const date = new Date(selectedYear, month, 1);
      const dayOfYear = Math.floor((date.getTime() - new Date(selectedYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      ticks.push({
        dayOfYear,
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        x: getXPosition(dayOfYear)
      });
    }
    return ticks;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Annual Hours Tracking</h3>
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <BarChart3 size={16} />
              <span>Total: {stats.totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp size={16} />
              <span>Avg: {stats.averageHours.toFixed(1)}h/day</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar size={16} />
              <span>Active Days: {stats.daysWithData}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showAverage"
              checked={showRunningAverage}
              onChange={(e) => setShowRunningAverage(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="showAverage" className="text-sm text-gray-600">
              Running Average
            </label>
          </div>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() - i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          width={chartWidth}
          height={chartHeight}
          className="border border-gray-200 rounded-lg bg-gray-50"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartHeight - padding.bottom - ratio * (chartHeight - padding.top - padding.bottom);
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs fill-gray-500"
                >
                  {(ratio * maxChartValue).toFixed(0)}h
                </text>
              </g>
            );
          })}

          {/* Month labels */}
          {getMonthTicks().map((tick) => (
            <text
              key={tick.dayOfYear}
              x={tick.x}
              y={chartHeight - padding.bottom + 20}
              textAnchor="middle"
              className="text-xs fill-gray-500"
            >
              {tick.label}
            </text>
          ))}

          {/* Data points */}
          {chartData.map((point) => {
            if (point.hours === 0) return null;
            
            const x = getXPosition(point.dayOfYear);
            const y = getYPosition(point.hours);
            const isSelected = selectedPoint?.date === point.date;
            
            return (
              <circle
                key={point.date}
                cx={x}
                cy={y}
                r={isSelected ? 6 : 4}
                fill={isSelected ? "#dc2626" : "#3b82f6"}
                stroke={isSelected ? "#dc2626" : "#1d4ed8"}
                strokeWidth={2}
                className="cursor-pointer hover:r-6 transition-all"
                onClick={() => handlePointClick(point)}
              />
            );
          })}

          {/* Running average line */}
          {showRunningAverage && (
            <path
              d={chartData
                .map((point, index) => {
                  const x = getXPosition(point.dayOfYear);
                  const y = getYPosition(runningAverageData[index]);
                  return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                })
                .join(' ')}
              stroke="#f59e0b"
              strokeWidth={2}
              fill="none"
              strokeDasharray="5,5"
            />
          )}
        </svg>

        {/* Selected point tooltip */}
        {selectedPoint && (
          <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
            <div className="text-sm font-medium text-gray-900">
              {new Date(selectedPoint.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <div className="text-lg font-bold text-blue-600">
              {selectedPoint.hours} hours
            </div>
            <div className="text-xs text-gray-500">
              Day {selectedPoint.dayOfYear} of {selectedYear}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <span className="text-gray-600">Daily Hours</span>
        </div>
        {showRunningAverage && (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-0.5 bg-yellow-500" style={{ borderTop: '2px dashed #f59e0b' }}></div>
            <span className="text-gray-600">Running Average</span>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-600 rounded-full"></div>
          <span className="text-gray-600">Selected Day</span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.totalHours.toFixed(0)}</div>
          <div className="text-sm text-gray-600">Total Hours</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.maxHours.toFixed(0)}</div>
          <div className="text-sm text-gray-600">Best Day</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.averageHours.toFixed(1)}</div>
          <div className="text-sm text-gray-600">Daily Average</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.daysWithData}</div>
          <div className="text-sm text-gray-600">Active Days</div>
        </div>
      </div>
    </div>
  );
};

export default AnnualHoursChart;