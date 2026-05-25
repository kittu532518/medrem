import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const STATUS_CONFIG = {
  success: {
    icon: '✅',
    labelKey: 'dose.status_success',
    className: 'badge badge-success',
  },
  partial_success: {
    icon: '⚠️',
    labelKey: 'dose.status_partial',
    className: 'badge badge-partial',
  },
  failure: {
    icon: '❌',
    labelKey: 'dose.status_failure',
    className: 'badge badge-failure',
  },
  pending: {
    icon: '🕐',
    labelKey: 'dose.status_pending',
    className: 'badge badge-pending',
  },
};

export default function DoseCard({ dose, onRefresh }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const config = STATUS_CONFIG[dose.status] || STATUS_CONFIG.pending;

  const handleTap = () => {
    if (dose.status === 'pending') {
      navigate(`/capture/${dose.dose_id}`);
    }
  };

  return (
    <div
      className="card"
      onClick={handleTap}
      style={{
        cursor: dose.status === 'pending' ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px',
        border: dose.status === 'pending' ? '2px solid var(--color-primary)' : '2px solid transparent',
        transition: 'border-color 0.2s, transform 0.1s',
        transform: dose.status === 'pending' ? 'scale(1)' : undefined,
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: dose.status === 'pending' ? 'var(--color-primary)' : '#F5EFE9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          flexShrink: 0,
        }}
      >
        {dose.status === 'pending' ? '💊' : config.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '2px', truncate: true }}>
          {dose.medicine_name}
        </div>
        {dose.dosage && (
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {dose.dosage}
            {dose.form ? ` · ${dose.form}` : ''}
          </div>
        )}
        {dose.special_instructions && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
            {dose.special_instructions}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <span className={config.className}>
          {config.icon} {t(config.labelKey)}
        </span>
        {dose.status === 'pending' && (
          <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: '600' }}>
            {t('dose.take_now')} →
          </span>
        )}
      </div>
    </div>
  );
}
