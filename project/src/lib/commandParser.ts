import { format, parse, addDays } from 'date-fns';
import { Task, Project } from '../types';

export type CommandType = 
  | 'add_task'
  | 'edit_task'
  | 'show_tasks'
  | 'mark_tasks'
  | 'delete_tasks'
  | 'add_note'
  | 'help'
  | 'unknown';

export interface ParsedCommand {
  type: CommandType;
  taskName?: string;
  projectName?: string;
  priority?: 'High' | 'Medium' | 'Low';
  phase?: 'Planning' | 'In Progress' | 'On Hold' | 'Completed';
  dueDate?: string;
  note?: string;
  completed?: boolean;
}

interface DateKeyword {
  keyword: string;
  getValue: () => Date;
}

const DATE_KEYWORDS: DateKeyword[] = [
  {
    keyword: 'today',
    getValue: () => new Date()
  },
  {
    keyword: 'tomorrow',
    getValue: () => addDays(new Date(), 1)
  },
  {
    keyword: 'next week',
    getValue: () => addDays(new Date(), 7)
  }
];

export function parseCommand(input: string): ParsedCommand {
  const normalizedInput = input.toLowerCase().trim();

  // Edit task commands
  if (normalizedInput.match(/^edit\s+(.+?)\s+to\s+set\s+/)) {
    const taskMatch = normalizedInput.match(/^edit\s+(.+?)\s+to\s+set\s+/);
    const taskName = taskMatch?.[1];

    if (normalizedInput.includes('due date')) {
      const dateMatch = normalizedInput.match(/due date to\s+(.+)$/);
      if (dateMatch) {
        const dateStr = dateMatch[1];
        const date = parseDateFromString(dateStr);
        return {
          type: 'edit_task',
          taskName,
          dueDate: date ? format(date, 'yyyy-MM-dd') : undefined
        };
      }
    }

    if (normalizedInput.includes('priority')) {
      const priorityMatch = normalizedInput.match(/priority to\s+(high|medium|low)/);
      if (priorityMatch) {
        const priority = priorityMatch[1].charAt(0).toUpperCase() + priorityMatch[1].slice(1) as 'High' | 'Medium' | 'Low';
        return {
          type: 'edit_task',
          taskName,
          priority
        };
      }
    }

    if (normalizedInput.includes('phase')) {
      const phaseMatch = normalizedInput.match(/phase to\s+(planning|in progress|on hold|completed)/);
      if (phaseMatch) {
        const phase = phaseMatch[1].split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ') as 'Planning' | 'In Progress' | 'On Hold' | 'Completed';
        return {
          type: 'edit_task',
          taskName,
          phase
        };
      }
    }
  }

  // Show tasks commands
  if (normalizedInput.startsWith('show') || normalizedInput.startsWith('find')) {
    const projectMatch = normalizedInput.match(/(?:for|in)\s+(.+?)(?:\s+with|$)/);
    const priorityMatch = normalizedInput.match(/with\s+(high|medium|low)\s+priority/);
    
    return {
      type: 'show_tasks',
      projectName: projectMatch?.[1],
      priority: priorityMatch ? (priorityMatch[1].charAt(0).toUpperCase() + priorityMatch[1].slice(1)) as 'High' | 'Medium' | 'Low' : undefined
    };
  }

  // Mark tasks completed
  if (normalizedInput.startsWith('mark')) {
    const projectMatch = normalizedInput.match(/in\s+(.+?)\s+as\s+completed/);
    return {
      type: 'mark_tasks',
      projectName: projectMatch?.[1],
      completed: true
    };
  }

  // Delete tasks
  if (normalizedInput.startsWith('delete')) {
    return {
      type: 'delete_tasks',
      completed: normalizedInput.includes('completed')
    };
  }

  // Add note
  if (normalizedInput.startsWith('add note') || normalizedInput.startsWith('add a note')) {
    const matches = normalizedInput.match(/add (?:a )?note to\s+(.+?)\s+saying\s+(.+)$/);
    if (matches) {
      return {
        type: 'add_note',
        taskName: matches[1],
        note: matches[2]
      };
    }
  }

  // Help command
  if (normalizedInput === 'help' || normalizedInput === '?') {
    return { type: 'help' };
  }

  return { type: 'unknown' };
}

function parseDateFromString(dateStr: string): Date | null {
  // Check for keywords first
  const keyword = DATE_KEYWORDS.find(dk => dateStr.includes(dk.keyword));
  if (keyword) {
    return keyword.getValue();
  }

  // Try parsing explicit date format
  try {
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  } catch {
    return null;
  }
}

export function generateSuggestions(input: string, projects: Project[], tasks: Task[]): string[] {
  const normalizedInput = input.toLowerCase().trim();
  const suggestions: string[] = [];

  if (normalizedInput.startsWith('add')) {
    suggestions.push(
      'add task [name]',
      'add note to [task] saying [content]'
    );
  } else if (normalizedInput.startsWith('edit')) {
    suggestions.push(
      'edit [task] to set due date to [YYYY-MM-DD]',
      'edit [task] to set priority to [high/medium/low]',
      'edit [task] to set phase to [planning/in progress/on hold/completed]'
    );
  } else if (normalizedInput.startsWith('show') || normalizedInput.startsWith('find')) {
    suggestions.push(
      'show tasks for [project]',
      'show tasks with high priority',
      'show tasks due this week'
    );
  } else if (normalizedInput.startsWith('mark')) {
    suggestions.push(
      'mark all tasks in [project] as completed',
      'mark task [name] as completed'
    );
  } else if (normalizedInput.startsWith('delete')) {
    suggestions.push(
      'delete completed tasks',
      'delete task [name]'
    );
  }

  // Replace placeholders with actual project and task names
  return suggestions.map(suggestion => {
    if (suggestion.includes('[project]') && projects.length > 0) {
      return suggestion.replace('[project]', projects[0].name);
    }
    if (suggestion.includes('[task]') && tasks.length > 0) {
      return suggestion.replace('[task]', tasks[0].name);
    }
    return suggestion;
  });
}