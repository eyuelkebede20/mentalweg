import { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Info, X, Copy, Check } from 'lucide-react';

export interface VersionData {
  version: string;
  gitCommit: string;
  gitCommitFull?: string;
  gitBranch?: string;
  gitCommitDate?: string;
  gitCommitMessage?: string;
  gitAuthor?: string;
  buildTime?: string;
  nodeEnv?: string;
  label?: string;
}

export function useAppVersion() {
  const [versionInfo, setVersionInfo] = useState<VersionData>({
    version: '1.0.0',
    gitCommit: '447a817',
    label: 'v1.0.0 (#447a817)',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/version')
      .then(res => res.json())
      .then(data => {
        if (data && data.version) {
          setVersionInfo(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { versionInfo, loading };
}

export default function VersionBadge({ mode = 'compact' }: { mode?: 'compact' | 'detailed' }) {
  const { versionInfo } = useAppVersion();
  const [openModal, setOpenModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (mode === 'detailed') {
    return (
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginTop: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCommit className="w-5 h-5 text-acc" />
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--ink)' }}>System Version & Git Information</h3>
          </div>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '12px',
            background: 'var(--off)',
            color: 'var(--acc)',
            border: '1px solid var(--line)'
          }}>
            {versionInfo.nodeEnv || 'development'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px' }}>
          <div style={{ background: 'var(--off)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
            <span style={{ fontSize: '11px', color: 'var(--mut)', display: 'block' }}>Application Release</span>
            <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>v{versionInfo.version}</strong>
          </div>

          <div style={{ background: 'var(--off)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
            <span style={{ fontSize: '11px', color: 'var(--mut)', display: 'block' }}>Last Git Commit ID</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
              <code style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acc)' }}>
                #{versionInfo.gitCommit}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(versionInfo.gitCommitFull || versionInfo.gitCommit)}
                title="Copy commit hash"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy SHA'}
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--off)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
            <span style={{ fontSize: '11px', color: 'var(--mut)', display: 'block' }}>Active Branch</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--ink)' }}>
              <GitBranch className="w-3.5 h-3.5 text-mut" /> {versionInfo.gitBranch || 'master'}
            </span>
          </div>

          <div style={{ background: 'var(--off)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
            <span style={{ fontSize: '11px', color: 'var(--mut)', display: 'block' }}>Commit Timestamp</span>
            <span style={{ fontSize: '12px', color: 'var(--ink)' }}>
              {versionInfo.gitCommitDate ? new Date(versionInfo.gitCommitDate).toLocaleString() : 'Recent'}
            </span>
          </div>
        </div>

        {versionInfo.gitCommitMessage && (
          <div style={{ marginTop: '12px', background: 'var(--off)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--mut)', display: 'block', marginBottom: '2px' }}>Latest Commit Message:</span>
            <span style={{ color: 'var(--ink)', fontFamily: 'monospace' }}>{versionInfo.gitCommitMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // Compact sidebar / footer badge
  return (
    <>
      <button
        type="button"
        onClick={() => setOpenModal(true)}
        title="View System & Git Version Info"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'var(--off)',
          border: '1px solid var(--line)',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '11px',
          color: 'var(--mut)',
          cursor: 'pointer',
          marginTop: '8px',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <GitCommit className="w-3.5 h-3.5 text-acc" />
          <span>v{versionInfo.version}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <code style={{ fontSize: '11px', color: 'var(--acc)', fontFamily: 'monospace' }}>#{versionInfo.gitCommit}</code>
        </span>
        <Info className="w-3 h-3 opacity-60" />
      </button>

      {/* Version Details Modal */}
      {openModal && (
        <div className="admin-modal-backdrop" onClick={() => setOpenModal(false)}>
          <div
            className="admin-modal-card"
            onClick={e => e.stopPropagation()}
            style={{ padding: '1.5rem', maxWidth: '440px', width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitCommit className="w-5 h-5 text-acc" />
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--ink)' }}>Version & Git Commit Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--off)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mut)' }}>App Version:</span>
                <strong>v{versionInfo.version}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--off)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mut)' }}>Git Commit ID:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <code style={{ fontWeight: 700, color: 'var(--acc)' }}>#{versionInfo.gitCommit}</code>
                  <button
                    type="button"
                    onClick={() => handleCopy(versionInfo.gitCommitFull || versionInfo.gitCommit)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5 text-mut" />}
                  </button>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--off)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mut)' }}>Branch:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <GitBranch className="w-3.5 h-3.5 text-mut" /> {versionInfo.gitBranch || 'master'}
                </span>
              </div>

              <div style={{ padding: '8px 12px', background: 'var(--off)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mut)', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Last Commit Message:</span>
                <span style={{ color: 'var(--ink)', fontFamily: 'monospace', fontSize: '12px' }}>
                  {versionInfo.gitCommitMessage || 'No message recorded'}
                </span>
              </div>

              {versionInfo.gitAuthor && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--off)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--mut)' }}>Author:</span>
                  <span>{versionInfo.gitAuthor}</span>
                </div>
              )}

              {versionInfo.gitCommitDate && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--off)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--mut)' }}>Commit Date:</span>
                  <span style={{ fontSize: '12px' }}>{new Date(versionInfo.gitCommitDate).toLocaleString()}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpenModal(false)}
              style={{
                width: '100%',
                marginTop: '1.25rem',
                padding: '8px',
                borderRadius: '8px',
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
