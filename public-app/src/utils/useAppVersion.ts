import { useState, useEffect } from 'react';

export interface VersionData {
  version: string;
  gitCommit: string;
  gitCommitFull?: string;
  gitBranch?: string;
  gitCommitDate?: string;
  label?: string;
}

export function useAppVersion() {
  const [versionInfo, setVersionInfo] = useState<VersionData>({
    version: '1.0.0',
    gitCommit: '447a817',
    label: 'v1.0.0 (#447a817)',
  });

  useEffect(() => {
    fetch('/api/version')
      .then(res => res.json())
      .then(data => {
        if (data && data.version) {
          setVersionInfo(data);
        }
      })
      .catch(() => {});
  }, []);

  return versionInfo;
}
