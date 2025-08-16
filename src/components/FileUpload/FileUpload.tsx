import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Upload, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (content: string, fileName: string) => void | Promise<void>;
}

export default function FileUpload({ onFileUpload }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileRead = useCallback(
    (file: File) => {
      setIsUploading(true);
      const reader = new FileReader();

      reader.onload = async e => {
        try {
          const content = e.target?.result as string;
          await onFileUpload(content, file.name);
        } catch (error) {
          console.error('Error processing file:', error);
        } finally {
          setIsUploading(false);
        }
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
    <Card className="w-full bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-gray-100 text-lg font-bold">
          <Upload className="h-5 w-5" />
          File Upload
        </CardTitle>
        <CardDescription className="text-gray-400 text-sm">
          Upload your requirements.txt file to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
            isDragOver
              ? 'border-blue-500 bg-blue-500/5'
              : 'border-zinc-600 hover:border-zinc-500 hover:bg-zinc-800/30'
          }`}
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
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={isUploading}
          />

          <div className="text-center relative pointer-events-none">
            <div className="flex justify-center mb-3">
              <FileText className="h-12 w-12 text-zinc-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-100 mb-2">
              Upload Requirements File
            </h3>
            <p className="text-gray-400 text-sm mb-3">
              Drag and drop your{' '}
              <span className="mono text-blue-400">requirements.txt</span> file
              here, or click to browse
            </p>

            {isUploading && (
              <div className="text-blue-400 font-semibold animate-pulse text-sm">
                Processing file...
              </div>
            )}

            {!isUploading && (
              <div className="text-xs text-gray-500">
                Supported formats:{' '}
                <span className="mono text-zinc-400">.txt</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
