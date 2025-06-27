import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Subject } from '../lib/supabase';

interface WorkEntryModalProps {
  onClose: () => void;
  onSave: (entry: WorkEntryData) => void;
  subjects: Subject[];
  editEntry?: WorkEntryData | null;
}

export interface WorkEntryData {
  id?: string;
  subject_id: string;
  hours: number;
  description: string;
  entry_date: string;
}

const WorkEntryModal: React.FC<WorkEntryModalProps> = ({ onClose, onSave, subjects, editEntry }) => {
  const [formData, setFormData] = useState<WorkEntryData>({
    subject_id: editEntry?.subject_id || (subjects[0]?.id || ''),
    hours: editEntry?.hours || 0,
    description: editEntry?.description || '',
    entry_date: editEntry?.entry_date || new Date().toISOString().split('T')[0]
  });

  const handleInputChange = (field: keyof WorkEntryData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.subject_id && formData.hours > 0 && formData.description.trim()) {
      onSave({
        ...formData,
        id: editEntry?.id
      });
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleOverlayClick}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {editEntry ? 'Edit Work Entry' : 'Add Work Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={formData.entry_date}
              onChange={(e) => handleInputChange('entry_date', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              value={formData.subject_id}
              onChange={(e) => handleInputChange('subject_id', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.icon} {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hours Worked</label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={formData.hours}
              onChange={(e) => handleInputChange('hours', parseFloat(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter hours worked"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="What did you work on?"
              rows={3}
              required
            />
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {editEntry ? 'Update' : 'Add'} Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkEntryModal;