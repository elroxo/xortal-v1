import { withRetry } from './retryHandler';
import { parseError } from './errorHandler';
import { Task, Project } from '../types';

const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = import.meta.env.VITE_LLM_API_KEY;

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  error?: string;
  suggestedCommand?: string;
  projectDetails?: Partial<Project>;
}

interface ProjectContext {
  currentProject?: Project;
  recentTasks?: Task[];
  isCreatingProject?: boolean;
  projectDetails?: Partial<Project>;
  currentQuestion?: 'name' | 'goal' | 'timeline' | 'priority' | 'team' | 'confirmation';
  skippedQuestions?: string[];
}

const systemPrompt = `You are an AI assistant specialized in project management, focusing on helping users create and manage projects effectively. Your capabilities include:

1. Project Creation Flow:
   - Guide users through project creation with natural conversation
   - Ask relevant follow-up questions based on user responses
   - Infer project details from context
   - Allow skipping questions while maintaining conversation flow

2. Task Management:
   - Analyzing and prioritizing tasks
   - Suggesting task organization strategies
   - Creating project timelines
   - Identifying dependencies

3. Project Planning:
   - Breaking down projects into manageable tasks
   - Estimating time requirements
   - Risk assessment and mitigation
   - Resource allocation suggestions

4. Best Practices:
   - Agile and traditional project management methodologies
   - Team collaboration strategies
   - Progress tracking and reporting
   - Meeting efficiency and communication

When starting a new project:
1. First ask for the project name
2. Then ask about the project's goal or purpose
3. Inquire about timeline preferences (strict deadline, flexible, or no timeline)
4. Ask about priority level
5. Allow users to skip any question with responses like "not sure yet" or "skip"

Keep responses concise, practical, and focused on actionable project management advice.
If you identify a task-related request that could be handled by a command, suggest the appropriate command format.

Special Instructions for Project Creation:
- If a user says they want to skip or are unsure, acknowledge it positively and move to the next question
- If a user provides multiple pieces of information in one response, acknowledge all of them and ask about missing details
- If a user changes the subject, note their current progress and help with their query, then offer to return to project creation
- Before finalizing, summarize all collected information and ask for confirmation`;

export class LLMService {
  private context: Message[] = [
    { role: 'system', content: systemPrompt }
  ];
  private projectContext?: ProjectContext;

  setProjectContext(context: ProjectContext) {
    this.projectContext = context;
    if (context.currentProject) {
      this.context.push({
        role: 'system',
        content: `Current project: ${context.currentProject.name} (${context.currentProject.phase}, ${context.currentProject.priority} priority)`
      });
    }
  }

