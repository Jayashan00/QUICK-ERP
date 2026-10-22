import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';
import { controlBase, controlError } from './controlStyles';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ error, className, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={error || undefined}
      rows={rows}
      className={cn(controlBase, 'h-auto min-h-24 resize-y py-2', error && controlError, className)}
      {...props}
    />
  );
});
