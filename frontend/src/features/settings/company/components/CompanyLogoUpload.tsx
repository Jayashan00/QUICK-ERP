import { useState } from 'react';
import { Building2, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { FileUpload } from '@/shared/components/forms/FileUpload';

interface CompanyLogoUploadProps {
  value?: string;
  onChange: (logoUrl: string) => void;
  disabled?: boolean;
}

export function CompanyLogoUpload({
  value,
  onChange,
  disabled = false,
}: CompanyLogoUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setError(null);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (PNG, JPEG, WebP, or SVG).');
      return;
    }

    // Simulate mock upload / file read to Data URL
    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = () => {
      setTimeout(() => {
        setIsLoading(false);
        const result = reader.result as string;
        onChange(result);
      }, 300);
    };

    reader.onerror = () => {
      setIsLoading(false);
      setError('Failed to process image file.');
    };

    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setError(null);
    onChange('');
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Logo Preview Avatar */}
      <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-400 shadow-xs">
        {isLoading ? (
          <Loader2 className="animate-spin text-blue-600" size={28} />
        ) : value ? (
          <img
            src={value}
            alt="Company Logo"
            className="size-full object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <Building2 size={32} strokeWidth={1.5} />
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              No Logo
            </span>
          </div>
        )}
      </div>

      {/* Upload Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileUpload
            label={value ? 'Change Logo' : 'Upload Logo'}
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            maxSizeMb={2}
            disabled={disabled || isLoading}
            onFileSelect={handleFileSelect}
            onError={(msg) => setError(msg)}
          />

          {value && !disabled && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Trash2 size={14} className="text-red-500" />}
              onClick={handleRemove}
              disabled={isLoading}
            >
              Remove
            </Button>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Recommended: Square PNG, SVG, or JPG, at least 256×256px (max. 2 MB).
        </p>

        {error && (
          <p className="text-xs font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
