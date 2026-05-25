import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
];

export default function StepLanguage({ onNext, data, setData }) {
  const { t, i18n } = useTranslation();
  const selected = data.language || 'en';

  const handleSelect = (code) => {
    setData((prev) => ({ ...prev, language: code }));
    i18n.changeLanguage(code);
    localStorage.setItem('medrem_language', code);
  };

  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '8px' }}>
          {t('onboarding.step1.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>
          {t('onboarding.step1.subtitle')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            style={{
              padding: '16px 12px',
              borderRadius: '14px',
              border: selected === lang.code ? '3px solid var(--color-primary)' : '2px solid #E8E0D8',
              background: selected === lang.code ? '#FFF0E5' : 'white',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '2px' }}>{lang.native}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{lang.label}</div>
          </button>
        ))}
      </div>

      <button className="btn-primary" onClick={onNext}>
        {t('common.next')} →
      </button>
    </div>
  );
}
