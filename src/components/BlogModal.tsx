import React, { useState } from 'react';
import { X } from 'lucide-react';

interface BlogModalProps {
  onClose: () => void;
  onSave: (post: BlogPostData) => void;
  editPost?: BlogPostData | null;
}

export interface BlogPostData {
  id?: number;
  title: string;
  content: string;
  timestamp: string;
}

const BlogModal: React.FC<BlogModalProps> = ({ onClose, onSave, editPost }) => {
  const [formData, setFormData] = useState<BlogPostData>({
    title: editPost?.title || '',
    content: editPost?.content || '',
    timestamp: editPost?.timestamp || new Date().toISOString()
  });

  const handleInputChange = (field: keyof BlogPostData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim() && formData.content.trim()) {
      onSave({
        ...formData,
        id: editPost?.id,
        timestamp: editPost ? formData.timestamp : new Date().toISOString()
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
    <div className="blog-modal" onClick={handleOverlayClick}>
      <div className="blog-modal-content">
        <button className="close-button interactive" onClick={onClose}>
          <X size={20} />
        </button>
        
        <h2>{editPost ? 'Edit Post' : 'Create New Post'}</h2>
        
        <form onSubmit={handleSubmit} className="blog-form">
          <div className="form-group">
            <label className="form-label">Post Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="form-input"
              placeholder="Enter post title"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              className="form-textarea"
              placeholder="Write your blog post content here..."
              style={{ minHeight: '300px' }}
              required
            />
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
              {editPost ? 'Update Post' : 'Create Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BlogModal;