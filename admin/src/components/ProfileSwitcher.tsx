import { useState } from 'react';
import { ShieldCheck, User, ChevronUp } from 'lucide-react';

export default function ProfileSwitcher() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<'admin' | 'guest'>('admin');

  return (
    <div style={{ position: 'relative' }}>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          marginBottom: '8px',
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 50,
        }}>
          <div style={{ fontSize: '11px', color: 'var(--mut)', fontWeight: 600, padding: '4px 8px 6px' }}>
            VIEW MODE
          </div>
          <button
            type="button"
            onClick={() => { setRole('admin'); setOpen(false); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: '6px',
              border: 'none',
              background: role === 'admin' ? 'var(--accbg)' : 'transparent',
              color: role === 'admin' ? 'var(--acct)' : 'var(--ink)',
              fontWeight: role === 'admin' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '12.5px',
              textAlign: 'left',
            }}
          >
            <ShieldCheck className="w-4 h-4 text-acc" />
            <span>Practitioner Admin</span>
          </button>
          <button
            type="button"
            onClick={() => { setRole('guest'); setOpen(false); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: '6px',
              border: 'none',
              background: role === 'guest' ? 'var(--accbg)' : 'transparent',
              color: role === 'guest' ? 'var(--acct)' : 'var(--ink)',
              fontWeight: role === 'guest' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '12.5px',
              textAlign: 'left',
              marginTop: '2px',
            }}
          >
            <User className="w-4 h-4 text-mut" />
            <span>Public Guest Preview</span>
          </button>
        </div>
      )}

      {/* Profile Bar Button inside Sidebar Footer */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          background: 'var(--card)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--accbg)',
            color: 'var(--acct)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {role === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Dr. Hana Almaz
            </div>
            <div style={{ fontSize: '11px', color: 'var(--mut)', whiteSpace: 'nowrap' }}>
              {role === 'admin' ? 'Practitioner' : 'Guest View'}
            </div>
          </div>
        </div>
        <ChevronUp className={`w-3.5 h-3.5 text-mut transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}
