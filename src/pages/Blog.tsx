import React, { useState } from 'react';
import { Calendar, Clock, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BlogModal, { BlogPostData } from '../components/BlogModal';

interface BlogPost {
  id: number;
  title: string;
  content: string;
  timestamp: string;
}

const Blog: React.FC = () => {
  const { isAdmin } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([
    {
      id: 1,
      title: 'Welcome to My Blog',
      content: `Welcome to my personal blog! This is where I'll be sharing my thoughts, experiences, and insights about technology, software development, and life in general.

I'm excited to start this journey of documenting my learning process and sharing knowledge with the community. You can expect posts about:

- Software development best practices
- New technologies I'm exploring
- Project updates and lessons learned
- Personal reflections on the tech industry

Stay tuned for more content coming soon!

![Welcome Image](https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=800)

Thank you for visiting, and I hope you find the content valuable and engaging.`,
      timestamp: '2025-01-15T10:30:00Z'
    },
    {
      id: 2,
      title: 'Building Modern Web Applications',
      content: `In today's fast-paced digital world, building modern web applications requires a deep understanding of both frontend and backend technologies. Let me share some insights from my recent projects.

## Key Technologies I'm Using

### Frontend
- **React**: For building interactive user interfaces
- **TypeScript**: For type-safe development
- **Tailwind CSS**: For rapid UI development

### Backend
- **Node.js**: For server-side development
- **PostgreSQL**: For robust data storage
- **Docker**: For containerization and deployment

## Best Practices

1. **Component-Based Architecture**: Breaking down the UI into reusable components
2. **State Management**: Using proper state management patterns
3. **Performance Optimization**: Implementing lazy loading and code splitting
4. **Testing**: Writing comprehensive unit and integration tests

![Development Setup](https://images.pexels.com/photos/574071/pexels-photo-574071.jpeg?auto=compress&cs=tinysrgb&w=800)

The key to successful web development is staying updated with the latest trends while maintaining a solid foundation in core principles.`,
      timestamp: '2025-01-10T14:45:00Z'
    },
    {
      id: 3,
      title: 'The Future of AI in Software Development',
      content: `Artificial Intelligence is revolutionizing the way we approach software development. From code generation to automated testing, AI tools are becoming indispensable for modern developers.

## Current AI Tools in Development

- **GitHub Copilot**: AI-powered code completion
- **ChatGPT**: For problem-solving and code explanation
- **Automated Testing**: AI-driven test case generation

## Impact on Developers

While some fear that AI might replace developers, I believe it will augment our capabilities rather than replace us. AI handles repetitive tasks, allowing us to focus on:

- Creative problem solving
- System architecture design
- User experience optimization
- Strategic decision making

![AI Technology](https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800)

The future belongs to developers who can effectively collaborate with AI tools to build better software faster.`,
      timestamp: '2025-01-05T09:15:00Z'
    }
  ]);

  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 5;

  // Sort posts by timestamp (newest first)
  const sortedPosts = [...posts].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Pagination
  const totalPages = Math.ceil(sortedPosts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const currentPosts = sortedPosts.slice(startIndex, startIndex + postsPerPage);

  const handlePostClick = (postId: number) => {
    setExpandedPost(expandedPost === postId ? null : postId);
  };

  const handleCreatePost = (postData: BlogPostData) => {
    const newPost: BlogPost = {
      id: Date.now(),
      title: postData.title,
      content: postData.content,
      timestamp: new Date().toISOString()
    };
    setPosts([newPost, ...posts]);
  };

  const handleEditPost = (postData: BlogPostData) => {
    if (postData.id) {
      setPosts(posts.map(post => 
        post.id === postData.id 
          ? { ...post, title: postData.title, content: postData.content }
          : post
      ));
    }
    setEditingPost(null);
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
      // Render full content with images
      return content.split('\n').map((paragraph, index) => {
        if (paragraph.startsWith('![') && paragraph.includes('](')) {
          // Handle image markdown
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
      // Show preview (first 150 characters)
      const plainText = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/##\s/g, '');
      return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
    }
  };

  return (
    <div className="blog-page">
      <div className="blog-container">
        <div className="blog-header">
          <h1 className="blog-title">Blog</h1>
          <p className="blog-subtitle">
            Thoughts, insights, and experiences from my journey in technology
          </p>
        </div>

        <div className="blog-posts">
          {currentPosts.map((post) => (
            <article 
              key={post.id} 
              className={`blog-post ${expandedPost === post.id ? 'expanded' : ''} interactive`}
              onClick={() => handlePostClick(post.id)}
            >
              <div className="post-header">
                <h2 className="post-title">{post.title}</h2>
                <div className="post-date">
                  <Calendar size={16} />
                  <span>{formatDate(post.timestamp)}</span>
                  <Clock size={16} />
                  <span>{formatTime(post.timestamp)}</span>
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

              {isAdmin && expandedPost === post.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPost(post);
                      setShowBlogModal(true);
                    }}
                    className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition-colors"
                  >
                    Edit Post
                  </button>
                </div>
              )}
            </article>
          ))}
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

        {isAdmin && (
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
          editPost={editingPost}
        />
      )}
    </div>
  );
};

export default Blog;