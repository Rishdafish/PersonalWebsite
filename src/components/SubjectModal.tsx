import React, { useState } from 'react';
import { X } from 'lucide-react';

interface SubjectModalProps {
  onClose: () => void;
  onSave: (subject: SubjectData) => void;
  editSubject?: SubjectData | null;
}

export interface SubjectData {
  id?: string;
  name: string;
  target_hours: number;
  icon: string;
}

const SubjectModal: React.FC<SubjectModalProps> = ({ onClose, onSave, editSubject }) => {
  const [formData, setFormData] = useState<SubjectData>({
    name: editSubject?.name || '',
    target_hours: editSubject?.target_hours || 0,
    icon: editSubject?.icon || '📚'
  });

  const commonIcons = ['📚', '💻', '🔬', '🎨', '🏃', '🎵', '🍳', '🌱', '🔧', '📊', '🧮', '🌍', '📝', '🎯', '💡'];

  const handleInputChange = (field: keyof SubjectData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim() && formData.target_hours > 0) {
      onSave({
        ...formData,
        id: editSubject?.id
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
            {editSubject ? 'Edit Subject' : 'Add New Subject'}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter subject name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Hours</label>
            <input
              type="number"
              min="1"
              value={formData.target_hours}
              onChange={(e) => handleInputChange('target_hours', parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter target hours"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {commonIcons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => handleInputChange('icon', icon)}
                  className={`p-3 text-2xl border rounded-lg hover:bg-gray-50 transition-colors ${
                    formData.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => handleInputChange('icon', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Or enter custom icon/emoji"
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
              {editSubject ? 'Update' : 'Add'} Subject
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubjectModal;