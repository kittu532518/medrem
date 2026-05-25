import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadPrescription } from '../../api/client.js';

function PrescriptionItem({ rx, onRemove }) {
  const successCount = rx.medicines?.length || 0;
  const reviewCount = rx.medicines?.filter((m) => m.needs_review).length || 0;

  return (
    <div className="card" style={{ marginBottom: '12px', border: '2px solid var(--color-success)', background: '#F5FBF0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>
            {rx.type === 'chronic' ? '♾️ Ongoing Prescription' : `⏳ ${rx.duration_days}-day Prescription`}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {successCount} medicine{successCount !== 1 ? 's' : ''} found
            {reviewCount > 0 && ` · ${reviewCount} need review`}
          </div>
        </div>
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-failure)', fontSize: '20px' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function StepPrescriptions({ onNext, data, setData }) {
  const { t } = useTranslation();
  const [type, setType] = useState('chronic');
  const [durationDays, setDurationDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const prescriptions = data.prescriptions || [];

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      if (type === 'temporary' && durationDays) {
        formData.append('duration_days', durationDays);
      }

      const res = await uploadPrescription(formData);
      const rx = {
        ...res.data,
        type,
        duration_days: type === 'temporary' ? parseInt(durationDays) : null,
      };

      setData((prev) => ({
        ...prev,
        prescriptions: [...(prev.prescriptions || []), rx],
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload prescription. Please try again.');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = (idx) => {
    setData((prev) => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '8px' }}>
          {t('onboarding.step4.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>
          {t('onboarding.step4.subtitle')}
        </p>
      </div>

      {/* Type selector */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {['chronic', 'temporary'].map((t_) => (
          <button
            key={t_}
            onClick={() => setType(t_)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '12px',
              border: type === t_ ? '3px solid var(--color-primary)' : '2px solid #E8E0D8',
              background: type === t_ ? '#FFF0E5' : 'white',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              color: type === t_ ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >
            {t_ === 'chronic' ? t('onboarding.step4.type_chronic') : t('onboarding.step4.type_temporary')}
          </button>
        ))}
      </div>

      {type === 'temporary' && (
        <div style={{ marginBottom: '16px' }}>
          <input
            type="number"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            placeholder={t('onboarding.step4.days_label')}
            min="1"
            max="365"
          />
        </div>
      )}

      {/* Uploaded prescriptions */}
      {prescriptions.map((rx, idx) => (
        <PrescriptionItem key={idx} rx={rx} onRemove={() => handleRemove(idx)} />
      ))}

      {/* Upload button */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px', background: '#FFF0E5' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
          <div style={{ fontWeight: '600', color: 'var(--color-primary)' }}>
            {t('onboarding.step4.uploading')}
          </div>
          <div style={{ marginTop: '12px', height: '4px', background: '#E8D5C4', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: 'var(--color-primary)', borderRadius: '2px', animation: 'pulse 1.5s infinite' }} />
          </div>
        </div>
      ) : (
        <button
          className={prescriptions.length > 0 ? 'btn-secondary' : 'btn-primary'}
          onClick={() => fileRef.current?.click()}
          style={{ marginBottom: '12px' }}
        >
          📷 {prescriptions.length > 0 ? t('onboarding.step4.add_another') : t('onboarding.step4.add_photo')}
        </button>
      )}

      {error && (
        <div style={{ color: 'var(--color-failure)', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {prescriptions.length > 0 && (
        <button className="btn-primary" onClick={onNext}>
          {t('onboarding.step4.continue')} ({prescriptions.length} added)
        </button>
      )}

      {prescriptions.length === 0 && (
        <button
          onClick={onNext}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '14px', width: '100%', marginTop: '8px' }}
        >
          Skip for now →
        </button>
      )}
    </div>
  );
}
