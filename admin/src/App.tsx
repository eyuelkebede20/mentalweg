import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import CalendarPage from './pages/CalendarPage';
import TodayPage from './pages/TodayPage';
import ClientsPage from './pages/ClientsPage';
import IntakePage from './pages/IntakePage';
import MoneyPage from './pages/MoneyPage';
import SettingsPage from './pages/SettingsPage';
import ContentPage from './pages/ContentPage';
import ProfileSwitcher from './components/ProfileSwitcher';
import ThemeToggle from './components/ThemeToggle';
import VersionBadge from './components/VersionBadge';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { usePwaInstall } from './utils/usePwaInstall';
import { Calendar, Clock, Users, UserPlus, DollarSign, Settings as SettingsIcon, BookOpen, Download, X } from 'lucide-react';

function Navigation() {
  const location = useLocation();
  const { accentColor } = useTheme();
  const { canInstall, promptInstall } = usePwaInstall();
  const [showIosTip, setShowIosTip] = useState(false);

  const navItems = [
    { path: '/', label: 'Today', icon: Clock },
    { path: '/calendar', label: 'Calendar', icon: Calendar },
    { path: '/intake', label: 'New Patient', icon: UserPlus },
    { path: '/clients', label: 'Clients', icon: Users },
    { path: '/content', label: 'Resources', icon: BookOpen },
    { path: '/money', label: 'Money', icon: DollarSign },
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="nav-sidebar">
        <div>
          <div className="sidebar-brand">
            <div className="brand-logo" style={{ background: accentColor }}>
              MW
            </div>
            <div>
              <h2 className="brand-title">Mentalweg</h2>
              <span className="brand-badge">Clinical CMS</span>
            </div>
          </div>

          <div className="nav-links-list">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item-link ${active ? 'active' : ''}`}
                >
                  <Icon className="w-4 h-4 mr-2.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="sidebar-footer">
          {canInstall && (
            <button
              type="button"
              className="pwa-install-btn"
              onClick={async () => {
                const res = await promptInstall();
                if (res === 'ios') {
                  setShowIosTip(true);
                  setTimeout(() => setShowIosTip(false), 8000);
                }
              }}
              title="Install Mentalweg Clinical CMS app to your home screen or desktop"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              <span>Install Clinical App</span>
            </button>
          )}

          {showIosTip && (
            <div className="pwa-toast-ios" role="alert" style={{ fontSize: '11px', padding: '6px 10px', marginTop: 4 }}>
              <span>To install on iOS: tap Safari Share (⎋), then "Add to Home Screen" (⊞).</span>
              <button type="button" onClick={() => setShowIosTip(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--mut)', fontWeight: 600 }}>THEME</span>
            <ThemeToggle />
          </div>
          <ProfileSwitcher />
          <VersionBadge mode="compact" />
        </div>
      </nav>

      {/* Mobile Phone Top Header */}
      <header className="mobile-top-header">
        <div className="mobile-brand">
          <div className="brand-logo-sm" style={{ background: accentColor }}>MW</div>
          <div>
            <h2 className="mobile-brand-title">Mentalweg</h2>
            <span className="mobile-brand-badge">Clinical CMS</span>
          </div>
        </div>
        <div className="mobile-header-actions">
          {canInstall && (
            <button
              type="button"
              className="mobile-install-btn"
              onClick={async () => {
                const res = await promptInstall();
                if (res === 'ios') {
                  setShowIosTip(true);
                  setTimeout(() => setShowIosTip(false), 8000);
                }
              }}
              title="Install Clinical App"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span>Install</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile Phone Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-tab ${active ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename="/admin">
        <div className="app-layout">
          <Navigation />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/intake" element={<IntakePage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/content" element={<ContentPage />} />
              <Route path="/money" element={<MoneyPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<TodayPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
