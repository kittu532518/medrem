import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTodaySchedule } from '../../api/client.js';
import SessionGroup from '../../components/SessionGroup.jsx';

function getGreeting(t) {
  const hour = new Date().getHours();
  if (hour < 12) return t('home.greeting_morning');
  if (hour < 17) return t('home.greeting_afternoon');
  if (hour < 21) return t('home.greeting_evening');
  return t('home.greeting_night');
}

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('medrem_user') || '{}');

  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const res = await getTodaySchedule();
      setSchedule(res.data);
    } catch (err) {
      setError('Failed to load schedule');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
    // Refresh every 2 minutes
    const interval = setInterval(loadSchedule, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute adherence stats
  let stats = { success: 0, partial: 0, failure: 0, pending: 0, total: 0 };
  if (schedule?.sessions) {
    Object.values(schedule.sessions).forEach((doses) => {
      doses.forEach((dose) => {
        stats.total++;
        if (dose.status === 'success') stats.success++;
        else if (dose.status === 'partial_success') stats.partial++;
        else if (dose.status === 'failure') stats.failure++;
        else stats.pending++;
      });
    });
  }

  const verifiedPct = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
  const hasDoses = stats.total > 0;

  return (
    <div style={{ padding: '24px 16px 16px' }}>
      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-text)' }}>
            {getGreeting(t)}{user.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
          </div>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          background: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          color: 'white',
          fontWeight: '700',
        }}>
          {user.name ? user.name[0].toUpperCase() : '?'}
        </div>
      </div>

      {/* Hero adherence card */}
      {hasDoses && (
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #D9956A 100%)', color: 'white', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', opacity: 0.85, marginBottom: '8px' }}>
            {t('home.today_adherence')}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '12px' }}>
            <span style={{ fontSize: '48px', fontWeight: '800', lineHeight: 1 }}>{verifiedPct}</span>
            <span style={{ fontSize: '24px', fontWeight: '600', marginBottom: '6px' }}>%</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '700' }}>{stats.success}</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>{t('home.verified')}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '700' }}>{stats.partial}</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>{t('home.partial')}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '700' }}>{stats.failure}</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>{t('home.missed')}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '700' }}>{stats.pending}</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>Pending</div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
          <div>{t('common.loading')}</div>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ color: 'var(--color-failure)', marginBottom: '12px' }}>{error}</div>
          <button className="btn-primary" onClick={loadSchedule} style={{ maxWidth: '200px' }}>
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <>
          {/* Show medicines if they exist */}
          {hasDoses && (
            Object.entries(schedule.sessions).map(([sessionName, doses]) => (
              <SessionGroup
                key={sessionName}
                sessionName={sessionName}
                doses={doses}
                onRefresh={loadSchedule}
              />
            ))
          )}

          {/* Show "No medicines" card with add prescription option */}
          {!hasDoses && (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💊</div>
              <div style={{ fontWeight: '700', fontSize: '17px', marginBottom: '8px' }}>No medicines today</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                {t('home.no_medicines')}
              </div>
              <button className="btn-primary" onClick={() => navigate('/rx')} style={{ maxWidth: '220px', margin: '0 auto' }}>
                + {t('home.add_prescription')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
