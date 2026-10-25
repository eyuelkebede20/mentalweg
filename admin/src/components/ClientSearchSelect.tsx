import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, UserPlus, Phone, Mail } from 'lucide-react';

export interface ClientItem {
  id: number;
  displayName: string;
  phoneE164: string;
  email?: string;
  isVerified?: boolean;
}

interface ClientSearchSelectProps {
  clients: ClientItem[];
  value: number | '';
  onChange: (id: number | '') => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  onSwitchToNewClient?: (prefillName: string) => void;
}

export function ClientSearchSelect({
  clients,
  value,
  onChange,
  label = 'Select Client *',
  placeholder = 'Search by name, phone (+251...), or email...',
  required = false,
  onSwitchToNewClient,
}: ClientSearchSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find currently selected client
  const selectedClient = useMemo(() => {
    if (!value) return null;
    return clients.find(c => c.id === Number(value)) || null;
  }, [clients, value]);

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(c => {
      const nameMatch = c.displayName && c.displayName.toLowerCase().includes(q);
      const phoneMatch = c.phoneE164 && c.phoneE164.toLowerCase().includes(q);
      const emailMatch = c.email && c.email.toLowerCase().includes(q);
      return nameMatch || phoneMatch || emailMatch;
    });
  }, [clients, searchQuery]);

  // Reset highlight index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredClients]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredClients.length ? prev + 1 : 0));
      scrollHighlightedIntoView(highlightedIndex + 1 < filteredClients.length ? highlightedIndex + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredClients.length - 1));
      scrollHighlightedIntoView(prev => (prev - 1 >= 0 ? prev - 1 : filteredClients.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredClients.length > 0 && filteredClients[highlightedIndex]) {
        handleSelect(filteredClients[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const scrollHighlightedIntoView = (index: number | ((prev: number) => number)) => {
    setTimeout(() => {
      if (!listRef.current) return;
      const targetIndex = typeof index === 'function' ? index(highlightedIndex) : index;
      const item = listRef.current.children[targetIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }, 10);
  };

  const handleSelect = (client: ClientItem) => {
    onChange(client.id);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const getInitials = (name: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="admin-form-group" ref={containerRef} style={{ position: 'relative' }}>
      {label && <label className="admin-label">{label}</label>}

      {selectedClient ? (
        /* Selected Client Card Display */
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--card-elevated)',
            border: '1.5px solid var(--acc)',
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(36, 87, 74, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'var(--accbg)',
                color: 'var(--acct)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                flexShrink: 0,
              }}
            >
              {getInitials(selectedClient.displayName)}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '14px' }}>
                  {selectedClient.displayName}
                </span>
                {selectedClient.isVerified && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'var(--success-bg)',
                      color: 'var(--success)',
                      padding: '2px 7px',
                      borderRadius: '9999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    ★ Verified
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '12.5px',
                  color: 'var(--mut)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '2px',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Phone className="w-3 h-3" />
                  {selectedClient.phoneE164}
                </span>
                {selectedClient.email && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Mail className="w-3 h-3" />
                    {selectedClient.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'var(--line-subtle)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            title="Search and select a different client"
          >
            Change
          </button>
        </div>
      ) : (
        /* Search Box Input */
        <div style={{ position: 'relative' }}>
          <Search
            className="w-4 h-4"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--mut)',
              pointerEvents: 'none',
            }}
          />

          <input
            ref={inputRef}
            type="text"
            className="admin-input"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            required={required && !value}
            style={{
              paddingLeft: '38px',
              paddingRight: searchQuery ? '36px' : '12px',
              height: '42px',
              borderRadius: '9px',
            }}
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--mut)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Results Dropdown */}
          {isOpen && (
            <div
              ref={listRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'var(--card-elevated)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.15), 0 3px 8px rgba(0, 0, 0, 0.08)',
                maxHeight: '260px',
                overflowY: 'auto',
                zIndex: 1000,
                boxSizing: 'border-box',
              }}
            >
              {filteredClients.length > 0 ? (
                filteredClients.map((client, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <div
                      key={client.id}
                      onClick={() => handleSelect(client)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isHighlighted ? 'var(--accbg)' : 'transparent',
                        borderBottom: idx < filteredClients.length - 1 ? '1px solid var(--line-subtle)' : 'none',
                        transition: 'background 0.1s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isHighlighted ? 'var(--card)' : 'var(--line-subtle)',
                            color: isHighlighted ? 'var(--acc)' : 'var(--ink)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '11px',
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(client.displayName)}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '13.5px' }}>
                              {client.displayName}
                            </span>
                            {client.isVerified && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  background: 'var(--success-bg)',
                                  color: 'var(--success)',
                                  padding: '1px 6px',
                                  borderRadius: '9999px',
                                }}
                              >
                                Verified
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--mut)',
                              marginTop: '2px',
                              display: 'flex',
                              gap: '8px',
                            }}
                          >
                            <span>{client.phoneE164}</span>
                            {client.email && <span>• {client.email}</span>}
                          </div>
                        </div>
                      </div>

                      {isHighlighted && (
                        <Check className="w-4 h-4" style={{ color: 'var(--acc)', flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })
              ) : (
                /* No Results State */
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--mut)' }}>
                    No clients found matching <strong>"{searchQuery}"</strong>
                  </p>
                  {onSwitchToNewClient && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onSwitchToNewClient(searchQuery);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--acc)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add as New Client
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
