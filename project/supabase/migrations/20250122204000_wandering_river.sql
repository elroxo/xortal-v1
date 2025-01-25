/*
  # Project Management Schema Setup

  1. Schema Overview
    - Creates all tables as specified with exact fields and relationships
    - Implements enums for various status fields
    - Sets up RLS policies for data access
    - Includes mock data for testing

  2. Tables Created
    - users
    - projects
    - tasks
    - notes
    - resources
    - reminders
    - activity_logs

  3. Security
    - RLS enabled on all tables
    - Policies set for authenticated users
*/

-- Create custom types
CREATE TYPE project_phase AS ENUM ('Planning', 'In Progress', 'On Hold', 'Completed', 'Ongoing');
CREATE TYPE task_phase AS ENUM ('Planning', 'In Progress', 'On Hold', 'Completed');
CREATE TYPE priority_level AS ENUM ('High', 'Medium', 'Low');
CREATE TYPE timeline_type AS ENUM ('No Timeline', 'Flexible', 'Strict');
CREATE TYPE resource_type AS ENUM ('URL', 'File', 'Image');
CREATE TYPE entity_type AS ENUM ('Project', 'Task', 'Note', 'Resource', 'Reminder');
CREATE TYPE action_type AS ENUM ('Create', 'Update', 'Delete');

