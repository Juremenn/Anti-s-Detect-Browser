import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

export interface PromptOptions {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm(): ConfirmContextType {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  // Confirm Dialog State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // Prompt Dialog State
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    options: PromptOptions;
    resolve: (value: string | null) => void;
  } | null>(null);

  const [promptValue, setPromptValue] = useState('');
  const promptInputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    setPromptValue(options.defaultValue || '');
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  // Auto-focus prompt input
  useEffect(() => {
    if (promptState?.isOpen) {
      setTimeout(() => {
        if (promptInputRef.current) {
          promptInputRef.current.focus();
          promptInputRef.current.select();
        }
      }, 50);
    }
  }, [promptState?.isOpen]);

  // Global keydown listeners for Escape and Enter
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (confirmState?.isOpen) {
          confirmState.resolve(false);
          setConfirmState(null);
        } else if (promptState?.isOpen) {
          promptState.resolve(null);
          setPromptState(null);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState, promptState]);

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}

      {/* Confirmation Modal */}
      {confirmState?.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            animation: 'fadeIn 120ms ease-out',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              confirmState.resolve(false);
              setConfirmState(null);
            }
          }}
        >
          <div
            style={{
              width: 'min(440px, 92vw)',
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              border: '1px solid #E5E7EB',
              boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
              overflow: 'hidden',
              animation: 'scaleIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 20px 14px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: confirmState.options.variant === 'danger' ? '#FEF2F2' : '#EEF2FF',
                    border: confirmState.options.variant === 'danger' ? '1px solid #FEE2E2' : '1px solid #E0E7FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {confirmState.options.variant === 'danger' ? (
                    <AlertTriangle size={16} strokeWidth={2} color="#DC2626" />
                  ) : (
                    <HelpCircle size={16} strokeWidth={2} color="#4F46E5" />
                  )}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#0F172A',
                    lineHeight: 1.3,
                  }}
                >
                  {confirmState.options.title}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 120ms ease, color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F1F5F9';
                  e.currentTarget.style.color = '#0F172A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#94A3B8';
                }}
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </div>

            {/* Description */}
            <div
              style={{
                padding: '0 20px 20px 20px',
                fontSize: 13,
                color: '#64748B',
                lineHeight: 1.5,
              }}
            >
              {confirmState.options.description}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '12px 20px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                style={{
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 6,
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F3F4F6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                {confirmState.options.cancelLabel || 'Cancel'}
              </button>

              <button
                type="button"
                autoFocus
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
                style={{
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 6,
                  border: '1px solid transparent',
                  backgroundColor: confirmState.options.variant === 'danger' ? '#DC2626' : '#4F46E5',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  transition: 'background-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    confirmState.options.variant === 'danger' ? '#B91C1C' : '#4338CA';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    confirmState.options.variant === 'danger' ? '#DC2626' : '#4F46E5';
                }}
              >
                {confirmState.options.confirmLabel || (confirmState.options.variant === 'danger' ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptState?.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            animation: 'fadeIn 120ms ease-out',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              promptState.resolve(null);
              setPromptState(null);
            }
          }}
        >
          <div
            style={{
              width: 'min(440px, 92vw)',
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              border: '1px solid #E5E7EB',
              boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
              overflow: 'hidden',
              animation: 'scaleIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 20px 12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#0F172A',
                }}
              >
                {promptState.options.title}
              </div>

              <button
                type="button"
                onClick={() => {
                  promptState.resolve(null);
                  setPromptState(null);
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                promptState.resolve(promptValue.trim());
                setPromptState(null);
              }}
              style={{ padding: '0 20px 20px 20px' }}
            >
              {promptState.options.description && (
                <div
                  style={{
                    fontSize: 13,
                    color: '#64748B',
                    lineHeight: 1.5,
                    marginBottom: 12,
                  }}
                >
                  {promptState.options.description}
                </div>
              )}

              <input
                ref={promptInputRef}
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptState.options.placeholder || 'Enter value...'}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: '1px solid #D1D5DB',
                  fontSize: 13,
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 120ms ease, box-shadow 120ms ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#4F46E5';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#D1D5DB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />

              {/* Footer */}
              <div
                style={{
                  marginTop: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    promptState.resolve(null);
                    setPromptState(null);
                  }}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 6,
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {promptState.options.cancelLabel || 'Cancel'}
                </button>

                <button
                  type="submit"
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 6,
                    border: '1px solid transparent',
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {promptState.options.confirmLabel || 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
