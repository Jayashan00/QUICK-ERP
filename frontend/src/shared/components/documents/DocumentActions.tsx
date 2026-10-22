import { Printer, Download, Send, Edit, Copy } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';

export interface DocumentActionsProps {
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  onSendEmail?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
}

export function DocumentActions({
  onPrint = () => window.print(),
  onDownloadPdf,
  onSendEmail,
  onEdit,
  onDuplicate,
}: DocumentActionsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {onEdit && (
        <Button variant="secondary" size="sm" leftIcon={<Edit size={14} />} onClick={onEdit}>
          Edit
        </Button>
      )}
      {onDuplicate && (
        <Button variant="secondary" size="sm" leftIcon={<Copy size={14} />} onClick={onDuplicate}>
          Duplicate
        </Button>
      )}
      {onPrint && (
        <Button variant="secondary" size="sm" leftIcon={<Printer size={14} />} onClick={onPrint}>
          Print
        </Button>
      )}
      {onDownloadPdf && (
        <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={onDownloadPdf}>
          PDF
        </Button>
      )}
      {onSendEmail && (
        <Button variant="primary" size="sm" leftIcon={<Send size={14} />} onClick={onSendEmail}>
          Send
        </Button>
      )}
    </div>
  );
}
