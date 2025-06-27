import React, { useState, useEffect } from 'react';
import { Clock, Calendar, TrendingUp, Award, Target, Flame, Plus, Edit3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import HoursModal from '../components/HoursModal';

interface HoursEntry {
  id: number;
  date: string;
  hours: number;
  description: string;
  subject: string;
}

interface Subject {
  id: number;
  name: string;
  icon: string;
  completed: boolean;
  progress: number;
  totalHours: number;
}

const Hours: React.FC = () => {
  const { isAdmin } = useAuth();
  const [hoursEntries, setHoursEntries] = useState<HoursEntry[]>([
    { id: 1, date: '2025-01-15', hours: 8, description: 'Calculus derivatives and limits', subject: 'Calculus' },
    { id: 2, date: '2025-01-14', hours: 6, description: 'Python data structures', subject: 'Python' },
    { id: 3, date: '2025-01-13', hours: 7, description: 'Multivariable calculus integration', subject: 'Multivariable Calculus' },
    { id: 4, date: '2025-01-12', hours: 5, description: 'React component development', subject: 'React' },
    { id: 5, date: '2025-01-11', hours: 9, description: 'Advanced calculus problems', subject: 'Calculus' },
    { id: 6, date: '2025-01-10', hours: 4, description: 'Python algorithms', subject: 'Python' },
    { id: 7, date: '2025-01-09', hours: 6, description: 'Vector calculus', subject: 'Multivariable Calculus' },
  ]);

  const [subjects, setSubjects] = useState<Subject[]>([
    { id: 1, name: 'Calculus', icon: '∂', completed: true, progress: 100, totalHours: 45 },
    { id: 2, name: 'Multivariable Calculus', icon: '∬', completed: false, progress: 75, totalHours: 32 },
    { id: 3, name: 'Python', icon: '🐍', completed: true, progress: 100, totalHours: 38 },
    { id: 4, name: 'React', icon: '⚛️', completed: false, progress: 60, totalHours: 28 },
    { id: 5, name: 'Machine Learning', icon: '🤖', completed: false, progress: 30, totalHours: 15 },
    { id: 6, name: 'Data Structures', icon: '🌳', completed: false, progress: 45, totalHours: 22 },
  ]);

  const [achievements] = useState([
    { id: 1, title: '100 Hours Milestone', description: 'Completed 100 hours of study', icon: '🏆', category: 'General' },
    { id: 2, title: 'Calculus Master', description: 'Completed all calculus modules', icon: '📐', category: 'Mathematics' },
    { id: 3, title: 'Python Expert', description: 'Mastered Python programming', icon: '🐍', category: 'Programming' },
    { id: 4, title: '7-Day Streak', description: 'Studied for 7 consecutive days', icon: '🔥', category: 'Consistency' },
    { id: 5, title: 'Early Bird', description: 'Started studying before 7 AM', icon: '🌅', category: 'Dedication' },
  ]);

  const [showHoursModal, setShowHoursModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HoursEntry | null>(null);

  // Calculate statistics
  const totalHours = hoursEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const averageHours = totalHours / hoursEntries.length || 0;
  const maxHours = Math.max(...hoursEntries.map(entry => entry.hours), 0);
  const daysSinceStart = Math.floor((new Date().getTime() - new Date('2025-01-01').getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate streak
  const calculateStreak = () => {
    const sortedEntries = [...hoursEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let streak = 0;
    let currentDate = new Date();
    
    for (const entry of sortedEntries) {
      const entryDate = new Date(entry.date);
      const diffDays = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === streak) {
        streak++;
        currentDate = entryDate;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const currentStreak = calculateStreak();

  // Generate chart data for the last 7 days
  const generateChartData = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const entry = hoursEntries.find(e => e.date === dateString);
      last7Days.push({
        date: dateString,
        hours: entry ? entry.hours : 0,
        day: date.toLocaleDateString('en-US', { weekday: 'short' })
      });
    }
    return last7Days;
  };

  const chartData = generateChartData();
  const maxChartHours = Math.max(...chartData.map(d => d.hours), 1);

  const handleCreateEntry = (entryData: Omit<HoursEntry, 'id'>) => {
    const newEntry: HoursEntry = {
      id: Date.now(),
      ...entryData
    };
    setHoursEntries([newEntry, ...hoursEntries]);
  };

  const handleEditEntry = (entryData: HoursEntry) => {
    setHoursEntries(hoursEntries.map(entry => 
      entry.id === entryData.id ? entryData : entry
    ));
    setEditingEntry(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Hours Dashboard</h1>
          <p className="text-xl text-gray-600">Track your learning journey and progress</p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Total Hours */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{totalHours}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Hours</h3>
            <p className="text-gray-600 text-sm">Hours worked so far</p>
          </div>

          {/* Average Hours */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{averageHours.toFixed(1)}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Average Daily</h3>
            <p className="text-gray-600 text-sm">Hours per day</p>
          </div>

          {/* Max Hours */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{maxHours}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Max Session</h3>
            <p className="text-gray-600 text-sm">Longest study session</p>
          </div>

          {/* Current Streak */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <Flame className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{currentStreak}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Current Streak</h3>
            <p className="text-gray-600 text-sm">Consecutive days</p>
          </div>
        </div>

        {/* Charts and Progress Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Daily Hours Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Daily Hours (Last 7 Days)</h3>
            <div className="space-y-4">
              {chartData.map((day, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="w-12 text-sm font-medium text-gray-600">{day.day}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                    <div 
                      className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${(day.hours / maxChartHours) * 100}%` }}
                    ></div>
                  </div>
                  <div className="w-8 text-sm font-semibold text-gray-900">{day.hours}h</div>
                </div>
              ))}
            </div>
          </div>

          {/* Subject Progress */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Subject Progress</h3>
            <div className="space-y-4">
              {subjects.map((subject) => (
                <div key={subject.id} className="flex items-center space-x-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-lg">
                    {subject.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-900">{subject.name}</span>
                      <span className="text-sm text-gray-600">{subject.totalHours}h</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          subject.completed ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${subject.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{subject.progress}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Achievements Section */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-12">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Achievements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div key={achievement.id} className="flex items-center space-x-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{achievement.title}</h4>
                  <p className="text-sm text-gray-600">{achievement.description}</p>
                  <span className="inline-block mt-1 px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded-full">
                    {achievement.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Entries */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Recent Entries</h3>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingEntry(null);
                  setShowHoursModal(true);
                }}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span>Add Entry</span>
              </button>
            )}
          </div>
          <div className="space-y-4">
            {hoursEntries.slice(0, 10).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{entry.subject}</div>
                    <div className="text-sm text-gray-600">{entry.description}</div>
                    <div className="text-xs text-gray-500">{new Date(entry.date).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-gray-900">{entry.hours}h</span>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setEditingEntry(entry);
                        setShowHoursModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Entry Modal */}
        {showHoursModal && (
          <HoursModal
            onClose={() => {
              setShowHoursModal(false);
              setEditingEntry(null);
            }}
            onSave={editingEntry ? handleEditEntry : handleCreateEntry}
            editEntry={editingEntry}
            subjects={subjects.map(s => s.name)}
          />
        )}
      </div>
    </div>
  );
};

export default Hours;