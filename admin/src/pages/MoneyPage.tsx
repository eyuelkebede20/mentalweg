import { useState, useEffect } from 'react';
import { 
  Download, 
  CreditCard, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  Search, 
  Filter
} from 'lucide-react';

interface PaymentItem {
  id: number;
  provider: string;
  reference: string;
  amountCents: number;
  method: string;
  paidAt: string;
  clientName: string;
  clientPublicId: string;
}

interface MoneyDashboardData {
  totals: {
    todayCents: number;
    weekCents: number;
    monthCents: number;
    totalCents: number;
    count: number;
  };
  providerBreakdown: Record<string, { totalCents: number; count: number }>;
  dailySeries: Array<{ date: string; amountEtb: number; count: number }>;
  payments: PaymentItem[];
}

export default function MoneyPage() {
  const [data, setData] = useState<MoneyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [useEthiopianDate, setUseEthiopianDate] = useState(false);

  useEffect(() => {
    fetch('/api/admin/money/dashboard')
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // CSV Export
  const handleExportCSV = () => {
    if (!data || !data.payments.length) return;
    const headers = ['Date', 'Client Public ID', 'Client Name', 'Provider', 'Reference', 'Amount (ETB)', 'Method'];
    const rows = data.payments.map(p => [
      new Date(p.paidAt).toISOString().slice(0, 10),
      `"${p.clientPublicId}"`,
      `"${p.clientName}"`,
      p.provider.toUpperCase(),
      `"${p.reference}"`,
      (p.amountCents / 100).toFixed(2),
      p.method
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mentalweg_scheduling_fees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const filteredPayments = (data?.payments || []).filter(p => {
    const matchesProvider = providerFilter === 'all' || p.provider.toLowerCase() === providerFilter.toLowerCase();
    const query = search.toLowerCase();
    const matchesSearch = 
      p.clientName.toLowerCase().includes(query) ||
      p.clientPublicId.toLowerCase().includes(query) ||
      p.reference.toLowerCase().includes(query);
    return matchesProvider && matchesSearch;
  });

  // Calculate highest daily amount for bar chart scaling
  const maxDailyEtb = Math.max(...(data?.dailySeries.map(d => d.amountEtb) || [1]), 100);

  // Format date helper
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (useEthiopianDate) {
      return new Intl.DateTimeFormat('en-u-ca-ethiopic', { day: 'numeric', month: 'short' }).format(d);
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1050px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: '0 0 4px', color: 'var(--ink)' }}>Scheduling Fees & Income</h1>
          <p style={{ margin: 0, color: 'var(--mut)', fontSize: '14px' }}>
            Tracking upfront client booking fees (ETB). Standard session fees are handled outside the app.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setUseEthiopianDate(!useEthiopianDate)}
            style={{
              background: useEthiopianDate ? 'var(--acc)' : 'var(--card)',
              color: useEthiopianDate ? '#fff' : 'var(--ink)',
              border: '1px solid var(--line)',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CalendarIcon className="w-4 h-4" />
            {useEthiopianDate ? 'Ethiopian Calendar' : 'Gregorian'}
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!data || data.payments.length === 0}
            style={{
              background: 'var(--ink)',
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </header>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '1.75rem' }}>
        {/* Today */}
        <div style={{ background: 'var(--card)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#165b38', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            ETB {((data?.totals.todayCents || 0) / 100).toFixed(2)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '6px' }}>
            Today's fees · confirmed bookings
          </div>
        </div>

        {/* 7 Days */}
        <div style={{ background: 'var(--card)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            ETB {((data?.totals.weekCents || 0) / 100).toFixed(2)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '6px' }}>
            Past 7 rolling days
          </div>
        </div>

        {/* This Month */}
        <div style={{ background: 'var(--card)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--acc)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            ETB {((data?.totals.monthCents || 0) / 100).toFixed(2)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '6px' }}>
            This month revenue
          </div>
        </div>

        {/* Lifetime Total */}
        <div style={{ background: 'var(--card)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            ETB {((data?.totals.totalCents || 0) / 100).toFixed(2)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '6px' }}>
            Total collected ({data?.totals.count || 0} scheduling fees)
          </div>
        </div>
      </div>

      {/* Visual Daily Revenue Chart (Last 30 Days) */}
      {data?.dailySeries && data.dailySeries.length > 0 && (
        <section style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp className="w-5 h-5 text-acc" />
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--ink)' }}>Daily Fee Income (Past 30 Days)</h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--mut)' }}>ETB per day</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', paddingTop: '20px', overflowX: 'auto' }}>
            {data.dailySeries.map(day => {
              const heightPct = Math.max((day.amountEtb / maxDailyEtb) * 100, 8);
              return (
                <div 
                  key={day.date} 
                  title={`${day.date}: ETB ${day.amountEtb.toFixed(2)} (${day.count} fees)`}
                  style={{ flex: 1, minWidth: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}
                >
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{
                      width: '70%',
                      height: `${heightPct}%`,
                      background: 'var(--acc)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.2s',
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--mut)', marginTop: '4px', whiteSpace: 'nowrap' }}>
                    {day.date.slice(8)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Provider Breakdown Badges */}
      {data?.providerBreakdown && Object.keys(data.providerBreakdown).length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' }}>
            Payment channels
          </h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(data.providerBreakdown).map(([provider, info]) => (
              <div 
                key={provider} 
                onClick={() => setProviderFilter(providerFilter === provider ? 'all' : provider)}
                style={{
                  background: providerFilter === provider ? 'var(--accbg)' : 'var(--card)',
                  border: `1px solid ${providerFilter === provider ? 'var(--acc)' : 'var(--line)'}`,
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CreditCard className="w-4 h-4 text-acc" />
                <strong style={{ textTransform: 'uppercase' }}>{provider}:</strong>
                <span>ETB {(info.totalCents / 100).toFixed(2)}</span>
                <span style={{ fontSize: '11px', color: 'var(--mut)' }}>({info.count})</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payment Log Table */}
      <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Table Filters Header */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
            <Search className="w-4 h-4" style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--mut)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search by client, ID, or reference..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="admin-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter className="w-4 h-4 text-mut" />
            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              className="admin-select"
              style={{ minWidth: '160px' }}
            >
              <option value="all">All Providers</option>
              <option value="telebirr">Telebirr</option>
              <option value="cbe">CBE Mobile</option>
              <option value="cbebirr">CBE Birr</option>
              <option value="dashen">Dashen Bank</option>
              <option value="abyssinia">Bank of Abyssinia</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--mut)' }}>Loading payment log...</p>
        ) : filteredPayments.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--mut)' }}>
            No payments match your filter.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--off)', borderBottom: '1px solid var(--line)', color: 'var(--mut)' }}>
                <th style={{ padding: '12px 14px' }}>Date</th>
                <th style={{ padding: '12px 14px' }}>Client</th>
                <th style={{ padding: '12px 14px' }}>Amount</th>
                <th style={{ padding: '12px 14px' }}>Provider</th>
                <th style={{ padding: '12px 14px' }}>Reference</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Method</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    {formatDate(p.paidAt)}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <strong>{p.clientName}</strong>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--mut)', fontFamily: 'monospace' }}>
                      {p.clientPublicId}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--acc)' }}>
                    ETB {(p.amountCents / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 14px', textTransform: 'uppercase', fontWeight: 600 }}>
                    {p.provider}
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>
                    <code style={{ background: 'var(--off)', padding: '2px 6px', borderRadius: '4px' }}>
                      {p.reference}
                    </code>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <span style={{
                      background: p.method === 'auto' ? '#e3f7ed' : 'var(--off)',
                      color: p.method === 'auto' ? '#165b38' : 'var(--ink)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {p.method}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
