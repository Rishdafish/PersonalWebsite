import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ProjectModalProps {
  onClose: () => void;
  onSave: (project: ProjectData) => void;
  editProject?: ProjectData | null;
}

export interface ProjectData {
  id?: number;
  title: string;
  startDate: string;
  description: string;
  technologies: string[];
  github: string;
  liveDemo: string;
  status: string;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ onClose, onSave, editProject }) => {
  const [formData, setFormData] = useState<ProjectData>({
    title: editProject?.title || '',
    startDate: editProject?.startDate || new Date().toISOString().split('T')[0],
    description: editProject?.description || '',
    technologies: editProject?.technologies || [],
    github: editProject?.github || '',
    liveDemo: editProject?.liveDemo || '',
    status: editProject?.status || 'Planning'
  });

  const [currentTag, setCurrentTag] = useState('');

  const handleInputChange = (field: keyof ProjectData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!formData.technologies.includes(currentTag.trim())) {
        setFormData(prev => ({
          ...prev,
          technologies: [...prev.technologies, currentTag.trim()]
        }));
      }
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      technologies: prev.technologies.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim() && formData.description.trim()) {
      onSave({
        ...formData,
        id: editProject?.id
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
    <div className="project-modal" onClick={handleOverlayClick}>
      <div className="project-modal-content">
        <button className="close-button interactive" onClick={onClose}>
          <X size={20} />
        </button>
        
        <h2>{editProject ? 'Edit Project' : 'Create New Project'}</h2>
        
        <form onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label className="form-label">Project Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="form-input"
              placeholder="Enter project title"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="form-textarea"
              placeholder="Describe your project..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Technologies</label>
            <div className="tags-input-container">
              {formData.technologies.length > 0 && (
                <div className="tags-display">
                  {formData.technologies.map((tag, index) => (
                    <div key={index} className="tag-item">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="tag-remove interactive"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={handleTagKeyPress}
                className="form-input"
                placeholder="Type technology and press Enter (e.g., React, Python, TensorFlow)"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">GitHub Repository URL</label>
            <input
              type="url"
              value={formData.github}
              onChange={(e) => handleInputChange('github', e.target.value)}
              className="form-input"
              placeholder="https://github.com/username/repository"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Live Demo URL</label>
            <input
              type="url"
              value={formData.liveDemo}
              onChange={(e) => handleInputChange('liveDemo', e.target.value)}
              className="form-input"
              placeholder="https://your-project-demo.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Project Status</label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="form-select"
            >
              <option value="Planning">Planning</option>
              <option value="Developing">Developing</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="form-buttons">
            <button
              type="button"
              onClick={onClose}
              className="form-button secondary interactive"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="form-button primary interactive"
            >
              {editProject ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;