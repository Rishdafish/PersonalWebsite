import React from 'react';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const ConnectionErrorBanner: React.FC = () => {
  const { connectionError, retryConnection, loading } = useAuth();

  if (!connectionError) return null;

  const handleRetry = async () => {
    await retryConnection();
  };

  const openSupabaseDashboard = () => {
    window.open('https://supabase.com/dashboard', '_blank');
  };

  return (
    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Database Connection Error
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{connectionError}</p>
            <div className="mt-3">
              <p className="font-medium">Possible solutions:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Check if your Supabase project is paused and unpause it</li>
                <li>Verify your internet connection is stable</li>
                <li>Ensure your environment variables are correct</li>
                <li>Check Supabase status page for any outages</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={handleRetry}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <RefreshCw className="animate-spin h-4 w-4 mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry Connection
            </button>
            <button
              onClick={openSupabaseDashboard}
              className="inline-flex items-center px-3 py-2 border border-red-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Supabase Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};