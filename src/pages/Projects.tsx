import React, { useState, useEffect } from 'react';
import { ExternalLink, Github, Plus, Calendar, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectsAPI, Project } from '../lib/supabase';
import ProjectModal, { ProjectData } from '../components/ProjectModal';

const Projects: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectsAPI.getAll(isAdmin ? user?.id : undefined);
      setProjects(data || []);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData: ProjectData) => {
    if (!user) return;

    try {
      const newProject = await projectsAPI.create({
        user_id: user.id,
        title: projectData.title,
        description: projectData.description,
        technologies: projectData.technologies,
        status: projectData.status,
        github_url: projectData.github || undefined,
        live_demo_url: projectData.liveDemo || undefined,
        start_date: projectData.startDate
      });
      
      setProjects([newProject, ...projects]);
      setShowProjectModal(false);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project');
    }
  };

  const handleEditProject = async (projectData: ProjectData) => {
    if (!editingProject) return;

    try {
      const updatedProject = await projectsAPI.update(editingProject.id, {
        title: projectData.title,
        description: projectData.description,
        technologies: projectData.technologies,
        status: projectData.status,
        github_url: projectData.github || undefined,
        live_demo_url: projectData.liveDemo || undefined,
        start_date: projectData.startDate
      });
      
      setProjects(projects.map(project => 
        project.id === editingProject.id ? updatedProject : project
      ));
      setEditingProject(null);
      setShowProjectModal(false);
    } catch (err) {
      console.error('Error updating project:', err);
      setError('Failed to update project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await projectsAPI.delete(projectId);
      setProjects(projects.filter(project => project.id !== projectId));
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project');
    }
  };

  const handleProjectClick = (projectId: string) => {
    setExpandedProject(expandedProject === projectId ? null : projectId);
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

  if (loading) {
    return (
      <div className="projects-page">
        <div className="projects-container">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-page">
      <div className="projects-container">
        <div className="projects-header">
          <h1 className="projects-title">My Projects</h1>
          <p className="projects-subtitle">
            A collection of my work in software development, AI, and blockchain technology
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

        <div className="projects-grid">
          {projects.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg mb-4">No projects yet</p>
              {isAdmin && (
                <button
                  onClick={() => setShowProjectModal(true)}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Create your first project
                </button>
              )}
            </div>
          ) : (
            projects.map((project) => (
              <div 
                key={project.id} 
                className={`project-card ${expandedProject === project.id ? 'expanded' : ''} interactive`}
                onClick={() => handleProjectClick(project.id)}
              >
                <div className="project-header">
                  <div className="project-title-section">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="project-title">{project.title}</h3>
                        <div className="project-date">
                          <Calendar size={14} />
                          <span>{formatDate(project.start_date)}</span>
                        </div>
                      </div>
                      
                      {isAdmin && (
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProject(project);
                              setShowProjectModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit project"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete project"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
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

                {expandedProject === project.id && (
                  <div className="project-details">
                    <div className="project-links">
                      {project.live_demo_url && (
                        <a 
                          href={project.live_demo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="project-link interactive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={16} />
                          Live Demo
                        </a>
                      )}
                      {project.github_url && (
                        <a 
                          href={project.github_url}
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
                  </div>
                )}
              </div>
            ))
          )}
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
            id: parseInt(editingProject.id.replace(/-/g, '').substring(0, 8), 16),
            title: editingProject.title,
            startDate: editingProject.start_date,
            description: editingProject.description,
            technologies: editingProject.technologies,
            github: editingProject.github_url || '',
            liveDemo: editingProject.live_demo_url || '',
            status: editingProject.status
          } : null}
        />
      )}
    </div>
  );
};

export default Projects;