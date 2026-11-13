import { useState } from 'react';
import {
  Globe,
  LayoutTemplate,
  PanelLeft,
  PanelLeftClose,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import { t } from '../i18n';
import { TabId } from '../types';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  profilesCount: number;
  trashCount: number;
  proxiesCount: number;
  activeEngine: string;
  runningCount: number;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  profilesCount,
  trashCount,
  proxiesCount,
  activeEngine,
  runningCount,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

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
        width: collapsed ? 56 : 220,
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
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '0' : '0 12px 0 16px',
          borderBottom: '1px solid var(--border)',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          <img
            src="/assets/logo.png"
            alt="Octo Logo"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
            style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
          />
          {!collapsed && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: -0.2,
                whiteSpace: 'nowrap',
              }}
            >
              {t.sidebar.appName}
            </span>
          )}
        </div>

        <button
          className="btn-icon"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? t.sidebar.expandSidebar : t.sidebar.collapseSidebar}
          style={{ width: 24, height: 24 }}
        >
          {collapsed ? (
            <PanelLeft size={15} strokeWidth={1.5} />
          ) : (
            <PanelLeftClose size={15} strokeWidth={1.5} />
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
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover-row)';
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
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
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
          padding: collapsed ? '10px 4px' : '10px 14px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: collapsed ? 'center' : 'stretch',
        }}
      >
        {/* Offline Status Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
          title={collapsed ? t.sidebar.offline : undefined}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--status-idle)',
              flexShrink: 0,
            }}
          />
          {!collapsed && <span>{t.sidebar.offline}</span>}
        </div>

        {/* Engine Path & Summary Stats */}
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
    </aside>
  );
}
