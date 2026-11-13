import { ReactNode } from 'react';

export interface KbdProps {
  children: ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-caption)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        padding: '1px 5px',
        lineHeight: 1.2,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {children}
    </kbd>
  );
}
