import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { Upload, X, FileText } from 'lucide-react';

interface FileUploadProps {
  label?: string;
  accept?: string;
  maxSize?: number; // in MB
  onFileSelect: (file: File) => void;
  error?: string;
  disabled?: boolean;
}

export function FileUpload({
  label, accept = 'image/jpeg, image/png, application/pdf',
  maxSize = 5, onFileSelect, error, disabled,
}: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > maxSize * 1024 * 1024) return;
    setFileName(file.name);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      
      {fileName ? (
        <div className="relative flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-4">
          {preview ? (
            <img src={preview} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <FileText className="h-6 w-6 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{fileName}</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Remove file"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={clsx(
            'relative flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-6',
            'transition-all duration-200',
            disabled && 'opacity-60 cursor-not-allowed',
            dragOver
              ? 'border-kenya-green-400 bg-kenya-green-50/50 dark:bg-kenya-green-900/10'
              : 'border-gray-300 bg-gray-50 hover:border-kenya-green-400 hover:bg-kenya-green-50/50 dark:border-gray-700 dark:bg-surface-dark dark:hover:border-kenya-green-500 dark:hover:bg-kenya-green-900/10',
          )}
        >
          <div className="text-center">
            <Upload className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" />
            <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Drop your file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Supported: JPG, PNG, PDF (max {maxSize}MB)
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="sr-only"
            disabled={disabled}
          />
        </div>
      )}
      
      {error && (
        <p className="mt-1.5 text-sm text-kenya-red-500 dark:text-kenya-red-400" role="alert">{error}</p>
      )}
    </div>
  );
}
