'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { getDemoData, DemoDataType } from '@/lib/form-demo-data';

interface FormDemoButtonProps {
  type: DemoDataType;
  onFill: (data: any) => void;
  className?: string;
}

export function FormDemoButton({ type, onFill, className = "" }: FormDemoButtonProps) {
  const handleFill = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent accidental form submission
    const data = getDemoData(type);
    onFill(data);
  };

  return (
    <button
      type="button"
      onClick={handleFill}
      className={`flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-400 transition hover:bg-cyan-500/20 ${className}`}
    >
      <Sparkles size={14} />
      Fill Demo Data
    </button>
  );
}