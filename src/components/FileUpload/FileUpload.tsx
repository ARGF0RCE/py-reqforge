import { useState, useCallback } from 'react';

interface FileUploadProps {
  onFileUpload: (content: string, fileName: string) => void;
}

export default function FileUpload({ onFileUpload }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileRead = useCallback(
    (file: File) => {
      setIsUploading(true);
      const reader = new FileReader();

      reader.onload = e => {
        const content = e.target?.result as string;
        onFileUpload(content, file.name);
        setIsUploading(false);
      };

      reader.onerror = () => {
        setIsUploading(false);
        console.error('Error reading file');
      };

      reader.readAsText(file);
    },
    [onFileUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const txtFile = files.find(file => file.name.endsWith('.txt'));

      if (txtFile) {
        handleFileRead(txtFile);
      }
    },
    [handleFileRead]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileRead(file);
      }
    },
    [handleFileRead]
  );

  return (
    <div className="bg-gradient-upload p-6 rounded-lg border-2 border-dashed border-blue-300">
      <div
        className={`relative ${isDragOver ? 'bg-blue-50' : ''}`}
        onDragOver={e => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".txt"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />

        <div className="text-center py-8">
          <div className="text-4xl mb-4">📁</div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Upload Requirements File
          </h3>
          <p className="text-blue-200 mb-4">
            Drag and drop your requirements.txt file here, or click to browse
          </p>

          {isUploading && (
            <div className="text-blue-300">Processing file...</div>
          )}
        </div>
      </div>
    </div>
  );
}
