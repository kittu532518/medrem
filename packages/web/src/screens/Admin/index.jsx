import React, { useState, useEffect, useCallback } from 'react';
import AdminPhotoGallery from '../../components/AdminPhotoGallery.jsx';

const ADMIN_TOKEN_KEY = 'medrem_admin_token';
const API = '/api/admin';

function api(path, opts = {}) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  return fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  });
}

/* ── palette ── */
const C = {
  primary: '#7C4A2D',
  bg: '#FBF7F4',
  card: '#FFFFFF',
  border: '#EDE5DC',
  text: '#2D1B0E',
  muted: '#8C7B6B',
  success: '#4A7C59',
  danger: '#C0392B',
  warn: '#C07C2D',
  blue: '#2D6A9F',
};

const styles = {
  page: { minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif', color: C.text },
  topbar: { background: C.primary, color: 'white', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' },
  body: { maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' },
  card: { background: C.card, borderRadius: '16px', border: `1px solid ${C.border}`, padding: '20px', marginBottom: '20px' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' },
  statCard: { background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '16px', textAlign: 'center' },
  statNum: { fontSize: '32px', fontWeight: '800', color: C.primary },
  statLabel: { fontSize: '12px', color: C.muted, marginTop: '4px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: C.muted, borderBottom: `2px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' },
  td: { padding: '12px', fontSize: '14px', borderBottom: `1px solid ${C.border}` },
  badge: (color) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: '600', background: color + '22', color }),
  btn: (color = C.primary) => ({ background: color, color: 'white', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }),
  input: { width: '100%', padding: '12px 16px', border: `2px solid ${C.border}`, borderRadius: '12px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' },
  row: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
};

/* ── Login Screen ── */
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      onLogin(data.username);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...styles.card, width: '360px', padding: '40px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px' }}>🏥</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: C.primary, marginTop: '8px' }}>MedRem Admin</div>
          <div style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>SuperAdmin Dashboard</div>
        </div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input style={styles.input} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} autoFocus required />
          <input style={styles.input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div style={{ color: C.danger, fontSize: '13px', textAlign: 'center' }}>{error}</div>}
          <button type="submit" style={{ ...styles.btn(), padding: '14px', fontSize: '16px', borderRadius: '12px' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div style={{ marginTop: '16px', fontSize: '12px', color: C.muted, textAlign: 'center' }}>
          Default: admin / medrem_admin_2024
        </div>
      </div>
    </div>
  );
}

