import React, { useState, useEffect } from 'react';
import { Clock, Calendar, TrendingUp, Award, Target, Flame, Plus, Edit3, Trophy, Settings, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, UserStatistics, Subject, Achievement, WorkEntry } from '../lib/supabase';
import WorkEntryModal, { WorkEntryData } from '../components/WorkEntryModal';
import SubjectModal, { SubjectData } from '../components/SubjectModal';
import AchievementModal, { AchievementData } from '../components/AchievementModal';

const Hours: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showWorkModal, setShowWorkModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load user statistics
      const { data: statsData } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (statsData) {
        setStatistics(statsData);
      }

      // Load subjects
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (subjectsData) {
        setSubjects(subjectsData);
      }

      // Load achievements
      const { data: achievementsData } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (achievementsData) {
        setAchievements(achievementsData);
      }

      // Load work entries with subject info
      const { data: entriesData } = await supabase
        .from('work_entries')
        .select(`
          *,
          subjects (
            id,
            name,
            icon
          )
        `)
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false })
        .limit(20);

      if (entriesData) {
        setWorkEntries(entriesData);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkEntry = async (entryData: WorkEntryData) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('work_entries')
        .insert([{
          user_id: user.id,
          subject_id: entryData.subject_id,
          hours: entryData.hours,
          description: entryData.description,
          entry_date: entryData.entry_date
        }])
        .select(`
          *,
          subjects (
            id,
            name,
            icon
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        setWorkEntries([data, ...workEntries]);
        await updateStatistics();
        await updateSubjectProgress(entryData.subject_id, entryData.hours);
      }
    } catch (error) {
      console.error('Error creating work entry:', error);
    }
  };

  const handleEditWorkEntry = async (entryData: WorkEntryData) => {
    if (!user || !entryData.id) return;

    try {
      const { data, error } = await supabase
        .from('work_entries')
        .update({
          subject_id: entryData.subject_id,
          hours: entryData.hours,
          description: entryData.description,
          entry_date: entryData.entry_date
        })
        .eq('id', entryData.id)
        .select(`
          *,
          subjects (
            id,
            name,
            icon
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        setWorkEntries(workEntries.map(entry => 
          entry.id === entryData.id ? data : entry
        ));
        await updateStatistics();
        setEditingEntry(null);
      }
    } catch (error) {
      console.error('Error updating work entry:', error);
    }
  };

  const handleCreateSubject = async (subjectData: SubjectData) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert([{
          user_id: user.id,
          name: subjectData.name,
          target_hours: subjectData.target_hours,
          icon: subjectData.icon
        }])
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setSubjects([data, ...subjects]);
      }
    } catch (error) {
      console.error('Error creating subject:', error);
    }
  };

  const handleEditSubject = async (subjectData: SubjectData) => {
    if (!user || !subjectData.id) return;

    try {
      const { data, error } = await supabase
        .from('subjects')
        .update({
          name: subjectData.name,
          target_hours: subjectData.target_hours,
          icon: subjectData.icon
        })
        .eq('id', subjectData.id)
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setSubjects(subjects.map(subject => 
          subject.id === subjectData.id ? data : subject
        ));
        setEditingSubject(null);
      }
    } catch (error) {
      console.error('Error updating subject:', error);
    }
  };

  const handleCreateAchievement = async (achievementData: AchievementData) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('achievements')
        .insert([{
          user_id: user.id,
          title: achievementData.title,
          description: achievementData.description,
          icon: achievementData.icon,
          category: achievementData.category
        }])
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setAchievements([data, ...achievements]);
      }
    } catch (error) {
      console.error('Error creating achievement:', error);
    }
  };

  const toggleAchievement = async (achievementId: string, completed: boolean) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('achievements')
        .update({
          completed: !completed,
          completed_at: !completed ? new Date().toISOString() : null
        })
        .eq('id', achievementId)
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setAchievements(achievements.map(achievement => 
          achievement.id === achievementId ? data : achievement
        ));
      }
    } catch (error) {
      console.error('Error toggling achievement:', error);
    }
  };

  const updateStatistics = async () => {
    if (!user) return;

    try {
      // Calculate new statistics from work entries
      const { data: entries } = await supabase
        .from('work_entries')
        .select('hours, entry_date')
        .eq('user_id', user.id);

      if (entries) {
        const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
        const maxHours = Math.max(...entries.map(entry => entry.hours), 0);
        const averageHours = entries.length > 0 ? totalHours / entries.length : 0;
        
        // Calculate days since first entry
        const firstEntry = entries.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())[0];
        const daysSinceStart = firstEntry ? 
          Math.floor((new Date().getTime() - new Date(firstEntry.entry_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;

        // Calculate streak
        const sortedEntries = entries.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
        let streak = 0;
        let currentDate = new Date();
        
        for (const entry of sortedEntries) {
          const entryDate = new Date(entry.entry_date);
          const diffDays = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays === streak) {
            streak++;
            currentDate = entryDate;
          } else {
            break;
          }
        }

        await supabase
          .from('user_statistics')
          .upsert({
            user_id: user.id,
            total_hours: totalHours,
            average_daily_hours: averageHours,
            max_session_hours: maxHours,
            days_since_start: daysSinceStart,
            current_streak: streak,
            updated_at: new Date().toISOString()
          });

        // Reload statistics
        const { data: statsData } = await supabase
          .from('user_statistics')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (statsData) {
          setStatistics(statsData);
        }
      }
    } catch (error) {
      console.error('Error updating statistics:', error);
    }
  };

  const updateSubjectProgress = async (subjectId: string, hoursToAdd: number) => {
    try {
      const subject = subjects.find(s => s.id === subjectId);
      if (!subject) return;

      const newCurrentHours = subject.current_hours + hoursToAdd;
      const completed = newCurrentHours >= subject.target_hours;

      const { data, error } = await supabase
        .from('subjects')
        .update({
          current_hours: newCurrentHours,
          completed: completed
        })
        .eq('id', subjectId)
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setSubjects(subjects.map(s => s.id === subjectId ? data : s));
      }
    } catch (error) {
      console.error('Error updating subject progress:', error);
    }
  };

  // Generate chart data for the last 7 days
  const generateChartData = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const dayEntries = workEntries.filter(e => e.entry_date === dateString);
      const totalHours = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);
      
      last7Days.push({
        date: dateString,
        hours: totalHours,
        day: date.toLocaleDateString('en-US', { weekday: 'short' })
      });
    }
    return last7Days;
  };

  const chartData = generateChartData();
  const maxChartHours = Math.max(...chartData.map(d => d.hours), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

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
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                {statistics?.total_hours?.toFixed(1) || '0'}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Hours</h3>
            <p className="text-gray-600 text-sm">Hours worked so far</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                {statistics?.average_daily_hours?.toFixed(1) || '0'}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Average Daily</h3>
            <p className="text-gray-600 text-sm">Hours per day</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                {statistics?.max_session_hours?.toFixed(1) || '0'}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Max Session</h3>
            <p className="text-gray-600 text-sm">Longest study session</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <Flame className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                {statistics?.current_streak || '0'}
              </span>
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
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Subject Progress</h3>
              <button
                onClick={() => setShowSubjectModal(true)}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span className="text-sm">Add Subject</span>
              </button>
            </div>
            <div className="space-y-4">
              {subjects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No subjects added yet</p>
                  <button
                    onClick={() => setShowSubjectModal(true)}
                    className="mt-2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Add your first subject
                  </button>
                </div>
              ) : (
                subjects.map((subject) => {
                  const progress = subject.target_hours > 0 ? (subject.current_hours / subject.target_hours) * 100 : 0;
                  return (
                    <div key={subject.id} className="flex items-center space-x-4">
                      <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-lg">
                        {subject.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-gray-900">{subject.name}</span>
                          <span className="text-sm text-gray-600">
                            {subject.current_hours.toFixed(1)}/{subject.target_hours}h
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              subject.completed ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {Math.round(progress)}%
                      </div>
                      <button
                        onClick={() => {
                          setEditingSubject(subject);
                          setShowSubjectModal(true);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Settings size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Achievements Section */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-12">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Achievements</h3>
            <button
              onClick={() => setShowAchievementModal(true)}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus size={16} />
              <span className="text-sm">Custom Achievement</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div 
                key={achievement.id} 
                className={`flex items-center space-x-4 p-4 rounded-xl border transition-all ${
                  achievement.completed 
                    ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <h4 className={`font-semibold ${achievement.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                    {achievement.title}
                  </h4>
                  <p className={`text-sm ${achievement.completed ? 'text-gray-600' : 'text-gray-400'}`}>
                    {achievement.description}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                    achievement.completed 
                      ? 'bg-yellow-200 text-yellow-800' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {achievement.category}
                  </span>
                </div>
                <button
                  onClick={() => toggleAchievement(achievement.id, achievement.completed)}
                  className={`p-2 rounded-full transition-colors ${
                    achievement.completed 
                      ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300' 
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <Trophy size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Entries */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Recent Entries</h3>
            <button
              onClick={() => {
                setEditingEntry(null);
                setShowWorkModal(true);
              }}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              <span>Add Entry</span>
            </button>
          </div>
          <div className="space-y-4">
            {workEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No work entries yet</p>
                <button
                  onClick={() => setShowWorkModal(true)}
                  className="mt-2 text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Add your first entry
                </button>
              </div>
            ) : (
              workEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {entry.subjects?.icon} {entry.subjects?.name}
                      </div>
                      <div className="text-sm text-gray-600">{entry.description}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(entry.entry_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-gray-900">{entry.hours}h</span>
                    <button
                      onClick={() => {
                        setEditingEntry(entry);
                        setShowWorkModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modals */}
        {showWorkModal && (
          <WorkEntryModal
            onClose={() => {
              setShowWorkModal(false);
              setEditingEntry(null);
            }}
            onSave={editingEntry ? handleEditWorkEntry : handleCreateWorkEntry}
            subjects={subjects}
            editEntry={editingEntry ? {
              id: editingEntry.id,
              subject_id: editingEntry.subject_id,
              hours: editingEntry.hours,
              description: editingEntry.description,
              entry_date: editingEntry.entry_date
            } : null}
          />
        )}

        {showSubjectModal && (
          <SubjectModal
            onClose={() => {
              setShowSubjectModal(false);
              setEditingSubject(null);
            }}
            onSave={editingSubject ? handleEditSubject : handleCreateSubject}
            editSubject={editingSubject ? {
              id: editingSubject.id,
              name: editingSubject.name,
              target_hours: editingSubject.target_hours,
              icon: editingSubject.icon
            } : null}
          />
        )}

        {showAchievementModal && (
          <AchievementModal
            onClose={() => setShowAchievementModal(false)}
            onSave={handleCreateAchievement}
          />
        )}
      </div>
    </div>
  );
};

export default Hours;