  private extractProjectDetails(message: string): Partial<Project> {
    const details: Partial<Project> = {};
    
    // Extract project name
    const nameMatch = message.match(/project (?:called|named) ["'](.+?)["']/i) || 
                     message.match(/["'](.+?)["'] (?:project|for the name)/i);
    if (nameMatch) {
      details.name = nameMatch[1];
    }

    // Extract priority
    if (message.match(/\bhigh(?:est)?\s+priority\b/i) || message.match(/\bvery\s+important\b/i)) {
      details.priority = 'High';
    } else if (message.match(/\bmedium\s+priority\b/i) || message.match(/\bsomewhat\s+important\b/i)) {
      details.priority = 'Medium';
    } else if (message.match(/\blow\s+priority\b/i) || message.match(/\bnot\s+(?:very\s+)?important\b/i)) {
      details.priority = 'Low';
    }

    // Extract phase
    if (message.match(/\b(?:in\s+)?planning\b/i) || message.match(/\bplan(?:ning)?\s+phase\b/i)) {
      details.phase = 'Planning';
    } else if (message.match(/\bin\s+progress\b/i) || message.match(/\balready\s+started\b/i)) {
      details.phase = 'In Progress';
    } else if (message.match(/\bon\s+hold\b/i) || message.match(/\bpaused\b/i)) {
      details.phase = 'On Hold';
    }

    // Extract timeline type
    if (message.match(/\bstrict\s+deadline\b/i) || message.match(/\bmust\s+be\s+done\s+by\b/i)) {
      details.timeline_type = 'Strict';
    } else if (message.match(/\bflexible\b/i) || message.match(/\bcan\s+adjust\b/i)) {
      details.timeline_type = 'Flexible';
    } else if (message.match(/\bno\s+(?:timeline|deadline)\b/i) || message.match(/\bopen[-\s]ended\b/i)) {
      details.timeline_type = 'No Timeline';
    }

    return details;
  }

  private getNextQuestion(currentDetails: Partial<Project>): string {
    if (!currentDetails.name) {
      return "What would you like to name this project?";
    }
    if (!currentDetails.description) {
      return `Great! What's the main goal or purpose of "${currentDetails.name}"?`;
    }
    if (!currentDetails.timeline_type) {
      return "Do you have a specific timeline in mind? (strict deadline, flexible, or no timeline)";
    }
    if (!currentDetails.priority) {
      return "How would you prioritize this project? (high, medium, or low priority)";
    }
    if (!currentDetails.phase) {
      return "What phase is the project in? (planning, in progress, or on hold)";
    }
    return "Let me summarize what we have so far...";
  }

  private generateSummary(details: Partial<Project>): string {
    const summary = [
      `Project Name: ${details.name}`,
      `Description: ${details.description || 'Not specified'}`,
      `Timeline: ${details.timeline_type || 'Not specified'}`,
      `Priority: ${details.priority || 'Not specified'}`,
      `Phase: ${details.phase || 'Not specified'}`
    ].join('\n');

    return `Here's what I have for the project:\n\n${summary}\n\nDoes this look correct? We can adjust any details if needed.`;
  }

  async processMessage(userMessage: string): Promise<LLMResponse> {
    try {
      let messageWithContext = userMessage;
      let projectDetails: Partial<Project> | undefined;

      // Handle project creation flow
      if (userMessage.toLowerCase().includes("let's start a new project")) {
        this.projectContext = { 
          isCreatingProject: true,
          currentQuestion: 'name',
          projectDetails: {},
          skippedQuestions: []
        };
        messageWithContext = "User wants to create a new project. Ask for the project name in a friendly way.";
      } else if (this.projectContext?.isCreatingProject) {
        // Check for conversation interruption
        if (userMessage.toLowerCase().includes('wait') || userMessage.toLowerCase().includes('hold on')) {
          return {
            content: "No problem! We can pause the project creation. Let me know when you'd like to continue, and we'll pick up where we left off.",
            projectDetails: this.projectContext.projectDetails
          };
        }

        // Check for skip or uncertainty
        if (userMessage.toLowerCase().match(/\b(skip|not sure|don't know|later)\b/)) {
          this.projectContext.skippedQuestions?.push(this.projectContext.currentQuestion || '');
          const nextQuestion = this.getNextQuestion(this.projectContext.projectDetails || {});
          return {
            content: `No problem! We can come back to that later. ${nextQuestion}`,
            projectDetails: this.projectContext.projectDetails
          };
        }

        // Extract new details
        projectDetails = this.extractProjectDetails(userMessage);
        this.projectContext.projectDetails = {
          ...this.projectContext.projectDetails,
          ...projectDetails
        };
        
        // Get next question or generate summary
        const nextQuestion = this.getNextQuestion(this.projectContext.projectDetails);
        if (nextQuestion.startsWith("Let me summarize")) {
          messageWithContext = this.generateSummary(this.projectContext.projectDetails);
        } else {
          messageWithContext = nextQuestion;
        }
      } else if (this.projectContext?.currentProject) {
        messageWithContext = `[Project: ${this.projectContext.currentProject.name}] ${userMessage}`;
      }

      this.context.push({ role: 'user', content: messageWithContext });

      const response = await withRetry(async () => {
        const result = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: this.context,
            max_tokens: 250,
            temperature: 0.7,
            top_p: 1,
            frequency_penalty: 0.3,
            presence_penalty: 0.3
          })
        });

        if (!result.ok) {
          throw new Error(`API request failed: ${result.statusText}`);
        }

        return await result.json();
      }, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000
      });

      const assistantMessage = response.choices[0].message.content;
      this.context.push({ role: 'assistant', content: assistantMessage });

      // Extract command suggestion if present
      const commandMatch = assistantMessage.match(/You can use the command:\s*`([^`]+)`/);
      const suggestedCommand = commandMatch ? commandMatch[1] : undefined;

      // Manage context window
      if (this.context.length > 10) {
        this.context = [
          this.context[0], // Keep system prompt
          this.context[1], // Keep project context if exists
          ...this.context.slice(-4) // Keep last 4 messages
        ];
      }

      return { 
        content: assistantMessage,
        suggestedCommand,
        projectDetails: this.projectContext?.projectDetails
      };
    } catch (error) {
      const appError = parseError(error);
      return { 
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        error: appError.message 
      };
    }
  }

  async summarizeTasks(tasks: Task[]): Promise<string> {
    try {
      const taskSummary = tasks.map(task => 
        `- ${task.name} (${task.priority} priority, ${task.phase}${
          task.due_date ? `, due ${new Date(task.due_date).toLocaleDateString()}` : ''
        })`
      ).join('\n');

      const response = await this.processMessage(
        `Please analyze these tasks and provide a brief summary of status and recommendations:\n${taskSummary}`
      );

      return response.content;
    } catch (error) {
      return 'Unable to generate task summary at this time.';
    }
  }

  async generateTimeline(project: Project, tasks: Task[]): Promise<string> {
    try {
      const projectInfo = `Project: ${project.name} (${project.phase}, ${project.priority} priority)`;
      const taskList = tasks.map(task => 
        `- ${task.name} (${task.phase}, ${task.priority} priority, ${task.due_date || 'no due date'})`
      ).join('\n');

      const response = await this.processMessage(
        `Please analyze this project and its tasks to suggest a timeline and next steps:\n${projectInfo}\n\nTasks:\n${taskList}`
      );

      return response.content;
    } catch (error) {
      return 'Unable to generate timeline at this time.';
    }
  }

  clearContext() {
    this.context = [this.context[0]]; // Keep only system prompt
    this.projectContext = undefined;
  }
}