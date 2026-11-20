import { useEffect, useState } from 'react';
import {
  Globe,
  LayoutTemplate,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Puzzle,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import { t } from '../i18n';
import { AuthUser, SyncStatusResponse, TabId } from '../types';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  profilesCount: number;
  trashCount: number;
  proxiesCount: number;
  extensionsCount?: number;
  activeEngine: string;
  runningCount: number;
  user?: AuthUser | null;
  onSignOut?: () => void;
  syncStatus?: SyncStatusResponse | null;
  isSyncing?: boolean;
  onSyncNow?: () => void;
  onReconnectDrive?: () => void;
}

function formatSyncTimeLabel(timestampMs: number | null | undefined): string {
  if (!timestampMs) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function getInitials(nameOrEmail: string): string {
  const clean = (nameOrEmail || '').trim();
  if (!clean) return 'G';
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function Sidebar({
  activeTab,
  onSelectTab,
  profilesCount,
  trashCount,
  proxiesCount,
  extensionsCount = 0,
  activeEngine,
  runningCount,
  user,
  onSignOut,
  syncStatus,
  isSyncing = false,
  onSyncNow,
  onReconnectDrive,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('anti_detect_sidebar_collapsed') === 'true';
  });
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.picture]);

  useEffect(() => {
    localStorage.setItem('anti_detect_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  const navItems = [
    {
      id: 'profiles' as TabId,
      label: t.nav.profiles,
      badge: profilesCount,
      icon: Users,
    },
    {
      id: 'proxies' as TabId,
      label: t.nav.proxies,
      badge: proxiesCount > 0 ? proxiesCount : undefined,
      icon: Globe,
    },
    {
      id: 'templates' as TabId,
      label: t.nav.templates,
      icon: LayoutTemplate,
    },
    {
      id: 'extensions' as TabId,
      label: t.nav.extensions,
      badge: extensionsCount > 0 ? extensionsCount : undefined,
      icon: Puzzle,
    },
    {
      id: 'trash' as TabId,
      label: t.nav.trash,
      badge: trashCount > 0 ? trashCount : undefined,
      icon: Trash2,
    },
    {
      id: 'settings' as TabId,
      label: t.nav.settings,
      icon: Settings,
    },
  ];

  return (
    <aside
      style={{
        width: collapsed ? 60 : 244,
        height: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        userSelect: 'none',
        transition: 'width 140ms ease-out',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Sidebar Header */}
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '0' : '0 12px 0 14px',
          borderBottom: '1px solid var(--border)',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
            aria-label="Anti's Detect Browser Logo"
          >
            <rect width="32" height="32" rx="8" fill="var(--accent)" />
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
          {!collapsed && (
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              {t.sidebar.appName}
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn-icon"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? t.sidebar.expandSidebar : t.sidebar.collapseSidebar}
          aria-label={collapsed ? t.sidebar.expandSidebar : t.sidebar.collapseSidebar}
          aria-expanded={!collapsed}
          style={{ width: 24, height: 24 }}
        >
          {collapsed ? (
            <PanelLeft size={15} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={15} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Nav Items */}
      <nav
        style={{
          flex: 1,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                height: 32,
                padding: collapsed ? '0' : '0 10px',
                borderRadius: 'var(--radius-control)',
                fontSize: 12.5,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-raised)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 120ms ease-out, color 120ms ease-out',
                width: '100%',
                textAlign: 'left',
                position: 'relative',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* 2px Accent Bar on Left for Active Item */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 6,
                    bottom: 6,
                    width: 2,
                    borderRadius: 1,
                    backgroundColor: 'var(--accent)',
                  }}
                />
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  overflow: 'hidden',
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={1.5}
                  color={isActive ? 'var(--accent)' : 'var(--text-secondary)'}
                  style={{ flexShrink: 0 }}
                />
                {!collapsed && (
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </div>

              {!collapsed && item.badge !== undefined && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '0 6px',
                    borderRadius: 10,
                    backgroundColor: 'var(--bg-raised)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontFamily: 'var(--font-sans)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Authenticated Google Account Badge + Cloud Sync Status */}
        {user && (
          <div
            style={{
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: collapsed ? '10px 6px' : '10px 12px',
                display: 'flex',
                flexDirection: collapsed ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  minWidth: 0,
                  flex: collapsed ? 'none' : 1,
                }}
                title={`${user.name} (${user.email})`}
              >
                {user.picture && !avatarFailed ? (
                  <img
                    src={user.picture}
                    alt={user.name || user.email}
                    width={28}
                    height={28}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid #E5E7EB',
                      objectFit: 'cover',
                      flexShrink: 0,
                      backgroundColor: '#F8FAFC',
                    }}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F1F5F9',
                      color: '#0F172A',
                      fontSize: 11,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {getInitials(user.name || user.email)}
                  </div>
                )}

                {!collapsed && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      flex: 1,
                      gap: 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                      }}
                    >
                      {user.name || user.email}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.25,
                      }}
                    >
                      {user.email}
                    </div>
                  </div>
                )}
              </div>

              {onSignOut && (
                <button
                  type="button"
                  className="btn-icon danger"
                  onClick={onSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  style={{
                    width: 28,
                    height: 28,
                    borderColor: 'transparent',
                  }}
                >
                  <LogOut size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Subtle Cloud Sync Status Row */}
            {(() => {
              const rawState = isSyncing ? 'syncing' : syncStatus?.state || 'idle';
              const activeSyncing = rawState === 'syncing';
              const needsReauth = rawState === 'needs_reauth';
              const dotColor =
                rawState === 'synced'
                  ? '#10B981'
                  : activeSyncing
                    ? '#4F46E5'
                    : needsReauth
                      ? '#D97706'
                      : rawState === 'error'
                        ? '#DC2626'
                        : '#94A3B8';
              const statusLabel = activeSyncing
                ? 'Syncing...'
                : rawState === 'synced'
                  ? `Synced · ${formatSyncTimeLabel(syncStatus?.last_synced_at)}`
                  : needsReauth
                    ? 'Drive permission required'
                    : rawState === 'offline'
                      ? 'Offline'
                      : rawState === 'error'
                        ? 'Sync error'
                        : 'Cloud Sync ready';
              const tooltipText = syncStatus?.error_message
                ? `${statusLabel}: ${syncStatus.error_message}`
                : statusLabel;

              if (collapsed) {
                return (
                  <div
                    style={{
                      padding: '4px 6px 8px 6px',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={needsReauth && onReconnectDrive ? onReconnectDrive : onSyncNow}
                      disabled={activeSyncing || (!onSyncNow && !onReconnectDrive)}
                      title={tooltipText}
                      aria-label={needsReauth ? 'Reconnect Drive' : `Sync Now (${statusLabel})`}
                      style={{
                        width: 28,
                        height: 28,
                        borderColor: 'transparent',
                        position: 'relative',
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={activeSyncing ? 'sync-icon-spinning' : undefined}
                        style={{ transition: 'transform 150ms ease-out' }}
                      >
                        <path d="M13.5 8a5.5 5.5 0 0 1-9.39 3.89" />
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.39-3.89" />
                        <path d="M12.5 2.5v2.75H9.75" />
                        <path d="M3.5 13.5v-2.75h2.75" />
                      </svg>
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          right: 4,
                          bottom: 4,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: dotColor,
                          border: '1px solid var(--bg-surface)',
                        }}
                      />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    padding: '6px 12px 9px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                    title={tooltipText}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="var(--text-secondary)"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        style={{ flexShrink: 0 }}
                      >
                        <path d="M4.5 12.25h7.25a2.5 2.5 0 0 0 .37-4.97 3.75 3.75 0 0 0-7.24-1.05A2.75 2.75 0 0 0 4.5 12.25Z" />
                      </svg>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: dotColor,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11.5,
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.2,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {onSyncNow && !needsReauth && (
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={onSyncNow}
                        disabled={activeSyncing}
                        title="Sync Now"
                        aria-label="Sync Now"
                        style={{
                          width: 24,
                          height: 24,
                          borderColor: 'transparent',
                          color: activeSyncing ? '#4F46E5' : 'var(--text-secondary)',
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className={activeSyncing ? 'sync-icon-spinning' : undefined}
                          style={{ transition: 'transform 150ms ease-out' }}
                        >
                          <path d="M13.5 8a5.5 5.5 0 0 1-9.39 3.89" />
                          <path d="M2.5 8a5.5 5.5 0 0 1 9.39-3.89" />
                          <path d="M12.5 2.5v2.75H9.75" />
                          <path d="M3.5 13.5v-2.75h2.75" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {needsReauth && onReconnectDrive && (
                    <button
                      type="button"
                      onClick={onReconnectDrive}
                      style={{
                        width: '100%',
                        minHeight: 28,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #C7D2FE',
                        backgroundColor: '#EEF2FF',
                        color: '#3730A3',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      Reconnect Drive
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Engine & Profile Status Block */}
        <div
          style={{
            padding: collapsed ? '10px 4px' : '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: collapsed ? 'center' : 'stretch',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
            title={collapsed ? (user ? 'Google verified' : t.sidebar.offline) : undefined}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: user ? 'var(--status-success)' : 'var(--text-tertiary)',
                flexShrink: 0,
              }}
            />
            {!collapsed && <span>{user ? 'Google verified' : t.sidebar.offline}</span>}
          </div>

          {!collapsed && (
            <>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={activeEngine || t.sidebar.engineDetecting}
              >
                {activeEngine ? activeEngine.split(/[\\/]/).pop() : t.sidebar.engineDetecting}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {t.sidebar.stats(profilesCount, runningCount)}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
