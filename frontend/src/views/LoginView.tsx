import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { AuthStatusResponse, AuthUser } from '../types';

interface LoginViewProps {
  initialStatus: AuthStatusResponse | null;
  onAuthenticated: (user: AuthUser) => void;
  onStatusUpdated: (status: AuthStatusResponse) => void;
}

export function LoginView({
  initialStatus,
  onAuthenticated,
  onStatusUpdated,
}: LoginViewProps) {
  const [waitingForBrowser, setWaitingForBrowser] = useState(false);
  const [lastAuthUrl, setLastAuthUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialStatus?.last_error || null,
  );
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Poll /api/auth/status while waiting for the system browser callback
  useEffect(() => {
    if (!waitingForBrowser) {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    async function checkAuthProgress() {
      try {
        const status = await api.getAuthStatus();
        onStatusUpdated(status);

        if (status.authenticated && status.user) {
          setWaitingForBrowser(false);
          setErrorMessage(null);
          setExiting(true);
          window.setTimeout(() => {
            onAuthenticated(status.user!);
          }, 180);
          return;
        }

        if (status.last_error) {
          setWaitingForBrowser(false);
          setErrorMessage(status.last_error);
        }
      } catch {
        // Ignore transient polling errors while server processes callback
      }
    }

    pollTimerRef.current = window.setInterval(checkAuthProgress, 1000);
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [waitingForBrowser, onAuthenticated, onStatusUpdated]);

  async function handleContinueWithGoogle() {
    setErrorMessage(null);
    try {
      setWaitingForBrowser(true);
      const res = await api.startGoogleAuth(true);
      setLastAuthUrl(res.auth_url || null);
    } catch (err: unknown) {
      setWaitingForBrowser(false);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCancelWaiting() {
    setWaitingForBrowser(false);
    setLastAuthUrl(null);
    try {
      await api.cancelGoogleAuth();
    } catch {
      // Ignore cancel cleanup errors
    }
  }

  return (
    <main
      aria-label="Google Authentication Gate"
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        overflowY: 'auto',
        opacity: mounted && !exiting ? 1 : 0,
        transform: mounted && !exiting ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.992)',
        transition: 'opacity 180ms ease-out, transform 180ms ease-out',
      }}
    >
      <section
        aria-labelledby="login-gate-heading"
        style={{
          width: '100%',
          maxWidth: 380,
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 14,
          boxShadow: '0 16px 36px -12px rgba(15, 23, 42, 0.08)',
          padding: '28px 26px 24px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header: 44px Geometric Shield Logo + Title + 1-line Subtitle */}
        <header
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 12,
          }}
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{
              flexShrink: 0,
              borderRadius: 10,
              boxShadow: '0 4px 10px -2px rgba(91, 79, 233, 0.24)',
            }}
          >
            <rect width="32" height="32" rx="8" fill="#5B4FE9" />
            <path
              d="M16 5.5L25 9.5V16.2C25 21.6 21.1 25.9 16 27.5C10.9 25.9 7 21.6 7 16.2V9.5L16 5.5Z"
              stroke="#FFFFFF"
              strokeWidth="1.8"
              strokeLinejoin="round"
              fill="rgba(255,255,255,0.12)"
            />
            <path
              d="M16 10.5L11.5 21.5M16 10.5L20.5 21.5M13.2 17.8H18.8"
              stroke="#FFFFFF"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="14.2" r="1.4" fill="#A5F3FC" />
          </svg>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <h1
              id="login-gate-heading"
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: '#0F172A',
                letterSpacing: '-0.02em',
                lineHeight: 1.3,
              }}
            >
              Anti&apos;s Detect Browser
            </h1>
            <p
              style={{
                fontSize: 13,
                color: '#64748B',
                lineHeight: 1.45,
              }}
            >
              Sign in with your Google account to access your workspace.
            </p>
          </div>
        </header>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#B91C1C',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Primary Action: Single Continue with Google Button OR Quiet Browser Callback Waiting State */}
        {!waitingForBrowser ? (
          <button
            type="button"
            onClick={handleContinueWithGoogle}
            style={{
              width: '100%',
              height: 44,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: '#0F172A',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              transition:
                'background-color 140ms ease-out, border-color 140ms ease-out, box-shadow 140ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.borderColor = '#94A3B8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#CBD5E1';
            }}
          >
            {/* Authentic Multi-Color Google G Mark */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <path
                d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z"
                fill="#4285F4"
              />
              <path
                d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z"
                fill="#34A853"
              />
              <path
                d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z"
                fill="#EA4335"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        ) : (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '16px 14px',
              borderRadius: 10,
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid #CBD5E1',
                  borderTopColor: '#5B4FE9',
                  display: 'inline-block',
                  animation: 'antiDetectAuthSpin 750ms linear infinite',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#0F172A',
                }}
              >
                Waiting for Google sign-in in your browser...
              </span>
            </div>

            <p style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.45 }}>
              Complete the prompt in your default browser. This window will unlock automatically.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {lastAuthUrl && (
                <button
                  type="button"
                  onClick={() => api.startGoogleAuth(true)}
                  style={{
                    minHeight: 34,
                    padding: '0 10px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#475569',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Reopen browser
                </button>
              )}
              <button
                type="button"
                onClick={handleCancelWaiting}
                style={{
                  minHeight: 34,
                  padding: '0 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#64748B',
                  backgroundColor: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <style>{`
        @keyframes antiDetectAuthSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
