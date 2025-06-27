import React, { useState } from 'react';
import { ExternalLink, Github, Plus, Calendar, Edit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProjectModal, { ProjectData } from '../components/ProjectModal';

interface Project {
  id: number;
  title: string;
  description: string;
  technologies: string[];
  status: string;
  liveDemo: string;
  github: string;
  timestamp: string;
  details?: string;
}

const Projects: React.FC = () => {
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([
    {
      id: 1,
      title: 'AI-Powered Data Analytics Platform',
      description: 'A comprehensive platform for analyzing large datasets using machine learning algorithms and providing real-time insights.',
      technologies: ['Python', 'TensorFlow', 'React', 'PostgreSQL', 'Docker'],
      status: 'Active',
      liveDemo: 'https://analytics-demo.example.com',
      github: 'https://github.com/rishi-biry/analytics-platform',
      timestamp: '2024-01-15T10:30:00Z',
      details: 'This platform processes over 1TB of data daily and serves insights to 10,000+ users. Built with scalability and performance in mind.'
    },
    {
      id: 2,
      title: 'Blockchain Voting System',
      description: 'Secure and transparent voting system built on blockchain technology to ensure election integrity.',
      technologies: ['Solidity', 'Web3.js', 'React', 'Node.js', 'Ethereum'],
      status: 'Completed',
      liveDemo: 'https://voting-demo.example.com',
      github: 'https://github.com/rishi-biry/blockchain-voting',
      timestamp: '2023-12-20T14:45:00Z',
      details: 'Successfully deployed for local elections with 99.9% uptime and zero security incidents.'
    },
    {
      id: 3,
      title: 'Real-time Chat Application',
      description: 'Modern chat application with real-time messaging, file sharing, and video calling capabilities.',
      technologies: ['React', 'Socket.io', 'Node.js', 'MongoDB', 'WebRTC'],
      status: 'Developing',
      liveDemo: 'https://chat-demo.example.com',
      github: 'https://github.com/rishi-biry/chat-app',
      timestamp: '2024-01-10T09:15:00Z',
      details: 'Currently supporting 1000+ concurrent users with plans to scale to 10,000+.'
    }
  ]);

  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleProjectClick = (projectId: number) => {
    setExpandedProject(expandedProject === projectId ? null : projectId);
  };

  const handleCreateProject = (projectData: ProjectData) => {
    const newProject: Project = {
      id: Date.now(),
      title: projectData.title,
      description: projectData.description,
      technologies: projectData.technologies,
      status: projectData.status,
      liveDemo: projectData.liveDemo || '#',
      github: projectData.github || '#',
      timestamp: new Date().toISOString(),
      details: 'Project details will be updated as development progresses.'
    };
    setProjects([newProject, ...projects]);
  };

  const handleEditProject = (projectData: ProjectData) => {
    if (projectData.id) {
      setProjects(projects.map(project => 
        project.id === projectData.id 
          ? {
              ...project,
              title: projectData.title,
              description: projectData.description,
              technologies: projectData.technologies,
              status: projectData.status,
              liveDemo: projectData.liveDemo || '#',
              github: projectData.github || '#'
            }
          : project
      ));
    }
    setEditingProject(null);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Active': return 'status-active';
      case 'Completed': return 'status-completed';
      case 'Developing': return 'status-developing';
      case 'Planning': return 'status-planning';
      default: return 'status-planning';
    }
  };

  return (
    <div className="projects-page">
      <div className="projects-container">
        <div className="projects-header">
          <h1 className="projects-title">My Projects</h1>
          <p className="projects-subtitle">
            A collection of my work in software development, AI, and blockchain technology
          </p>
        </div>

        <div className="projects-grid">
          {projects.map((project) => (
            <div 
              key={project.id} 
              className={`project-card ${expandedProject === project.id ? 'expanded' : ''} interactive`}
              onClick={() => handleProjectClick(project.id)}
            >
              <div className="project-header">
                <div className="project-title-section">
                  <h3 className="project-title">{project.title}</h3>
                  <div className="project-date">
                    <Calendar size={14} />
                    <span>{formatDate(project.timestamp)}</span>
                  </div>
                </div>
                <span className={`project-status ${getStatusClass(project.status)}`}>
                  {project.status}
                </span>
              </div>
              
              <p className="project-description">{project.description}</p>
              
              <div className="project-tech">
                {project.technologies.map((tech, index) => (
                  <span key={index} className="tech-tag">{tech}</span>
                ))}
              </div>

              {expandedProject === project.id && project.details && (
                <div className="project-details">
                  <h4 className="font-semibold mb-2">Project Details</h4>
                  <p className="text-gray-600 mb-4">{project.details}</p>
                  
                  <div className="project-links">
                    {project.liveDemo !== '#' && (
                      <a 
                        href={project.liveDemo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="project-link interactive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={16} />
                        Live Demo
                      </a>
                    )}
                    {project.github !== '#' && (
                      <a 
                        href={project.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="project-link interactive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Github size={16} />
                        Source Code
                      </a>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject({
                            ...project,
                            startDate: project.timestamp.split('T')[0]
                          });
                          setShowProjectModal(true);
                        }}
                        className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition-colors interactive"
                      >
                        <Edit size={14} />
                        Edit Project
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <button 
            onClick={() => {
              setEditingProject(null);
              setShowProjectModal(true);
            }}
            className="add-project-btn interactive"
            title="Add New Project"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      {showProjectModal && (
        <ProjectModal
          onClose={() => {
            setShowProjectModal(false);
            setEditingProject(null);
          }}
          onSave={editingProject ? handleEditProject : handleCreateProject}
          editProject={editingProject ? {
            id: editingProject.id,
            title: editingProject.title,
            startDate: editingProject.timestamp.split('T')[0],
            description: editingProject.description,
            technologies: editingProject.technologies,
            github: editingProject.github,
            liveDemo: editingProject.liveDemo,
            status: editingProject.status
          } : null}
        />
      )}
    </div>
  );
};

export default Projects;