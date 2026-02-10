import React, { useCallback } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: FileList) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFilesSelected(e.dataTransfer.files);
      }
    },
    [onFilesSelected]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
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
      className="group border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:bg-slate-50 hover:border-aena-green transition-all cursor-pointer bg-white relative overflow-hidden"
    >
      <input
        type="file"
        multiple
        onChange={handleChange}
        className="hidden"
        id="fileInput"
        accept=".txt"
      />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-50 group-hover:text-aena-green transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-slate-700">Drag & Drop files here</h3>
        <p className="text-sm text-slate-500 mt-2 mb-6 max-w-sm mx-auto">
            Upload your daily transaction files (11004) and summary files (11008) to validate data coherence.
        </p>
        
        <label htmlFor="fileInput" className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-6 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
            Browse Computer
        </label>
      </div>
    </div>
  );
};

export default FileUpload;