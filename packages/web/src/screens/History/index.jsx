import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAdherenceHistory } from '../../api/client.js';
import CalendarGrid from '../../components/CalendarGrid.jsx';

const STATUS_ICONS = {
  success: '✅',
  partial_success: '⚠️',
  failure: '❌',
  pending: '🕐',
};

const SESSION_LABELS = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  evening: '🌆 Evening',
  night: '🌙 Night',
};

export default function History() {
  const { t } = useTranslation();
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    getAdherenceHistory()
      .then((res) => setHistory(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDaySelect = (date, dayData) => {
    setSelectedDay({ date, data: dayData });
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
        <div>{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>{t('history.title')}</h1>
      <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
        {t('history.last_30')}
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <CalendarGrid days={history?.days || []} onDaySelect={handleDaySelect} />
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="card">
          <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '12px' }}>
            {new Date(selectedDay.date).toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>

          {!selectedDay.data ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{t('history.no_data')}</div>
          ) : (
            <>
              {/* Day summary */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {Object.entries(selectedDay.data.summary).map(([key, val]) =>
                  key !== 'total' && val > 0 ? (
                    <span key={key} className={`badge badge-${key === 'partial_success' ? 'partial' : key}`}>
                      {STATUS_ICONS[key]} {val} {key.replace('_', ' ')}
                    </span>
                  ) : null
                )}
                {selectedDay.data.adherence_pct !== null && (
                  <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)' }}>
                    {selectedDay.data.adherence_pct}% {t('history.adherence')}
                  </span>
                )}
              </div>

              {/* Per session */}
              {Object.entries(selectedDay.data.sessions).map(([session, doses]) =>
                doses.length > 0 ? (
                  <div key={session} style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                      {SESSION_LABELS[session] || session}
                    </div>
                    {doses.map((dose, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 0',
                          borderBottom: i < doses.length - 1 ? '1px solid #F0E8DF' : 'none',
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>{STATUS_ICONS[dose.status]}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{dose.medicine_name}</div>
                          {dose.dosage && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{dose.dosage}</div>}
                        </div>
                        {dose.submitted_at && (
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {new Date(dose.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null
              )}
            </>
          )}
        </div>
      )}

      {!selectedDay && history?.days?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📅</div>
          <div>{t('history.no_data')}</div>
        </div>
      )}
    </div>
  );
}
