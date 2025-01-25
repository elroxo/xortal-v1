import { TranscriptionResult } from '../types';

class SpeechRecognitionClient {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private currentResolve: ((result: TranscriptionResult) => void) | null = null;
  private currentReject: ((error: Error) => void) | null = null;

  constructor() {
    try {
      // Check for browser support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser');
      }

      this.recognition = new SpeechRecognition();
      this.configureRecognition();
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      this.recognition = null;
    }
  }

  private configureRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = false; // Changed to false to get one result at a time
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = this.handleResult.bind(this);
    this.recognition.onerror = this.handleError.bind(this);
    this.recognition.onend = this.handleEnd.bind(this);
  }

  private handleResult(event: SpeechRecognitionEvent) {
    if (!event.results.length) return;

    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript;
    const confidence = result[0].confidence;

    if (result.isFinal && this.currentResolve) {
      this.currentResolve({
        text: transcript.trim(),
        confidence,
        words: []
      });
      this.cleanup();
    }
  }

  private handleError(event: SpeechRecognitionErrorEvent) {
    let errorMessage = 'Speech recognition error';
    
    switch (event.error) {
      case 'no-speech':
        errorMessage = 'No speech was detected';
        break;
      case 'aborted':
        errorMessage = 'Speech recognition was aborted';
        break;
      case 'audio-capture':
        errorMessage = 'No microphone was found or microphone is disabled';
        break;
      case 'not-allowed':
        errorMessage = 'Microphone permission was denied';
        break;
      case 'network':
        errorMessage = 'Network error occurred during recognition';
        break;
      case 'service-not-allowed':
        errorMessage = 'Speech recognition service is not allowed';
        break;
    }

    if (this.currentReject) {
      this.currentReject(new Error(errorMessage));
    }
    this.cleanup();
  }

  private handleEnd() {
    // If we haven't resolved/rejected yet, resolve with empty result
    if (this.currentResolve && this.isListening) {
      this.currentResolve({
        text: '',
        confidence: 0,
        words: []
      });
    }
    this.cleanup();
  }

  private cleanup() {
    this.isListening = false;
    this.currentResolve = null;
    this.currentReject = null;
  }

  startRecording(): Promise<TranscriptionResult> {
    if (!this.recognition) {
      return Promise.reject(new Error('Speech recognition not supported'));
    }

    if (this.isListening) {
      return Promise.reject(new Error('Already recording'));
    }

    return new Promise((resolve, reject) => {
      try {
        this.currentResolve = resolve;
        this.currentReject = reject;
        this.isListening = true;
        this.recognition.start();
      } catch (error) {
        this.cleanup();
        reject(new Error('Failed to start recording'));
      }
    });
  }

  stopRecording(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      this.cleanup();
    }
  }
}

// Create singleton instance
const speechRecognitionClient = new SpeechRecognitionClient();

export async function transcribeAudio(): Promise<TranscriptionResult> {
  try {
    return await speechRecognitionClient.startRecording();
  } catch (error) {
    console.error('Transcription error:', error);
    throw error; // Let the component handle the error
  }
}

export function stopTranscription(): void {
  speechRecognitionClient.stopRecording();
}