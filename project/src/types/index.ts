export type Project = {
  id: string;
  name: string;
  description: string | null;
  phase: 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Ongoing';
  priority: 'High' | 'Medium' | 'Low';
  timeline_type: 'No Timeline' | 'Flexible' | 'Strict';
  created_at: string;
  updated_at: string;
  archived: boolean;
};

export type Task = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  phase: 'Planning' | 'In Progress' | 'On Hold' | 'Completed';
  priority: 'High' | 'Medium' | 'Low';
  due_date: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  project_id: string | null;
  task_id: string | null;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type Resource = {
  id: string;
  project_id: string | null;
  task_id: string | null;
  type: 'URL' | 'File' | 'Image';
  url: string | null;
  file_path: string | null;
  created_at: string;
};

export type Reminder = {
  id: string;
  linked_entity_type: 'Project' | 'Task' | 'Note';
  linked_entity_id: string;
  reminder_date: string;
  message: string | null;
};

export type Message = {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export interface TranscriptionResult {
  text: string;
  confidence: number;
  words?: Array<{
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
}

export interface VoiceConfig {
  languageCode: string;
  name?: string;
  ssmlGender: 'NEUTRAL' | 'MALE' | 'FEMALE';
  pitch: number;
  speakingRate: number;
}