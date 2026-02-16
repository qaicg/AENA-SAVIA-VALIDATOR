
import React, { useCallback, useState } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: FileList) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFilesSelected(e.dataTransfer.files);
      }
    },
    [onFilesSelected]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative group rounded-3xl p-12 text-center transition-all duration-500 cursor-pointer overflow-hidden border-[3px] border-dashed
        ${isDragActive 
          ? 'border-aena-green bg-green-50/30 scale-[1.01] shadow-2xl shadow-aena-green/20' 
          : 'border-slate-200 hover:border-aena-green/40 hover:bg-slate-50/50 hover:shadow-xl hover:shadow-slate-200/50'
        }
      `}
    >
      <input
        type="file"
        multiple
        onChange={handleChange}
        className="hidden"
        id="fileInput"
        accept=".txt"
      />
      
      {/* --- Technical Background Layers --- */}
      
      {/* 1. Dot Pattern Background (Animated) */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none animate-grid-flow"
        style={{
            backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
            backgroundSize: '24px 24px'
        }}
      ></div>

      {/* 2. Abstract Ambient Gradients (Animated) */}
      <div className={`
        absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-aena-green/20 to-emerald-100/20 blur-3xl transition-all duration-1000 ease-in-out pointer-events-none
        ${isDragActive ? 'translate-y-10 scale-110 opacity-60' : 'opacity-30'}
      `}></div>
      
      <div className={`
        absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-blue-600/10 to-indigo-100/20 blur-3xl transition-all duration-1000 ease-in-out pointer-events-none
        ${isDragActive ? '-translate-y-10 scale-110 opacity-60' : 'opacity-30'}
      `}></div>

      {/* --- Content Content --- */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        
        {/* Icon Circle with Ring Effect */}
        <div className="relative mb-6">
            <div className={`absolute inset-0 rounded-full blur opacity-40 transition-all duration-500 ${isDragActive ? 'bg-aena-green scale-150' : 'bg-slate-300 scale-90'}`}></div>
            <div className={`
                relative w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm border
                ${isDragActive 
                    ? 'bg-gradient-to-b from-aena-green to-aena-accent text-white border-transparent rotate-3 shadow-lg shadow-green-200' 
                    : 'bg-white text-slate-400 border-slate-100 group-hover:text-aena-green group-hover:border-green-100 group-hover:-translate-y-1'
                }
            `}>
                {isDragActive ? (
                     <svg className="w-10 h-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                     </svg>
                ) : (
                    // Cloud Upload Icon with Bounce Animation
                    <svg className="w-10 h-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                )}
            </div>
        </div>
        
        <div className="space-y-2 mb-8">
            <h3 className={`text-2xl font-bold font-display transition-colors ${isDragActive ? 'text-aena-dark' : 'text-slate-700'}`}>
                {isDragActive ? 'Drop Files to Initiate Audit' : 'Upload Transaction Logs'}
            </h3>
            <p className="text-slate-500 max-w-md mx-auto leading-relaxed text-sm">
                Drag and drop your <span className="font-mono text-aena-green font-bold bg-green-50 px-1 rounded">11004</span> and <span className="font-mono text-blue-600 font-bold bg-blue-50 px-1 rounded">11008</span> raw files here.
                <br />
                <span className="text-xs text-slate-400">Our system will automatically detect file types.</span>
            </p>
        </div>

        <div>
            <label 
                htmlFor="fileInput" 
                className={`
                    relative overflow-hidden inline-flex items-center px-8 py-3.5 text-sm font-bold tracking-wide rounded-xl transition-all cursor-pointer group/btn
                    ${isDragActive ? 'bg-aena-green text-white shadow-lg' : 'bg-slate-900 text-white shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5'}
                `}
            >
                {/* Button Shine Effect */}
                <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                
                <svg className="w-5 h-5 mr-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Browse Local Files</span>
            </label>
        </div>
        
      </div>
    </div>
  );
};

export default FileUpload;
