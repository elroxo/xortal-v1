import React from 'react';
import { AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { AppError } from '../lib/errorHandler';

export const ErrorDisplay: React.FC = () => {
  const { lastError, clearError } = useStore();

  if (!lastError) return null;

  const getIcon = (error: AppError) => {
    switch (error.type) {
      case 'network':
        return <RefreshCw className="w-5 h-5 text-yellow-300" />;
      case 'database':
      case 'validation':
        return <AlertCircle className="w-5 h-5 text-red-300" />;
      default:
        return <XCircle className="w-5 h-5 text-red-300" />;
    }
  };

  const getBackgroundColor = (error: AppError) => {
    switch (error.type) {
      case 'network':
        return 'bg-yellow-900/30 border-yellow-500/30';
      case 'database':
      case 'validation':
        return 'bg-red-900/30 border-red-500/30';
      default:
        return 'bg-gray-800/50 border-gray-700/50';
    }
  };

  return (
    <div className={`fixed bottom-6 right-6 max-w-md card ${getBackgroundColor(lastError)} p-4`}>
      <div className="flex items-start space-x-3">
        {getIcon(lastError)}
        <div className="flex-1">
          <h3 className="font-medium text-white">{lastError.message}</h3>
          {lastError.details && (
            <p className="mt-1 text-sm text-gray-300">{lastError.details}</p>
          )}
          {lastError.resolution && (
            <p className="mt-2 text-sm text-gray-400">{lastError.resolution}</p>
          )}
        </div>
        <button
          onClick={clearError}
          className="text-gray-400 hover:text-gray-300 transition-colors"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};