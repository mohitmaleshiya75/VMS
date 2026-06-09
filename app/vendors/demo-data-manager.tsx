'use client';

import React from 'react';
import { RefreshCw, Database, Trash2 } from 'lucide-react';
import { useVendors } from '@/lib/vendor-store';
import { useToast } from '@/components/toast';

export function DemoDataManager() {
  const toast = useToast();
  const { reset } = useVendors();

  const handleLoad = () => {
    toast({
      type: 'success',
      title: 'Demo workspace loaded successfully',
      description: 'The platform is now populated with 20 leads and 5 active campaigns.'
    });
    // Refresh to trigger re-fetch in all components
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleReset = () => {
    reset();
    toast({
      type: 'warning',
      title: 'Workspace Reset',
      description: 'All demo data has been removed.'
    });
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur-md">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Database size={16} className="text-cyan-400" />
          Showcase Mode
        </div>
        <p className="text-[11px] text-slate-400">Initialize realistic data for client presentation</p>
      </div>
      
      <div className="flex gap-2 ml-auto">
        <button
          onClick={handleLoad}
          className="flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200"
        >
          <RefreshCw size={14} />
          Load Demo Data
        </button>
        
        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10"
        >
          <Trash2 size={14} />
          Reset
        </button>
      </div>
    </div>
  );
}