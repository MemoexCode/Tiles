
import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle, XCircle, ShieldCheck, CloudLightning } from 'lucide-react';
import { checkConnection } from '../services/supabase';

export const Settings: React.FC = () => {
  // Database Connection State
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [dbMessage, setDbMessage] = useState('');

  useEffect(() => {
    // Check Database Connection on mount
    checkDbConnection();
  }, []);

  const checkDbConnection = async () => {
    setDbStatus('checking');
    const result = await checkConnection();
    if (result.success) {
      setDbStatus('connected');
      setDbMessage(result.message || 'Connected');
    } else {
      setDbStatus('error');
      setDbMessage(result.message || 'Connection failed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-2">System status and backend connectivity.</p>
      </div>

      {/* Backend Architecture Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <CloudLightning className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Backend Architecture</h2>
              <p className="text-sm text-gray-500">Supabase Edge Functions & Proxy</p>
            </div>
          </div>
          
          <div className="flex items-center bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
             <CheckCircle className="w-3 h-3 mr-2 text-green-600" />
             <span className="text-xs font-bold uppercase tracking-wide text-green-700">
               Secure
             </span>
          </div>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Your application is configured to use server-side Edge Functions. The USDA API Key is securely stored in the Supabase Vault and is never exposed to the client browser.
          </p>
        </div>
      </div>

      {/* Database Connection Status (Ampel System) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg transition-colors duration-300 ${
              dbStatus === 'connected' ? 'bg-emerald-100' : 
              dbStatus === 'error' ? 'bg-red-100' : 'bg-gray-200'
            }`}>
              <Database className={`w-5 h-5 transition-colors duration-300 ${
                dbStatus === 'connected' ? 'text-emerald-600' : 
                dbStatus === 'error' ? 'text-red-600' : 'text-gray-500'
              }`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Supabase Persistence</h2>
              <p className="text-sm text-gray-500">Database for Caching & AI-Normalization.</p>
            </div>
          </div>
          
          {/* Die Ampel */}
          <div className="flex items-center bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
             <div className={`w-3 h-3 rounded-full mr-2 transition-all duration-500 ${
               dbStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 
               dbStatus === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 
               'bg-yellow-400 animate-pulse'
             }`}></div>
             <span className="text-xs font-bold uppercase tracking-wide text-gray-600">
               {dbStatus === 'connected' ? 'Live' : dbStatus === 'error' ? 'Offline' : 'Checking'}
             </span>
          </div>
        </div>
        
        <div className="p-6">
           <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors duration-300 ${
             dbStatus === 'connected' ? 'bg-emerald-50 border-emerald-200' : 
             dbStatus === 'error' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
           }`}>
             <div className="flex items-center">
               {dbStatus === 'checking' && <RefreshCw className="w-5 h-5 text-gray-500 animate-spin mr-3" />}
               {dbStatus === 'connected' && <CheckCircle className="w-5 h-5 text-emerald-600 mr-3" />}
               {dbStatus === 'error' && <XCircle className="w-5 h-5 text-red-600 mr-3" />}
               
               <div>
                 <span className={`font-medium transition-colors duration-300 ${
                   dbStatus === 'connected' ? 'text-emerald-900' : 
                   dbStatus === 'error' ? 'text-red-900' : 'text-gray-700'
                 }`}>
                   {dbStatus === 'checking' ? 'Establishing secure connection...' : 
                    dbStatus === 'connected' ? 'System Operational' : 'Connection Failed'}
                 </span>
                 {dbMessage && (
                   <p className={`text-xs mt-0.5 transition-colors duration-300 ${
                     dbStatus === 'connected' ? 'text-emerald-700' : 
                     dbStatus === 'error' ? 'text-red-700' : 'text-gray-500'
                   }`}>
                     {dbMessage}
                   </p>
                 )}
               </div>
             </div>

             <button 
               onClick={checkDbConnection}
               className="text-sm text-gray-500 hover:text-gray-900 underline px-2"
             >
               Check Again
             </button>
           </div>
           
           {dbStatus === 'connected' && (
             <div className="mt-4 flex items-start text-xs text-gray-500">
               <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-500" />
               Your database is ready for AI-Generated Images (using 'visual_parent' grouping).
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