-- Create tables
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_code text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  phase project_phase NOT NULL,
  priority priority_level NOT NULL,
  timeline_type timeline_type NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  phase task_phase NOT NULL,
  priority priority_level NOT NULL,
  due_date date,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT note_link_check CHECK (
    (project_id IS NOT NULL AND task_id IS NULL) OR
    (project_id IS NULL AND task_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  type resource_type NOT NULL,
  url text,
  file_path text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT resource_link_check CHECK (
    (project_id IS NOT NULL AND task_id IS NULL) OR
    (project_id IS NULL AND task_id IS NOT NULL)
  ),
  CONSTRAINT resource_path_check CHECK (
    (type = 'URL' AND url IS NOT NULL AND file_path IS NULL) OR
    ((type = 'File' OR type = 'Image') AND file_path IS NOT NULL AND url IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linked_entity_type entity_type NOT NULL,
  linked_entity_id uuid NOT NULL,
  reminder_date timestamptz NOT NULL,
  message text
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action action_type NOT NULL,
  entity_type entity_type NOT NULL,
  entity_id uuid NOT NULL,
  timestamp timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own data"
  ON users FOR ALL TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can manage all projects"
  ON projects FOR ALL TO authenticated
  USING (true);

CREATE POLICY "Users can manage all tasks"
  ON tasks FOR ALL TO authenticated
  USING (true);

CREATE POLICY "Users can manage all notes"
  ON notes FOR ALL TO authenticated
  USING (true);

CREATE POLICY "Users can manage all resources"
  ON resources FOR ALL TO authenticated
  USING (true);

CREATE POLICY "Users can manage all reminders"
  ON reminders FOR ALL TO authenticated
  USING (true);

CREATE POLICY "Users can view all activity logs"
  ON activity_logs FOR SELECT TO authenticated
  USING (true);

-- Insert mock data
INSERT INTO users (id, master_code) VALUES
  ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'MASTER123');

INSERT INTO projects (id, name, description, phase, priority, timeline_type) VALUES
  ('d290f1ee-6c54-4b01-90e6-d701748f0852', 'Website Redesign', 'Complete overhaul of company website', 'In Progress', 'High', 'Strict'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0853', 'Mobile App Development', 'New mobile application for customers', 'Planning', 'High', 'Flexible'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0854', 'Content Strategy', 'Develop content strategy for Q3', 'On Hold', 'Medium', 'No Timeline'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0855', 'Customer Support Portal', 'Internal portal for support team', 'Ongoing', 'Medium', 'Flexible'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0856', 'Data Migration', 'Legacy system migration', 'Completed', 'High', 'Strict');

INSERT INTO tasks (id, project_id, name, description, phase, priority, due_date, completed) VALUES
  ('d290f1ee-6c54-4b01-90e6-d701748f0857', 'd290f1ee-6c54-4b01-90e6-d701748f0852', 'Design Homepage', 'Create new homepage design', 'In Progress', 'High', '2024-04-15', false),
  ('d290f1ee-6c54-4b01-90e6-d701748f0858', 'd290f1ee-6c54-4b01-90e6-d701748f0852', 'Implement Contact Form', 'Add contact form functionality', 'Planning', 'Medium', '2024-04-20', false),
  ('d290f1ee-6c54-4b01-90e6-d701748f0859', 'd290f1ee-6c54-4b01-90e6-d701748f0853', 'UI/UX Design', 'Design mobile app interfaces', 'In Progress', 'High', '2024-05-01', false),
  ('d290f1ee-6c54-4b01-90e6-d701748f0860', 'd290f1ee-6c54-4b01-90e6-d701748f0853', 'API Integration', 'Integrate backend APIs', 'Planning', 'High', '2024-05-15', false),
  ('d290f1ee-6c54-4b01-90e6-d701748f0861', 'd290f1ee-6c54-4b01-90e6-d701748f0854', 'Content Audit', 'Audit existing content', 'Completed', 'Low', '2024-03-30', true),
  ('d290f1ee-6c54-4b01-90e6-d701748f0862', 'd290f1ee-6c54-4b01-90e6-d701748f0854', 'Editorial Calendar', 'Create Q3 editorial calendar', 'On Hold', 'Medium', '2024-06-01', false),
  ('d290f1ee-6c54-4b01-90e6-d701748f0863', 'd290f1ee-6c54-4b01-90e6-d701748f0855', 'Setup Knowledge Base', 'Initialize knowledge base structure', 'In Progress', 'Medium', '2024-04-30', false),
  ('d290f1ee-6c54-4b01-90e6-d701748f0864', 'd290f1ee-6c54-4b01-90e6-d701748f0855', 'User Authentication', 'Implement SSO', 'Planning', 'High', '2024-05-10', false),
  ('d290f1ee-6c54-4b01-90e6-d701748f0865', 'd290f1ee-6c54-4b01-90e6-d701748f0856', 'Data Mapping', 'Map legacy data to new schema', 'Completed', 'High', '2024-03-15', true),
  ('d290f1ee-6c54-4b01-90e6-d701748f0866', 'd290f1ee-6c54-4b01-90e6-d701748f0856', 'Data Validation', 'Validate migrated data', 'Completed', 'High', '2024-03-20', true);

INSERT INTO notes (id, project_id, task_id, content, tags) VALUES
  ('d290f1ee-6c54-4b01-90e6-d701748f0867', 'd290f1ee-6c54-4b01-90e6-d701748f0852', NULL, 'Client prefers minimalist design', ARRAY['design', 'client-feedback']),
  ('d290f1ee-6c54-4b01-90e6-d701748f0868', NULL, 'd290f1ee-6c54-4b01-90e6-d701748f0857', 'Use hero section with video background', ARRAY['design', 'homepage']),
  ('d290f1ee-6c54-4b01-90e6-d701748f0869', 'd290f1ee-6c54-4b01-90e6-d701748f0853', NULL, 'Target iOS first, then Android', ARRAY['mobile', 'strategy']),
  ('d290f1ee-6c54-4b01-90e6-d701748f0870', NULL, 'd290f1ee-6c54-4b01-90e6-d701748f0859', 'Follow Material Design guidelines', ARRAY['design', 'guidelines']),
  ('d290f1ee-6c54-4b01-90e6-d701748f0871', 'd290f1ee-6c54-4b01-90e6-d701748f0854', NULL, 'Focus on SEO-optimized content', ARRAY['content', 'seo']),
  ('d290f1ee-6c54-4b01-90e6-d701748f0872', NULL, 'd290f1ee-6c54-4b01-90e6-d701748f0863', 'Use Algolia for search', ARRAY['technical', 'search']),
  ('d290f1ee-6c54-4b01-90e6-d701748f0873', 'd290f1ee-6c54-4b01-90e6-d701748f0856', NULL, 'Backup all data before migration', ARRAY['data', 'backup']),
  ('d290f1ee-6c54-4b01-90e6-d701748f0874', NULL, 'd290f1ee-6c54-4b01-90e6-d701748f0865', 'Document all data transformations', ARRAY['documentation', 'data']);

INSERT INTO resources (id, project_id, task_id, type, url, file_path) VALUES
  ('d290f1ee-6c54-4b01-90e6-d701748f0875', 'd290f1ee-6c54-4b01-90e6-d701748f0852', NULL, 'URL', 'https://example.com/design-inspiration', NULL),
  ('d290f1ee-6c54-4b01-90e6-d701748f0876', NULL, 'd290f1ee-6c54-4b01-90e6-d701748f0857', 'Image', NULL, '/uploads/homepage-mockup.png'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0877', 'd290f1ee-6c54-4b01-90e6-d701748f0853', NULL, 'URL', 'https://example.com/api-docs', NULL),
  ('d290f1ee-6c54-4b01-90e6-d701748f0878', NULL, 'd290f1ee-6c54-4b01-90e6-d701748f0859', 'File', NULL, '/uploads/ui-guidelines.pdf'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0879', 'd290f1ee-6c54-4b01-90e6-d701748f0854', NULL, 'URL', 'https://example.com/content-strategy-template', NULL),
  ('d290f1ee-6c54-4b01-90e6-d701748f0880', NULL, 'd290f1ee-6c54-4b01-90e6-d701748f0865', 'File', NULL, '/uploads/data-mapping.xlsx');

INSERT INTO reminders (id, linked_entity_type, linked_entity_id, reminder_date, message) VALUES
  ('d290f1ee-6c54-4b01-90e6-d701748f0881', 'Project', 'd290f1ee-6c54-4b01-90e6-d701748f0852', '2024-04-01 10:00:00+00', 'Website design review meeting'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0882', 'Task', 'd290f1ee-6c54-4b01-90e6-d701748f0859', '2024-04-15 14:00:00+00', 'UI/UX design presentation'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0883', 'Project', 'd290f1ee-6c54-4b01-90e6-d701748f0854', '2024-05-01 09:00:00+00', 'Content strategy kickoff'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0884', 'Task', 'd290f1ee-6c54-4b01-90e6-d701748f0863', '2024-04-20 11:00:00+00', 'Knowledge base structure review');

INSERT INTO activity_logs (id, action, entity_type, entity_id, timestamp) VALUES
  ('d290f1ee-6c54-4b01-90e6-d701748f0885', 'Create', 'Project', 'd290f1ee-6c54-4b01-90e6-d701748f0852', '2024-03-01 09:00:00+00'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0886', 'Create', 'Task', 'd290f1ee-6c54-4b01-90e6-d701748f0857', '2024-03-01 09:15:00+00'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0887', 'Update', 'Task', 'd290f1ee-6c54-4b01-90e6-d701748f0857', '2024-03-15 14:30:00+00'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0888', 'Create', 'Project', 'd290f1ee-6c54-4b01-90e6-d701748f0853', '2024-03-02 10:00:00+00'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0889', 'Create', 'Note', 'd290f1ee-6c54-4b01-90e6-d701748f0867', '2024-03-05 11:20:00+00'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0890', 'Create', 'Resource', 'd290f1ee-6c54-4b01-90e6-d701748f0875', '2024-03-06 13:45:00+00'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0891', 'Update', 'Project', 'd290f1ee-6c54-4b01-90e6-d701748f0854', '2024-03-10 16:00:00+00'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0892', 'Delete', 'Task', 'd290f1ee-6c54-4b01-90e6-d701748f0866', '2024-03-20 17:30:00+00'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0893', 'Create', 'Reminder', 'd290f1ee-6c54-4b01-90e6-d701748f0881', '2024-03-25 09:00:00+00'),
  ('d290f1ee-6c54-4b01-90e6-d701748f0894', 'Update', 'Note', 'd290f1ee-6c54-4b01-90e6-d701748f0868', '2024-03-28 14:15:00+00');