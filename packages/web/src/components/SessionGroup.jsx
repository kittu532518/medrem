import React from 'react';
import { useTranslation } from 'react-i18next';
import DoseCard from './DoseCard.jsx';

const SESSION_WINDOWS = {
  morning:   { start: '7:00', end: '10:00', icon: '🌅' },
  afternoon: { start: '12:00', end: '14:00', icon: '☀️' },
  evening:   { start: '17:00', end: '20:00', icon: '🌆' },
  night:     { start: '21:00', end: '23:00', icon: '🌙' },
};

export default function SessionGroup({ sessionName, doses, onRefresh }) {
  const { t } = useTranslation();
  const session = SESSION_WINDOWS[sessionName];

  if (!doses || doses.length === 0) return null;

  const allDone = doses.every((d) => d.status !== 'pending');
  const successCount = doses.filter((d) => d.status === 'success').length;

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{session.icon}</span>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--color-text)' }}>
              {t(`sessions.${sessionName}`)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {session.start} – {session.end}
            </div>
          </div>
        </div>
        {allDone && (
          <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: '600' }}>
            {successCount}/{doses.length} done
          </span>
        )}
      </div>

      {doses.map((dose) => (
        <DoseCard key={dose.dose_id} dose={dose} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
