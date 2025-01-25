import { AutoMLClient, PredictionServiceClient } from '@google-cloud/automl';
import { withRetry } from './retryHandler';
import { parseError } from './errorHandler';
import { Project, Task } from '../types';

// Initialize clients
const autoMLClient = new AutoMLClient({
  credentials: {
    client_email: import.meta.env.VITE_GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: import.meta.env.VITE_GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  projectId: 'xortal-v1',
});

const predictionClient = new PredictionServiceClient({
  credentials: {
    client_email: import.meta.env.VITE_GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: import.meta.env.VITE_GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  projectId: 'xortal-v1',
});

// Model configuration
const PROJECT_ID = 'xortal-v1';
const MODEL_ID = 'project_recommendations_v1';
const LOCATION = 'us-central1';

interface TrainingData {
  project: Project;
  tasks: Task[];
  outcome: {
    completionRate: number;
    onTimeDelivery: number;
    efficiency: number;
  };
}

interface PredictionResult {
  recommendations: string[];
  confidence: number;
  suggestedPriority: 'High' | 'Medium' | 'Low';
  estimatedDuration: number;
}

export class AIPlatformService {
  private static instance: AIPlatformService;

  private constructor() {}

  static getInstance(): AIPlatformService {
    if (!this.instance) {
      this.instance = new AIPlatformService();
    }
    return this.instance;
  }

  async uploadTrainingData(data: TrainingData[]): Promise<void> {
    try {
      const formattedData = this.preprocessTrainingData(data);
      
      const dataset = await withRetry(async () => {
        const [operation] = await autoMLClient.createDataset({
          parent: `projects/${PROJECT_ID}/locations/${LOCATION}`,
          dataset: {
            displayName: `project_data_${Date.now()}`,
            textClassificationDatasetMetadata: {},
          },
        });
        return operation.promise();
      });

      console.log('Dataset created:', dataset);

      // Upload data to the dataset
      await withRetry(async () => {
        const [operation] = await autoMLClient.importData({
          name: dataset[0].name,
          inputConfig: {
            gcsSource: {
              inputUris: [formattedData],
            },
          },
        });
        return operation.promise();
      });

      console.log('Training data uploaded successfully');
    } catch (error) {
      const appError = parseError(error);
      console.error('Failed to upload training data:', appError);
      throw error;
    }
  }

  async trainModel(): Promise<void> {
    try {
      await withRetry(async () => {
        const [operation] = await autoMLClient.createModel({
          parent: `projects/${PROJECT_ID}/locations/${LOCATION}`,
          model: {
            displayName: MODEL_ID,
            datasetId: `projects/${PROJECT_ID}/locations/${LOCATION}/datasets/${MODEL_ID}`,
            textClassificationModelMetadata: {},
          },
        });
        return operation.promise();
      });

      console.log('Model training initiated');
    } catch (error) {
      const appError = parseError(error);
      console.error('Failed to train model:', appError);
      throw error;
    }
  }

  async getPrediction(project: Project, tasks: Task[]): Promise<PredictionResult> {
    try {
      const input = this.formatPredictionInput(project, tasks);
      
      const [response] = await withRetry(async () => {
        return predictionClient.predict({
          name: `projects/${PROJECT_ID}/locations/${LOCATION}/models/${MODEL_ID}`,
          payload: {
            textSnippet: { content: JSON.stringify(input) },
          },
        });
      });

      if (!response.payload?.[0]) {
        throw new Error('No prediction results received');
      }

      return this.parsePredictionResponse(response.payload[0]);
    } catch (error) {
      const appError = parseError(error);
      console.error('Failed to get prediction:', appError);
      throw error;
    }
  }

  private preprocessTrainingData(data: TrainingData[]): string {
    // Convert training data to the format expected by AutoML
    return data.map(item => ({
      text: JSON.stringify({
        project: {
          name: item.project.name,
          phase: item.project.phase,
          priority: item.project.priority,
          timeline_type: item.project.timeline_type,
        },
        tasks: item.tasks.map(task => ({
          name: task.name,
          phase: task.phase,
          priority: task.priority,
          completed: task.completed,
        })),
      }),
      label: JSON.stringify(item.outcome),
    })).join('\n');
  }

  private formatPredictionInput(project: Project, tasks: Task[]) {
    return {
      project: {
        name: project.name,
        phase: project.phase,
        priority: project.priority,
        timeline_type: project.timeline_type,
      },
      tasks: tasks.map(task => ({
        name: task.name,
        phase: task.phase,
        priority: task.priority,
        completed: task.completed,
      })),
    };
  }

  private parsePredictionResponse(payload: any): PredictionResult {
    const prediction = JSON.parse(payload.displayName || '{}');
    
    return {
      recommendations: prediction.recommendations || [],
      confidence: payload.classification?.score || 0,
      suggestedPriority: prediction.priority || 'Medium',
      estimatedDuration: prediction.duration || 0,
    };
  }
}

// Export singleton instance
export const aiPlatformService = AIPlatformService.getInstance();