/* ── Stat Cards ── */
function StatsRow({ stats }) {
  const items = [
    { label: 'Total Users',     value: stats.total_users     || 0, color: C.primary },
    { label: 'Active Users',    value: stats.active_users    || 0, color: C.success },
    { label: 'New This Week',   value: stats.new_this_week   || 0, color: C.blue },
    { label: 'Active Medicines',value: stats.active_medicines|| 0, color: C.warn },
    { label: 'Doses Taken',     value: stats.total_doses_taken || 0, color: C.success },
    { label: 'Doses Missed',    value: stats.total_doses_missed|| 0, color: C.danger },
  ];
  return (
    <div style={styles.statGrid}>
      {items.map(it => (
        <div key={it.label} style={styles.statCard}>
          <div style={{ ...styles.statNum, color: it.color }}>{it.value}</div>
          <div style={styles.statLabel}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── User Detail Modal ── */
function UserModal({ userId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/users/${userId}`)
      .then(data => {
        console.log('User detail loaded:', data);
        setDetail(data);
        setError(null);
      })
      .catch(err => {
        console.error('Error loading user detail:', err);
        setError(err.message);
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', fontSize: '18px' }}>Loading…</div>
    </div>
  );

  if (error) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '480px', padding: '28px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>❌</div>
        <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px', color: C.danger }}>Error Loading Patient</div>
        <div style={{ color: C.muted, fontSize: '14px', marginBottom: '24px' }}>{error}</div>
        <button onClick={onClose} style={{ ...C.btn(), width: '100%' }}>Close</button>
      </div>
    </div>
  );

  if (!detail) return null;
  const { user, medicines, recent_logs } = detail;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '720px', maxHeight: '85vh', overflow: 'auto', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: C.primary }}>{user.name || 'Unnamed'}</div>
            <div style={{ color: C.muted, fontSize: '14px', marginTop: '2px' }}>{user.phone} · Joined {user.created_at?.slice(0, 10)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: C.muted }}>×</button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: '700', marginBottom: '8px', color: C.muted, fontSize: '12px', textTransform: 'uppercase' }}>Active Medicines ({medicines.length})</div>
          {medicines.length === 0
            ? <div style={{ color: C.muted, fontSize: '14px' }}>No medicines</div>
            : medicines.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: '14px' }}>
                <span>{m.name} {m.dosage || ''}</span>
                <span style={{ color: C.muted }}>{JSON.parse(m.sessions || '[]').join(', ')}</span>
              </div>
            ))
          }
        </div>

        <div>
          <div style={{ fontWeight: '700', marginBottom: '8px', color: C.muted, fontSize: '12px', textTransform: 'uppercase' }}>Recent Dose Logs</div>
          {recent_logs.length === 0
            ? <div style={{ color: C.muted, fontSize: '14px' }}>No logs yet</div>
            : recent_logs.slice(0, 15).map(log => (
              <div key={log.id} style={{ display: 'flex', gap: '12px', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
                <span style={{ color: C.muted, minWidth: '90px' }}>{log.scheduled_date}</span>
                <span style={{ minWidth: '70px', textTransform: 'capitalize' }}>{log.session}</span>
                <span style={{ minWidth: '140px', color: C.muted }}>{log.medicine_name}</span>
                <span style={styles.badge(log.status === 'success' ? C.success : log.status === 'pending' ? C.warn : C.danger)}>
                  {log.status}
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ── */
function Dashboard({ adminName, onLogout }) {
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [photoGalleryUser, setPhotoGalleryUser] = useState(null);
  const LIMIT = 15;

  const loadStats = useCallback(() => {
    api('/stats').then(setStats).catch(console.error);
  }, []);

  const loadUsers = useCallback(() => {
    setLoading(true);
    api(`/users?search=${encodeURIComponent(search)}&page=${page}&limit=${LIMIT}`)
      .then(d => { setUsers(d.users); setTotal(d.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const toggleDisable = async (user) => {
    const action = user.is_disabled ? 'enable' : 'disable';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${user.name || user.phone}?`)) return;
    try {
      await api(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_disabled: !user.is_disabled }),
      });
      loadUsers(); loadStats();
    } catch (err) { alert(err.message); }
  };

  const deleteUser = async (user) => {
    if (!confirm(`PERMANENTLY delete ${user.name || user.phone} and all their data?\nThis cannot be undone.`)) return;
    try {
      await api(`/users/${user.id}`, { method: 'DELETE' });
      loadUsers(); loadStats();
    } catch (err) { alert(err.message); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={styles.logo}>🏥 MedRem Admin</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', opacity: 0.8 }}>👤 {adminName}</span>
          <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={styles.body}>
        <StatsRow stats={stats} />

        <div style={styles.card}>
          <div style={{ ...styles.row, marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <input
                style={{ ...styles.input, padding: '10px 16px' }}
                placeholder="🔍  Search by name or phone…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <button style={styles.btn()} onClick={loadUsers}>Refresh</button>
          </div>

          {loading
            ? <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>Loading…</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Name', 'Phone', 'Language', 'Medicines', 'Taken', 'Missed', 'Status', 'Joined', 'Actions'].map(h => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && (
                      <tr><td colSpan={9} style={{ ...styles.td, textAlign: 'center', color: C.muted, padding: '40px' }}>No users found</td></tr>
                    )}
                    {users.map(u => (
                      <tr key={u.id} style={{ opacity: u.is_disabled ? 0.5 : 1 }}>
                        <td style={styles.td}>
                          <button onClick={() => setSelectedUser(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', color: C.primary, fontSize: '14px', padding: 0, textAlign: 'left' }}>
                            {u.name || <span style={{ color: C.muted, fontStyle: 'italic' }}>Unnamed</span>}
                          </button>
                        </td>
                        <td style={{ ...styles.td, color: C.muted, fontSize: '13px' }}>{u.phone}</td>
                        <td style={{ ...styles.td, fontSize: '13px' }}>{(u.language || 'en').toUpperCase()}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>{u.medicine_count || 0}</td>
                        <td style={{ ...styles.td, textAlign: 'center', color: C.success, fontWeight: '600' }}>{u.doses_taken || 0}</td>
                        <td style={{ ...styles.td, textAlign: 'center', color: u.doses_missed > 0 ? C.danger : C.muted, fontWeight: '600' }}>{u.doses_missed || 0}</td>
                        <td style={styles.td}>
                          <span style={styles.badge(u.is_disabled ? C.danger : C.success)}>
                            {u.is_disabled ? 'Disabled' : 'Active'}
                          </span>
                        </td>
                        <td style={{ ...styles.td, color: C.muted, fontSize: '12px' }}>{u.created_at?.slice(0, 10)}</td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              style={{ ...styles.btn(C.blue), fontSize: '12px', padding: '5px 10px' }}
                              onClick={() => setPhotoGalleryUser(u)}
                              title="View photos"
                            >
                              📸
                            </button>
                            <button
                              style={{ ...styles.btn(u.is_disabled ? C.success : C.warn), fontSize: '12px', padding: '5px 10px' }}
                              onClick={() => toggleDisable(u)}
                            >
                              {u.is_disabled ? 'Enable' : 'Disable'}
                            </button>
                            <button
                              style={{ ...styles.btn(C.danger), fontSize: '12px', padding: '5px 10px' }}
                              onClick={() => deleteUser(u)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
              <button style={styles.btn()} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
              <span style={{ fontSize: '14px', color: C.muted }}>Page {page} of {totalPages} ({total} users)</span>
              <button style={styles.btn()} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
            </div>
          )}
        </div>
      </div>

      {selectedUser && <UserModal userId={selectedUser} onClose={() => setSelectedUser(null)} />}
      {photoGalleryUser && (
        <AdminPhotoGallery
          userId={photoGalleryUser.id}
          userName={photoGalleryUser.name || photoGalleryUser.phone}
          onClose={() => setPhotoGalleryUser(null)}
        />
      )}
    </div>
  );
}

/* ── Root ── */
export default function Admin() {
  const [adminName, setAdminName] = useState(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) { localStorage.removeItem(ADMIN_TOKEN_KEY); return null; }
      return payload.username;
    } catch { return null; }
  });

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminName(null);
  };

  if (!adminName) return <LoginScreen onLogin={setAdminName} />;
  return <Dashboard adminName={adminName} onLogout={handleLogout} />;
}
