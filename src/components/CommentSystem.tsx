import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, User, Edit3, Trash2, Crown, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    email: string;
    role: 'admin' | 'regular' | 'specialized';
  };
}

interface CommentSystemProps {
  postId: string;
}

const CommentSystem: React.FC<CommentSystemProps> = ({ postId }) => {
  const { user, isAuthenticated, canComment, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments, postId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_comments')
        .select(`
          *,
          user_profiles (
            email,
            role
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Error loading comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user || !canComment) return;

    try {
      const { data, error } = await supabase
        .from('blog_comments')
        .insert([{
          post_id: postId,
          user_id: user.id,
          content: newComment.trim()
        }])
        .select(`
          *,
          user_profiles (
            email,
            role
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        setComments([...comments, data]);
        setNewComment('');
      }
    } catch (err) {
      console.error('Error creating comment:', err);
      setError('Failed to post comment');
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const { data, error } = await supabase
        .from('blog_comments')
        .update({ content: editContent.trim() })
        .eq('id', commentId)
        .select(`
          *,
          user_profiles (
            email,
            role
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        setComments(comments.map(comment => 
          comment.id === commentId ? data : comment
        ));
        setEditingComment(null);
        setEditContent('');
      }
    } catch (err) {
      console.error('Error updating comment:', err);
      setError('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const { error } = await supabase
        .from('blog_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setComments(comments.filter(comment => comment.id !== commentId));
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError('Failed to delete comment');
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingComment(null);
    setEditContent('');
  };

  const canEditComment = (comment: Comment) => {
    return user && (user.id === comment.user_id || isAdmin);
  };

  const canDeleteComment = (comment: Comment) => {
    return user && (user.id === comment.user_id || isAdmin);
  };

  const formatCommentDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown size={12} className="text-yellow-500" />;
      case 'specialized':
        return <Key size={12} className="text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <button
        onClick={() => setShowComments(!showComments)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors mb-4"
      >
        <MessageCircle size={18} />
        <span>{comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}</span>
      </button>

      {showComments && (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 text-xs mt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Comment Form */}
          {isAuthenticated && canComment && (
            <form onSubmit={handleSubmitComment} className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <User size={16} className="text-gray-600" />
                </div>
              </div>
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={16} />
                    <span>Comment</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Access message for users who can't comment */}
          {isAuthenticated && !canComment && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                You need specialized access to comment on blog posts. Contact an administrator for a specialized access token.
              </p>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <User size={16} className="text-gray-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900 text-sm">
                            {comment.user_profiles?.email || 'Unknown User'}
                          </span>
                          {comment.user_profiles?.role && getRoleIcon(comment.user_profiles.role)}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            {formatCommentDate(comment.created_at)}
                            {comment.updated_at !== comment.created_at && ' (edited)'}
                          </span>
                          {canEditComment(comment) && (
                            <div className="flex space-x-1">
                              <button
                                onClick={() => startEditing(comment)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit comment"
                              >
                                <Edit3 size={12} />
                              </button>
                              {canDeleteComment(comment) && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Delete comment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {editingComment === comment.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditComment(comment.id)}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-700 text-sm">{comment.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentSystem;