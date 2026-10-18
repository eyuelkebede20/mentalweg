import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '../context/ThemeContext';

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'system', label: 'System', icon: Monitor },
    { mode: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--off)',
        padding: '3px',
        borderRadius: '8px',
        border: '1px solid var(--line)',
        gap: '2px',
      }}
      title={`Theme: ${theme} (currently ${resolvedTheme})`}
      role="radiogroup"
      aria-label="Theme mode"
    >
      {options.map(({ mode, label, icon: Icon }) => {
        const isActive = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setTheme(mode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              padding: compact ? '4px 6px' : '5px 8px',
              borderRadius: '6px',
              border: 'none',
              background: isActive ? 'var(--card)' : 'transparent',
              color: isActive ? 'var(--acc)' : 'var(--mut)',
              fontSize: '11.5px',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
            aria-checked={isActive}
            role="radio"
          >
            <Icon className="w-3.5 h-3.5" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
