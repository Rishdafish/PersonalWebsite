import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { blogAPI, BlogPost } from '../lib/supabase';
import BlogModal, { BlogPostData } from '../components/BlogModal';
import CommentSystem from '../components/CommentSystem';

const Blog: React.FC = () => {
  const { user, canEditContent } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const postsPerPage = 5;

  useEffect(() => {
    loadPosts();
  }, [user]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await blogAPI.getAll(canEditContent ? user?.id : undefined);
      setPosts(data || []);
    } catch (err) {
      console.error('Error loading posts:', err);
      setError('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (postData: BlogPostData) => {
    if (!user) return;

    try {
      const newPost = await blogAPI.create({
        user_id: user.id,
        title: postData.title,
        content: postData.content,
        published: true
      });
      
      setPosts([newPost, ...posts]);
      setShowBlogModal(false);
    } catch (err) {
      console.error('Error creating post:', err);
      setError('Failed to create blog post');
    }
  };

  const handleEditPost = async (postData: BlogPostData) => {
    if (!editingPost) return;

    try {
      const updatedPost = await blogAPI.update(editingPost.id, {
        title: postData.title,
        content: postData.content
      });
      
      setPosts(posts.map(post => 
        post.id === editingPost.id ? updatedPost : post
      ));
      setEditingPost(null);
      setShowBlogModal(false);
    } catch (err) {
      console.error('Error updating post:', err);
      setError('Failed to update blog post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      await blogAPI.delete(postId);
      setPosts(posts.filter(post => post.id !== postId));
    } catch (err) {
      console.error('Error deleting post:', err);
      setError('Failed to delete blog post');
    }
  };

  const handlePostClick = (postId: string) => {
    setExpandedPost(expandedPost === postId ? null : postId);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const renderContent = (content: string, isExpanded: boolean) => {
    if (isExpanded) {
      return content.split('\n').map((paragraph, index) => {
        if (paragraph.startsWith('![') && paragraph.includes('](')) {
          const match = paragraph.match(/!\[([^\]]*)\]\(([^)]+)\)/);
          if (match) {
            return (
              <img 
                key={index}
                src={match[2]} 
                alt={match[1]} 
                className="max-w-full h-auto rounded-lg my-4 mx-auto block"
              />
            );
          }
        } else if (paragraph.startsWith('## ')) {
          return (
            <h3 key={index} className="text-xl font-semibold mt-6 mb-3 text-gray-800">
              {paragraph.replace('## ', '')}
            </h3>
          );
        } else if (paragraph.startsWith('### ')) {
          return (
            <h4 key={index} className="text-lg font-semibold mt-4 mb-2 text-gray-800">
              {paragraph.replace('### ', '')}
            </h4>
          );
        } else if (paragraph.startsWith('- **') || paragraph.startsWith('1. **')) {
          return (
            <li key={index} className="ml-4 mb-1">
              <span dangerouslySetInnerHTML={{ 
                __html: paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^[0-9]+\.\s|-\s/, '') 
              }} />
            </li>
          );
        } else if (paragraph.trim() === '') {
          return <br key={index} />;
        } else {
          return (
            <p key={index} className="mb-3">
              <span dangerouslySetInnerHTML={{ 
                __html: paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
              }} />
            </p>
          );
        }
      });
    } else {
      const plainText = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/##\s/g, '');
      return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
    }
  };

  // Pagination
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const currentPosts = posts.slice(startIndex, startIndex + postsPerPage);

  if (loading) {
    return (
      <div className="blog-page">
        <div className="blog-container">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-page">
      <div className="blog-container">
        <div className="blog-header">
          <h1 className="blog-title">Blog</h1>
          <p className="blog-subtitle">
            Thoughts, insights, and experiences from my journey in technology
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="blog-posts">
          {currentPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg mb-4">No blog posts yet</p>
              {canEditContent && (
                <button
                  onClick={() => setShowBlogModal(true)}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Create your first post
                </button>
              )}
            </div>
          ) : (
            currentPosts.map((post) => (
              <article 
                key={post.id} 
                className={`blog-post ${expandedPost === post.id ? 'expanded' : ''} interactive`}
                onClick={() => handlePostClick(post.id)}
              >
                <div className="post-header">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h2 className="post-title">{post.title}</h2>
                      <div className="post-date">
                        <Calendar size={16} />
                        <span>{formatDate(post.created_at)}</span>
                        <Clock size={16} />
                        <span>{formatTime(post.created_at)}</span>
                      </div>
                    </div>
                    
                    {canEditContent && (
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPost(post);
                            setShowBlogModal(true);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit post"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePost(post.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete post"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="post-content">
                  {renderContent(post.content, expandedPost === post.id)}
                </div>

                {expandedPost !== post.id && (
                  <button className="read-more">
                    Read more
                  </button>
                )}

                {expandedPost === post.id && (
                  <CommentSystem postId={post.id} />
                )}
              </article>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`pagination-btn interactive ${currentPage === page ? 'active' : ''}`}
              >
                {page}
              </button>
            ))}
          </div>
        )}

        {canEditContent && (
          <button 
            onClick={() => {
              setEditingPost(null);
              setShowBlogModal(true);
            }}
            className="add-post-btn interactive"
            title="Add New Post"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      {showBlogModal && (
        <BlogModal
          onClose={() => {
            setShowBlogModal(false);
            setEditingPost(null);
          }}
          onSave={editingPost ? handleEditPost : handleCreatePost}
          editPost={editingPost ? {
            id: parseInt(editingPost.id.replace(/-/g, '').substring(0, 8), 16),
            title: editingPost.title,
            content: editingPost.content,
            timestamp: editingPost.created_at
          } : null}
        />
      )}
    </div>
  );
};

export default Blog;