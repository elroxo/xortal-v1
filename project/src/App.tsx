import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { TaskList } from './components/TaskList';
import { ErrorDisplay } from './components/ErrorDisplay';
import { ResourceManager } from './components/ResourceManager';
import { useStore } from './store';

function App() {
  const { fetchProjects, selectedProject } = useStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="flex h-screen bg-[#1C1C1C] text-white">
      <Sidebar />
      <main className="flex-1 flex">
        <div className="flex-1 flex flex-col">
          <ChatInterface />
          {selectedProject && (
            <div className="p-6 border-t border-gray-800">
              <ResourceManager projectId={selectedProject.id} />
            </div>
          )}
        </div>
        <aside className="w-80 border-l border-gray-800 p-4 overflow-y-auto">
          <TaskList />
        </aside>
      </main>
      <ErrorDisplay />
    </div>
  );
}

export default App;