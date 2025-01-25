import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, Edit2, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { format } from 'date-fns';
import { Task } from '../types';
import { ResourceManager } from './ResourceManager';

type SortField = 'name' | 'priority' | 'due_date' | 'phase';
type SortDirection = 'asc' | 'desc';

export const TaskList = () => {
  const { 
    tasks, 
    selectedProject, 
    updateTask, 
    deleteTask, 
    error,
    fetchTasks,
    currentPage,
    totalPages,
    setPage,
    loading
  } = useStore();
  
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showCompleted, setShowCompleted] = useState(true);
  const [editingTask, setEditingTask] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProject) {
      fetchTasks(selectedProject.id, currentPage);
    }
  }, [selectedProject, currentPage, fetchTasks]);

  if (!selectedProject) return null;

  const handleToggleComplete = async (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateTask(task.id, { completed: !task.completed });
      setSelectedTasks(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  };

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this task?')) {
      await deleteTask(taskId);
      setSelectedTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleToggleSelect = (e: React.ChangeEvent<HTMLInputElement>, taskId: string) => {
    e.stopPropagation();
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleBulkComplete = async () => {
    if (selectedTasks.size === 0) return;
    
    try {
      for (const taskId of selectedTasks) {
        await updateTask(taskId, { completed: true });
      }
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('Error completing tasks:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedTasks.size} tasks?`)) return;
    
    try {
      for (const taskId of selectedTasks) {
        await deleteTask(taskId);
      }
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('Error deleting tasks:', error);
    }
  };

  const handleEditClick = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingTask(taskId);
    // You would typically open a modal or expand the task for editing here
    console.log('Edit task:', taskId);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortTasks = (a: Task, b: Task) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'name':
        return direction * (a.name || '').localeCompare(b.name || '');
      case 'priority': {
        const priorityOrder = { High: 0, Medium: 1, Low: 2 };
        return direction * ((priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0));
      }
      case 'due_date':
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return direction;
        if (!b.due_date) return -direction;
        return direction * (new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      case 'phase': {
        const phaseOrder = { Planning: 0, 'In Progress': 1, 'On Hold': 2, Completed: 3 };
        return direction * ((phaseOrder[a.phase] || 0) - (phaseOrder[b.phase] || 0));
      }
      default:
        return 0;
    }
  };

  const filteredAndSortedTasks = tasks
    .filter(task => {
      if (!showCompleted && task.completed) return false;
      if (filterPhase !== 'all' && task.phase !== filterPhase) return false;
      if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
      return true;
    })
    .sort(sortTasks);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Tasks</h3>
        <div className="flex items-center space-x-2">
          {selectedTasks.size > 0 && (
            <>
              <button
                onClick={handleBulkComplete}
                className="text-sm text-[#4DB6AC] hover:text-[#4DB6AC]/80 transition-colors"
              >
                Complete Selected
              </button>
              <button
                onClick={handleBulkDelete}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Delete Selected
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 text-red-300 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pb-4">
        <select
          value={filterPhase}
          onChange={(e) => setFilterPhase(e.target.value)}
          className="text-sm bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
        >
          <option value="all">All Phases</option>
          <option value="Planning">Planning</option>
          <option value="In Progress">In Progress</option>
          <option value="On Hold">On Hold</option>
          <option value="Completed">Completed</option>
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-sm bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
        >
          <option value="all">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded bg-gray-800 border-gray-700 text-[#5DADEC] focus:ring-[#5DADEC]"
          />
          <span className="text-sm text-gray-300">Show Completed</span>
        </label>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-400 pb-2">
        <button
          onClick={() => toggleSort('name')}
          className="flex items-center space-x-1 hover:text-[#5DADEC] transition-colors"
        >
          <span>Name</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => toggleSort('priority')}
          className="flex items-center space-x-1 hover:text-[#5DADEC] transition-colors"
        >
          <span>Priority</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => toggleSort('due_date')}
          className="flex items-center space-x-1 hover:text-[#5DADEC] transition-colors"
        >
          <span>Due Date</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => toggleSort('phase')}
          className="flex items-center space-x-1 hover:text-[#5DADEC] transition-colors"
        >
          <span>Phase</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {filteredAndSortedTasks.length === 0 ? (
          <p className="text-gray-400 text-sm">No tasks match your criteria</p>
        ) : (
          <>
            {filteredAndSortedTasks.map((task) => (
              <div
                key={task.id}
                className={`task-card ${
                  selectedTasks.has(task.id) ? 'task-card-selected' : 'task-card-normal'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTasks.has(task.id)}
                  onChange={(e) => handleToggleSelect(e, task.id)}
                  className="rounded bg-gray-800 border-gray-700 text-[#5DADEC] 
                           focus:ring-[#5DADEC] transition-colors"
                />
                <button
                  onClick={(e) => handleToggleComplete(e, task)}
                  className="p-2 -m-2 rounded-full hover:bg-gray-700/50 text-gray-500 hover:text-[#4DB6AC] transition-colors cursor-pointer"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-medium ${
                    task.completed ? 'text-gray-500 line-through' : 'text-gray-200'
                  }`}>
                    {task.name}
                  </h4>
                  {task.description && (
                    <p className="text-xs text-gray-400 truncate">
                      {task.description}
                    </p>
                  )}
                  {task.due_date && (
                    <p className="text-xs text-gray-400">
                      Due {format(new Date(task.due_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`status-badge ${
                    task.priority === 'High'
                      ? 'status-badge-high'
                      : task.priority === 'Medium'
                      ? 'status-badge-medium'
                      : 'status-badge-low'
                  }`}>
                    {task.priority}
                  </span>
                  <span className={`phase-badge ${
                    task.phase === 'Planning'
                      ? 'phase-badge-planning'
                      : task.phase === 'In Progress'
                      ? 'phase-badge-progress'
                      : task.phase === 'On Hold'
                      ? 'phase-badge-hold'
                      : 'phase-badge-completed'
                  }`}>
                    {task.phase}
                  </span>
                  <button
                    onClick={(e) => handleDeleteTask(e, task.id)}
                    className="p-2 -m-2 rounded-full hover:bg-gray-700/50 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleEditClick(e, task.id)}
                    className="p-2 -m-2 rounded-full hover:bg-gray-700/50 text-gray-400 hover:text-[#5DADEC] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-gray-800/50 pt-4 mt-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">
                  Page {currentPage} of {Math.max(1, totalPages)}
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1 || loading}
                  className="p-2 rounded hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-400 hover:text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages || loading}
                  className="p-2 rounded hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-400 hover:text-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedTasks.size === 1 && (
        <div className="mt-6 pt-6 border-t border-gray-800">
          <ResourceManager taskId={Array.from(selectedTasks)[0]} />
        </div>
      )}
    </div>
  );
};