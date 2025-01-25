import React, { useState, useCallback } from 'react';
import { Upload, Link, Image as ImageIcon, X, ExternalLink, Download, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Resource } from '../types';

interface ResourceManagerProps {
  projectId?: string;
  taskId?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_FILE_TYPES = {
  'application/pdf': { type: 'PDF', extensions: ['.pdf'] },
  'application/msword': { type: 'DOC', extensions: ['.doc'] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { 
    type: 'DOCX', 
    extensions: ['.docx'] 
  },
  'image/jpeg': { type: 'Image', extensions: ['.jpg', '.jpeg'] },
  'image/png': { type: 'Image', extensions: ['.png'] },
  'image/gif': { type: 'Image', extensions: ['.gif'] }
};

export const ResourceManager: React.FC<ResourceManagerProps> = ({ projectId, taskId }) => {
  const { createResource, deleteResource, resources, fetchResources } = useStore();
  const [url, setUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter resources for current project/task
  const filteredResources = resources.filter(resource => 
    (projectId && resource.project_id === projectId) || 
    (taskId && resource.task_id === taskId)
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 10MB limit';
    }

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;

    // Check if the file type is supported
    const supportedType = Object.entries(SUPPORTED_FILE_TYPES).find(([mime, info]) => {
      return mime === mimeType && info.extensions.includes(fileExtension);
    });

    if (!supportedType) {
      return 'Unsupported file type or extension';
    }

    return null;
  };

  const validateUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        setError(error);
        return;
      }

      try {
        const type = SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES].type;
        await createResource({
          project_id: projectId || null,
          task_id: taskId || null,
          type: type as 'URL' | 'File' | 'Image',
          url: null,
          file_path: `/uploads/${file.name}` // In a real app, handle file upload to storage
        });
      } catch (error) {
        setError('Failed to upload file');
        console.error('Error uploading file:', error);
      }
    }
  }, [projectId, taskId, createResource]);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url) return;

    if (!validateUrl(url)) {
      setError('Please enter a valid HTTP or HTTPS URL');
      return;
    }

    try {
      await createResource({
        project_id: projectId || null,
        task_id: taskId || null,
        type: 'URL',
        url,
        file_path: null
      });
      setUrl('');
    } catch (error) {
      setError('Failed to add URL resource');
      console.error('Error adding URL:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this resource?')) {
      try {
        await deleteResource(id);
      } catch (error) {
        setError('Failed to delete resource');
        console.error('Error deleting resource:', error);
      }
    }
  };

  const renderResourcePreview = (resource: Resource) => {
    switch (resource.type) {
      case 'Image':
        return (
          <div className="relative group aspect-video bg-gray-800 rounded-lg overflow-hidden">
            <img
              src={resource.file_path || ''}
              alt="Resource preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={() => window.open(resource.file_path || '', '_blank')}
                className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(resource.id)}
                className="p-2 rounded-full bg-gray-800/50 hover:bg-red-600/50 text-white transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      case 'URL':
        return (
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Link className="w-5 h-5 text-[#5DADEC] flex-shrink-0" />
              <a
                href={resource.url || ''}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-300 hover:text-white truncate transition-colors"
              >
                {resource.url}
              </a>
            </div>
            <button
              onClick={() => handleDelete(resource.id)}
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      case 'File':
        return (
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-[#5DADEC]" />
              <span className="text-sm text-gray-300">
                {resource.file_path?.split('/').pop()}
              </span>
            </div>
            <button
              onClick={() => handleDelete(resource.id)}
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Resources</h3>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 text-red-300 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* URL Input */}
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">
            Add URL
          </button>
        </form>

        {/* File Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-[#5DADEC] bg-[#5DADEC]/5'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <Upload className={`w-8 h-8 ${
              dragActive ? 'text-[#5DADEC]' : 'text-gray-400'
            }`} />
            <div className="text-sm">
              <span className="text-gray-400">
                Drag and drop files here, or{' '}
              </span>
              <label className="text-[#5DADEC] hover:text-[#5DADEC]/80 cursor-pointer">
                browse
                <input
                  type="file"
                  className="hidden"
                  accept={Object.keys(SUPPORTED_FILE_TYPES).join(',')}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleDrop({
                        preventDefault: () => {},
                        stopPropagation: () => {},
                        dataTransfer: { files: [file] }
                      } as unknown as React.DragEvent);
                    }
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Supported formats: PDF, DOC, DOCX, JPEG, PNG, GIF (max 10MB)
            </p>
          </div>
        </div>

        {/* Resource List */}
        {filteredResources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredResources.map((resource) => (
              <div key={resource.id}>
                {renderResourcePreview(resource)}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">No resources added yet</p>
          </div>
        )}
      </div>
    </div>
  );
};