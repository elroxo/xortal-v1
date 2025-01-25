import React, { useState } from 'react';
import { Brain, FolderOpen, Inbox, Plus, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { Project } from '../types';

export const Sidebar = () => {
  const { projects, selectedProject, setSelectedProject, loading, createProject } = useStore();
  const [isCreating, setIsCreating] = useState(false);

  const handleProjectClick = async (project: Project) => {
    // Prevent re-selecting the same project
    if (selectedProject?.id === project.id) return;
    
    try {
      await setSelectedProject(project);
    } catch (error) {
      console.error('Error selecting project:', error);
    }
  };

  const handleCreateProject = async () => {
    setIsCreating(true);
    try {
      await createProject({
        name: 'New Project',
        description: null,
        phase: 'Planning',
        priority: 'Medium',
        timeline_type: 'Flexible',
        archived: false
      });
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-64 bg-[#1C1C1C] border-r border-gray-800/50 h-screen p-6">
      <div className="flex items-center space-x-3 mb-8">
        <Brain className="w-8 h-8 text-primary animate-pulse-slow" />
        <h1 className="text-xl font-bold text-white">Zortal V1</h1>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-300">Projects</h2>
        <button 
          onClick={handleCreateProject}
          disabled={isCreating}
          className="p-2 hover:bg-gray-800 rounded-full text-gray-300 hover:text-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="space-y-1">
        <button 
          onClick={() => setSelectedProject(null)}
          disabled={loading}
          className={`flex items-center space-x-2 w-full p-3 rounded-lg hover:bg-gray-800/50 text-gray-300 hover:text-white transition-all duration-200 ${
            !selectedProject ? 'bg-primary/10 text-primary' : ''
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Inbox className="w-5 h-5" />
          <span>Inbox</span>
        </button>

        <div className="pt-4 space-y-1">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleProjectClick(project)}
              disabled={loading}
              className={`flex items-center justify-between w-full p-3 rounded-lg transition-all duration-200 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                selectedProject?.id === project.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <FolderOpen className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{project.name}</span>
              </div>
              {loading && selectedProject?.id === project.id && (
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};