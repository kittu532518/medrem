import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmPrescription } from '../../api/client.js';

const SESSION_LABELS = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  evening: '🌆 Evening',
  night: '🌙 Night',
};

function MedicineEditor({ medicine, onChange }) {
  const [editing, setEditing] = useState(false);
  const [localMed, setLocalMed] = useState({ ...medicine });

  const SESSIONS = ['morning', 'afternoon', 'evening', 'night'];

  const toggleSession = (s) => {
    const current = localMed.sessions || [];
    const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
    if (next.length > 0) {
      setLocalMed((prev) => ({ ...prev, sessions: next }));
    }
  };

  const handleSave = () => {
    onChange(localMed);
    setEditing(false);
  };

  return (
    <div
      className="card"
      style={{
        marginBottom: '10px',
        border: medicine.needs_review ? '2px solid var(--color-partial)' : '2px solid transparent',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          {editing ? (
            <input
              type="text"
              value={localMed.name}
              onChange={(e) => setLocalMed((p) => ({ ...p, name: e.target.value }))}
              style={{ marginBottom: '8px', fontSize: '15px', fontWeight: '600' }}
            />
          ) : (
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>
              {medicine.needs_review && <span style={{ color: 'var(--color-partial)' }}>⚠️ </span>}
              {medicine.name}
            </div>
          )}
          {editing ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={localMed.dosage || ''}
                onChange={(e) => setLocalMed((p) => ({ ...p, dosage: e.target.value }))}
                placeholder="Dosage"
                style={{ fontSize: '13px' }}
              />
              <input
                type="text"
                value={localMed.form || ''}
                onChange={(e) => setLocalMed((p) => ({ ...p, form: e.target.value }))}
                placeholder="Form (tablet, etc.)"
                style={{ fontSize: '13px' }}
              />
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {[medicine.dosage, medicine.form].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <button
          onClick={() => { if (editing) handleSave(); else setEditing(true); }}
          style={{
            background: editing ? 'var(--color-success)' : '#F5EFE9',
            color: editing ? 'white' : 'var(--color-primary)',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          {editing ? '✓ Save' : '✎ Edit'}
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {(editing ? SESSIONS : (medicine.sessions || [])).map((s) => {
          const isSelected = (localMed.sessions || []).includes(s);
          return (
            <button
              key={s}
              onClick={() => editing && toggleSession(s)}
              style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                border: 'none',
                cursor: editing ? 'pointer' : 'default',
                background: !editing || isSelected ? 'var(--color-primary)' : '#E8E0D8',
                color: !editing || isSelected ? 'white' : 'var(--color-text-muted)',
              }}
            >
              {SESSION_LABELS[s] || s}
            </button>
          );
        })}
      </div>

      {medicine.special_instructions && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          📝 {medicine.special_instructions}
        </div>
      )}

      {medicine.needs_review && (
        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-partial)', fontWeight: '600' }}>
          ⚠️ Needs review — AI confidence was low. Please verify this medicine.
        </div>
      )}
    </div>
  );
}

export default function StepReview({ onNext, data, setData }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const prescriptions = data.prescriptions || [];

  // Flatten all medicines across prescriptions with their prescription_id
  const allPrescriptions = prescriptions.map((rx, rxIdx) => ({
    ...rx,
    medicines: (rx.medicines || []).map((m, mIdx) => ({
      ...m,
      _rxIdx: rxIdx,
      _mIdx: mIdx,
    })),
  }));

  const updateMedicine = (rxIdx, mIdx, newMed) => {
    setData((prev) => {
      const updated = [...(prev.prescriptions || [])];
      updated[rxIdx] = {
        ...updated[rxIdx],
        medicines: updated[rxIdx].medicines.map((m, i) =>
          i === mIdx ? { ...newMed, needs_review: false } : m
        ),
      };
      return { ...prev, prescriptions: updated };
    });
  };

  const hasUnresolvedReviews = allPrescriptions.some((rx) =>
    (rx.medicines || []).some((m) => m.needs_review)
  );

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      for (const rx of allPrescriptions) {
        if (rx.prescription_id && rx.medicines?.length > 0) {
          await confirmPrescription(rx.prescription_id, rx.medicines);
        }
      }
      onNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm medicines. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (prescriptions.length === 0) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <h2 style={{ marginBottom: '12px' }}>No prescriptions to review</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>You can add prescriptions later from the Rx screen.</p>
        <button className="btn-primary" onClick={onNext}>Continue</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '6px' }}>
          {t('onboarding.step5.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
          {t('onboarding.step5.subtitle')}
        </p>
      </div>

      {hasUnresolvedReviews && (
        <div style={{
          background: 'var(--color-partial-bg)',
          border: '2px solid var(--color-partial)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#7a5a15',
          fontWeight: '500',
        }}>
          ⚠️ Some medicines need your review. Please check the ones marked in orange before continuing.
        </div>
      )}

      {allPrescriptions.map((rx, rxIdx) => (
        <div key={rxIdx} style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {rx.type === 'chronic' ? '♾️ Ongoing' : `⏳ ${rx.duration_days}-day`} Prescription
          </div>
          {(rx.medicines || []).map((med, mIdx) => (
            <MedicineEditor
              key={mIdx}
              medicine={med}
              onChange={(newMed) => updateMedicine(rxIdx, mIdx, newMed)}
            />
          ))}
          {(!rx.medicines || rx.medicines.length === 0) && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', textAlign: 'center', padding: '16px' }}>
              No medicines could be extracted from this prescription.
            </div>
          )}
        </div>
      ))}

      {error && (
        <div style={{ color: 'var(--color-failure)', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <button
        className="btn-primary"
        onClick={handleConfirm}
        disabled={loading || hasUnresolvedReviews}
      >
        {loading ? t('common.loading') : t('onboarding.step5.confirm_all')}
      </button>

      {hasUnresolvedReviews && (
        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-partial)', marginTop: '8px' }}>
          Please resolve all ⚠️ items first
        </div>
      )}
    </div>
  );
}
