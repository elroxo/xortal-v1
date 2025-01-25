export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'project' | 'task' | 'note' | 'resource' | 'reminder';
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineQueue {
  private readonly STORAGE_KEY = 'offline_queue';
  private queue: QueuedOperation[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
    window.addEventListener('online', () => this.processQueue());
  }

  private loadQueue() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.queue = JSON.parse(stored);
      } catch (error) {
        console.error('Error loading offline queue:', error);
        this.queue = [];
      }
    }
  }

  private saveQueue() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
  }

  addOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>) {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(queuedOp);
    this.saveQueue();

    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || !navigator.onLine || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const operations = [...this.queue];
      for (const operation of operations) {
        try {
          await this.processOperation(operation);
          this.queue = this.queue.filter(op => op.id !== operation.id);
          this.saveQueue();
        } catch (error) {
          operation.retryCount++;
          if (operation.retryCount >= 3) {
            this.queue = this.queue.filter(op => op.id !== operation.id);
          }
          this.saveQueue();
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processOperation(operation: QueuedOperation) {
    // Implementation will be handled by the store
    const event = new CustomEvent('process-offline-operation', {
      detail: operation
    });
    window.dispatchEvent(event);
  }

  getQueuedOperations(): QueuedOperation[] {
    return [...this.queue];
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
  }
}

export const offlineQueue = new OfflineQueue();