import { type ChangeEvent, useRef } from 'react';
import { Upload, File } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { cn } from '@/shared/utils/cn';

export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMb?: number;
  label?: string;
  selectedFileName?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  onError?: (message: string) => void;
}

export function FileUpload({
  onFileSelect,
  accept,
  label = 'Choose File',
  selectedFileName,
  maxSizeMb,
  id,
  name,
  disabled,
  required,
  error,
  className,
  onError,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
        onError?.(`File must be ${maxSizeMb} MB or smaller.`);
        e.target.value = '';
        return;
      }
      onFileSelect(file);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <input
        id={id}
        name={name}
        type="file"
        ref={fileInputRef}
        onChange={handleChange}
        accept={accept}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error && id ? `${id}-error` : undefined}
        className="sr-only"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leftIcon={<Upload size={14} />}
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        {label}
      </Button>

      {selectedFileName && (
        <div className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
          <File size={14} />
          <span className="truncate">{selectedFileName}</span>
        </div>
      )}
      {error && <p id={id ? `${id}-error` : undefined} className="w-full text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
