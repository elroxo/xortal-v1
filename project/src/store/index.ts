import { create } from 'zustand';
import { Message, Project, Task, Note, Resource, Reminder } from '../types';
import { supabase, initializeAuth } from '../lib/supabase';
import { withRetry } from '../lib/retryHandler';
import { parseError, AppError } from '../lib/errorHandler';
import { offlineQueue, QueuedOperation } from '../lib/offlineQueue';

const ITEMS_PER_PAGE = 10;

interface AppState {
  projects: Project[];
  tasks: Task[];
  notes: Note[];
  resources: Resource[];
  reminders: Reminder[];
  messages: Message[];
  selectedProject: Project | null;
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  lastError: AppError | null;
  isOffline: boolean;
  
  fetchProjects: (page?: number) => Promise<void>;
  fetchTasks: (projectId?: string, page?: number) => Promise<void>;
  fetchNotes: (projectId?: string, taskId?: string) => Promise<void>;
  fetchResources: (projectId?: string, taskId?: string) => Promise<void>;
  fetchReminders: () => Promise<void>;
  
  createProject: (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  createTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  createNote: (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  createResource: (resource: Omit<Resource, 'id' | 'created_at'>) => Promise<void>;
  createReminder: (reminder: Omit<Reminder, 'id'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  addMessage: (message: Omit<Message, 'id'>) => void;
  setSelectedProject: (project: Project | null) => Promise<void>;
  setError: (error: string | null) => void;
  setPage: (page: number) => void;
  processOfflineOperation: (operation: QueuedOperation) => Promise<void>;
  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  tasks: [],
  notes: [],
  resources: [],
  reminders: [],
  messages: [],
  selectedProject: null,
  loading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  lastError: null,
  isOffline: !navigator.onLine,

  fetchProjects: async (page = 1) => {
    try {
      set({ loading: true, error: null });

      // Ensure we have an authenticated session
      await initializeAuth();
      
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });

      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (error) throw error;

      set({
        projects: projects || [],
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
        currentPage: page,
        error: null
      });
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError,
        projects: [] // Reset on error
      });
      console.error('Error fetching projects:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchTasks: async (projectId?: string, page = 1) => {
    try {
      set({ loading: true, error: null });
      
      let query = supabase
        .from('tasks')
        .select('*', { count: 'exact' });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { count } = await query.select('*', { count: 'exact', head: true });
      const totalPages = Math.max(1, Math.ceil((count || 0) / ITEMS_PER_PAGE));
      const safePage = Math.min(Math.max(1, page), totalPages);

      const { data: tasks, error } = await query
        .order('created_at', { ascending: false })
        .range((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE - 1);

      if (error) throw error;

      set({
        tasks: tasks || [],
        totalPages,
        currentPage: safePage
      });
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error fetching tasks:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchNotes: async (projectId?: string, taskId?: string) => {
    try {
      set({ loading: true, error: null });
      let query = supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      if (taskId) {
        query = query.eq('task_id', taskId);
      }

      const { data: notes, error } = await query;
      if (error) throw error;
      set({ notes: notes || [] });
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error fetching notes:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchResources: async (projectId?: string, taskId?: string) => {
    try {
      set({ loading: true, error: null });
      let query = supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      if (taskId) {
        query = query.eq('task_id', taskId);
      }

      const { data: resources, error } = await query;
      if (error) throw error;
      set({ resources: resources || [] });
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error fetching resources:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchReminders: async () => {
    try {
      set({ loading: true, error: null });
      const { data: reminders, error } = await supabase
        .from('reminders')
        .select('*')
        .order('reminder_date', { ascending: true });

      if (error) throw error;
      set({ reminders: reminders || [] });
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error fetching reminders:', error);
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (project) => {
    try {
      set({ loading: true, error: null });

      // Ensure we have an anonymous session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
      }

      const { data, error } = await supabase
        .from('projects')
        .insert([project])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({ projects: [data, ...state.projects] }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error creating project:', error);
    } finally {
      set({ loading: false });
    }
  },

  createTask: async (task) => {
    try {
      set({ loading: true, error: null });
      
      if (!navigator.onLine) {
        offlineQueue.addOperation({
          type: 'create',
          entity: 'task',
          data: task
        });
        
        set({ 
          lastError: {
            type: 'network',
            message: 'You are currently offline.',
            details: 'The task will be created when you reconnect.',
            resolution: 'Your changes have been saved and will sync automatically.',
            retryable: false
          }
        });
        return;
      }

      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('tasks')
          .insert([task])
          .select()
          .single();

        if (error) throw error;
        return data;
      });

      set((state) => ({ tasks: [result, ...state.tasks] }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error creating task:', error);
    } finally {
      set({ loading: false });
    }
  },

  createNote: async (note) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('notes')
        .insert([note])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({ notes: [data, ...state.notes] }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error creating note:', error);
    } finally {
      set({ loading: false });
    }
  },

  createResource: async (resource) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('resources')
        .insert([resource])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({ resources: [data, ...state.resources] }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error creating resource:', error);
    } finally {
      set({ loading: false });
    }
  },

  createReminder: async (reminder) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('reminders')
        .insert([reminder])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({ reminders: [data, ...state.reminders] }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error creating reminder:', error);
    } finally {
      set({ loading: false });
    }
  },

  updateProject: async (id, updates) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? data : p)),
      }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error updating project:', error);
    } finally {
      set({ loading: false });
    }
  },

  updateTask: async (id, updates) => {
    try {
      set({ loading: true, error: null });

      if (!navigator.onLine) {
        offlineQueue.addOperation({
          type: 'update',
          entity: 'task',
          data: { id, ...updates }
        });
        
        set({ 
          lastError: {
            type: 'network',
            message: 'You are currently offline.',
            details: 'The task will be updated when you reconnect.',
            resolution: 'Your changes have been saved and will sync automatically.',
            retryable: false
          }
        });
        return;
      }

      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      });

      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? result : t)),
      }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error updating task:', error);
    } finally {
      set({ loading: false });
    }
  },

  archiveProject: async (id) => {
    try {
      set({ loading: true, error: null });
      const { error } = await supabase
        .from('projects')
        .update({ archived: true })
        .eq('id', id);

      if (error) throw error;
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error archiving project:', error);
    } finally {
      set({ loading: false });
    }
  },

  deleteTask: async (id) => {
    try {
      set({ loading: true, error: null });

      if (!navigator.onLine) {
        offlineQueue.addOperation({
          type: 'delete',
          entity: 'task',
          data: { id }
        });
        
        set({ 
          lastError: {
            type: 'network',
            message: 'You are currently offline.',
            details: 'The task will be deleted when you reconnect.',
            resolution: 'Your changes have been saved and will sync automatically.',
            retryable: false
          }
        });
        return;
      }

      await withRetry(async () => {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', id);

        if (error) throw error;
      });

      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error deleting task:', error);
    } finally {
      set({ loading: false });
    }
  },

  deleteResource: async (id) => {
    try {
      set({ loading: true, error: null });
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      set((state) => ({
        resources: state.resources.filter((r) => r.id !== id),
      }));
    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError
      });
      console.error('Error deleting resource:', error);
    } finally {
      set({ loading: false });
    }
  },

  addMessage: (message) => {
    const newMessage = {
      ...message,
      id: crypto.randomUUID(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  setSelectedProject: async (project) => {
    try {
      set({ loading: true, error: null });
      
      // Clear existing data first
      set({ 
        selectedProject: null,
        tasks: [],
        notes: [],
        resources: [],
        currentPage: 1
      });

      // If no project selected, just return
      if (!project) {
        set({ loading: false });
        return;
      }

      // Set the selected project immediately for UI feedback
      set({ selectedProject: project });

      // Fetch all related data concurrently
      await Promise.all([
        get().fetchTasks(project.id, 1),
        get().fetchNotes(project.id),
        get().fetchResources(project.id)
      ]);

    } catch (error) {
      const appError = parseError(error);
      set({ 
        error: appError.message,
        lastError: appError,
        selectedProject: null // Reset on error
      });
      console.error('Error setting selected project:', error);
    } finally {
      set({ loading: false });
    }
  },

  processOfflineOperation: async (operation: QueuedOperation) => {
    const { type, entity, data } = operation;
    
    switch (entity) {
      case 'task':
        switch (type) {
          case 'create':
            await get().createTask(data);
            break;
          case 'update':
            await get().updateTask(data.id, data);
            break;
          case 'delete':
            await get().deleteTask(data.id);
            break;
        }
        break;
    }
  },

  clearError: () => set({ lastError: null, error: null }),

  setError: (error) => set({ error }),

  setPage: (page: number) => set({ currentPage: page }),
}));