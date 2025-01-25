import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Loader2, ArrowRight, FileText, Link, Image, Edit, Folder, Mic, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '../store';
import { Task } from '../types';
import { parse } from 'date-fns';
import { parseCommand, generateSuggestions } from '../lib/commandParser';
import { LLMService } from '../lib/llm';
import { transcribeAudio, stopTranscription } from '../lib/speechClient';
import { getCachedSpeech, SynthesisConfig } from '../lib/textToSpeechClient';

const llmService = new LLMService();

export const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [voiceConfig, setVoiceConfig] = useState<SynthesisConfig>({
    languageCode: 'en-US',
    ssmlGender: 'NEUTRAL',
    pitch: 0,
    speakingRate: 1.0,
  });
  const processingTimer = useRef<NodeJS.Timeout>();
  const recordingTimer = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { 
    messages, 
    addMessage, 
    selectedProject, 
    createTask, 
    updateTask,
    deleteTask,
    createNote,
    tasks,
    projects,
    fetchTasks,
    setError,
    createResource
  } = useStore();

  useEffect(() => {
    if (selectedProject) {
      llmService.setProjectContext({
        currentProject: selectedProject,
        recentTasks: tasks.slice(0, 5)
      });
    }
  }, [selectedProject, tasks]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (input.trim()) {
      const newSuggestions = generateSuggestions(input, projects, tasks);
      setSuggestions(newSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [input, projects, tasks]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  }, [input]);

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        URL.revokeObjectURL(currentAudio.src);
      }
    };
  }, []);

  const startProcessingTimer = () => {
    setProcessingTime(0);
    processingTimer.current = setInterval(() => {
      setProcessingTime(prev => prev + 100);
    }, 100);
  };

  const stopProcessingTimer = () => {
    if (processingTimer.current) {
      clearInterval(processingTimer.current);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setSuggestions([]);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }

    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion(prev => prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'Enter' && selectedSuggestion >= 0) {
        e.preventDefault();
        handleSuggestionClick(suggestions[selectedSuggestion]);
      } else if (e.key === 'Escape') {
        setSuggestions([]);
        setSelectedSuggestion(-1);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    startProcessingTimer();

    addMessage({
      type: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    });

    const command = parseCommand(input);
    
    try {
      if (command.type === 'unknown') {
        const response = await llmService.processMessage(input);
        
        if (response.error) {
          setError(response.error);
        }

        addMessage({
          type: 'assistant',
          content: response.content,
          timestamp: new Date().toISOString(),
        });

        if (response.suggestedCommand) {
          addMessage({
            type: 'assistant',
            content: `💡 Try this command: ${response.suggestedCommand}`,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        await processCommand(command);
      }
    } catch (error) {
      addMessage({
        type: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setInput('');
      setSuggestions([]);
      setSelectedSuggestion(-1);
      setIsProcessing(false);
      stopProcessingTimer();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'File' | 'Image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // In a real app, you would upload the file to storage first
      // For now, we'll just create a resource with a mock file path
      await createResource({
        project_id: selectedProject?.id || null,
        task_id: null,
        type,
        url: null,
        file_path: `/uploads/${file.name}`
      });

      addMessage({
        type: 'assistant',
        content: `${type} uploaded successfully: ${file.name}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setError('Failed to upload file');
      console.error('Error uploading file:', error);
    }

    // Reset the input
    e.target.value = '';
  };

  const handleUrlAdd = async () => {
    const url = window.prompt('Enter URL:');
    if (!url) return;

    try {
      new URL(url); // Validate URL format
      await createResource({
        project_id: selectedProject?.id || null,
        task_id: null,
        type: 'URL',
        url,
        file_path: null
      });

      addMessage({
        type: 'assistant',
        content: `URL added successfully: ${url}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setError('Invalid URL format');
    }
  };

  const handleAddNote = () => {
    const note = window.prompt('Enter note:');
    if (!note) return;

    createNote({
      project_id: selectedProject?.id || null,
      task_id: null,
      content: note,
      tags: []
    });

    addMessage({
      type: 'assistant',
      content: 'Note added successfully',
      timestamp: new Date().toISOString(),
    });
  };

  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start recording duration timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      const result = await transcribeAudio();
      
      // Only update input if we got text back
      if (result.text) {
        setInput(prev => {
          const newText = prev + (prev ? ' ' : '') + result.text;
          return newText;
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('Recording error:', error);
    } finally {
      handleStopRecording();
    }
  };

  const handleStopRecording = () => {
    stopTranscription();
    setIsRecording(false);
    
    // Stop recording duration timer
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = undefined;
    }
  };

  const playMessage = async (text: string) => {
    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const audioData = await getCachedSpeech(text, voiceConfig);
      const blob = new Blob([audioData], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };

      audio.onpause = () => {
        setIsPlaying(false);
      };

      audio.onplay = () => {
        setIsPlaying(true);
      };

      setCurrentAudio(audio);
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setError('Failed to play audio message');
    }
  };

  const stopPlayback = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        handleStopRecording();
      }
    };
  }, [isRecording]);

  const renderMessage = (message: Message, index: number) => (
    <div
      key={index}
      className={`flex ${
        message.type === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      <div 
        className={`relative group ${
          message.type === 'user' ? 'message-bubble-user' : 'message-bubble-assistant'
        }`}
      >
        {message.content}
        {message.type === 'assistant' && (
          <button
            onClick={() => isPlaying ? stopPlayback() : playMessage(message.content)}
            className="absolute -right-10 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-800/50 
                     hover:bg-gray-700/50 text-gray-400 hover:text-[#5DADEC] transition-all 
                     opacity-0 group-hover:opacity-100 focus:opacity-100"
            title={isPlaying ? 'Stop' : 'Play'}
          >
            {isPlaying ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message, index) => renderMessage(message, index))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-800/50 backdrop-blur-sm p-6">
        {suggestions.length > 0 && (
          <div className="mb-4 max-h-40 overflow-y-auto card divide-y divide-gray-700/50">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-700/50 
                          transition-all duration-200 flex items-center justify-between ${
                  index === selectedSuggestion ? 'text-[#5DADEC]' : 'text-gray-300'
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <span>{suggestion}</span>
                <ArrowRight className={`w-4 h-4 ${
                  index === selectedSuggestion ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-200`} />
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-4">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isProcessing 
                    ? `Processing${'.'.repeat((processingTime / 500) % 4)}`
                    : "Type a command or ask a question (Shift + Enter for new line)"
                }
                className="input w-full min-h-[50px] max-h-[150px] py-3 resize-none overflow-y-auto"
                disabled={isProcessing}
                rows={1}
              />
              <div className="absolute right-3 bottom-3 text-xs text-gray-500">
                {isProcessing ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span>Press Enter to send</span>
                )}
              </div>
            </div>
            <button
              type="submit"
              className={`btn-primary self-end h-[50px] w-[50px] flex items-center justify-center ${
                isProcessing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-800/50">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => handleFileUpload(e, 'File')}
              className="hidden"
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, 'Image')}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="toolbar-button"
              title="Upload File"
            >
              <FileText className="toolbar-icon" />
            </button>
            <button
              type="button"
              onClick={handleUrlAdd}
              className="toolbar-button"
              title="Add URL"
            >
              <Link className="toolbar-icon" />
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="toolbar-button"
              title="Upload Image"
            >
              <Image className="toolbar-icon" />
            </button>
            <button
              type="button"
              onClick={handleAddNote}
              className="toolbar-button"
              title="Add Note"
            >
              <Edit className="toolbar-icon" />
            </button>
            <button
              type="button"
              className="toolbar-button"
              title="Knowledge Base"
            >
              <Folder className="toolbar-icon" />
            </button>
            <button
              type="button"
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`toolbar-button ${isRecording ? 'text-red-400 hover:text-red-300' : ''}`}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
              disabled={isProcessing}
            >
              <Mic className={`toolbar-icon ${isRecording ? 'animate-pulse' : ''}`} />
              {isRecording && (
                <span className="absolute -top-2 -right-2 text-xs bg-red-500 text-white px-1 rounded-full">
                  {recordingDuration}s
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};