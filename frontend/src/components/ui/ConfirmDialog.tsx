import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from './Button';
import { Dialog } from './Dialog';

export { useConfirm, ConfirmProvider } from '../../context/ConfirmContext';
export type { ConfirmOptions, PromptOptions } from '../../context/ConfirmContext';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {danger ? (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: '#FEF2F2',
                border: '1px solid #FEE2E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={15} strokeWidth={2} color="#DC2626" />
            </div>
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: '#EEF2FF',
                border: '1px solid #E0E7FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <HelpCircle size={15} strokeWidth={2} color="#4F46E5" />
            </div>
          )}
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{title}</span>
        </div>
      }
      maxWidth={440}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
        {description}
      </div>
    </Dialog>
  );
}
