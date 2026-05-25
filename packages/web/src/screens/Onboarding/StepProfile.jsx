import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateMe } from '../../api/client.js';

export default function StepProfile({ onNext, data, setData }) {
  const { t } = useTranslation();
  const [name, setName] = useState(data.name || '');
  const [dob, setDob] = useState(data.dob || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateMe({ name: name.trim(), date_of_birth: dob || null, language: data.language || 'en' });
      setData((prev) => ({ ...prev, name: name.trim(), dob }));
      onNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '8px' }}>
          {t('onboarding.step3.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>
          {t('onboarding.step3.subtitle')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('onboarding.step3.name_placeholder')}
          autoFocus
        />

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--color-text-muted)' }}>
            {t('onboarding.step3.dob_label')} (optional)
          </label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {error && (
          <div style={{ color: 'var(--color-failure)', fontSize: '14px', fontWeight: '500' }}>
            {error}
          </div>
        )}

        <button className="btn-primary" onClick={handleContinue} disabled={loading}>
          {loading ? t('common.loading') : t('onboarding.step3.continue')}
        </button>
      </div>
    </div>
  );
}
