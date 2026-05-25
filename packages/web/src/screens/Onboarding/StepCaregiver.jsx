import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateMe } from '../../api/client.js';

export default function StepCaregiver({ onNext, data }) {
  const { t } = useTranslation();
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async (skip = false) => {
    setLoading(true);
    setError('');
    try {
      if (!skip && (caregiverName || caregiverPhone)) {
        await updateMe({
          caregiver_name: caregiverName || null,
          caregiver_phone: caregiverPhone || null,
        });
      }
      onNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '8px' }}>
          {t('onboarding.step6.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>
          {t('onboarding.step6.subtitle')}
        </p>
      </div>

      <div style={{
        background: 'var(--color-partial-bg)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
        fontSize: '14px',
        color: '#7a5a15',
      }}>
        🔔 Caregivers receive SMS alerts when you miss 2 or more doses in a row, or when you manually mark a dose without photo verification.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input
          type="text"
          value={caregiverName}
          onChange={(e) => setCaregiverName(e.target.value)}
          placeholder={t('onboarding.step6.name_placeholder')}
        />
        <input
          type="tel"
          value={caregiverPhone}
          onChange={(e) => setCaregiverPhone(e.target.value)}
          placeholder={t('onboarding.step6.phone_placeholder')}
        />

        {error && (
          <div style={{ color: 'var(--color-failure)', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={() => handleFinish(false)}
          disabled={loading}
        >
          {loading ? t('common.loading') : t('onboarding.step6.finish')}
        </button>

        <button
          onClick={() => handleFinish(true)}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '14px' }}
        >
          {t('onboarding.step6.skip')}
        </button>
      </div>
    </div>
  );
}
