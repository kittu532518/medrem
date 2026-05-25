import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPrescriptions, uploadPrescription, confirmPrescription,
  updateMedicine, deletePrescription,
} from '../../api/client.js';

const SESSION_LABELS = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  evening: '🌆 Evening',
  night: '🌙 Night',
};
const ALL_SESSIONS = ['morning', 'afternoon', 'evening', 'night'];

function DaysLeft({ expiresAt }) {
  if (!expiresAt) return null;
  const diff = Math.ceil((new Date(expiresAt) - new Date()) / 86400000);
  if (diff < 0) return <span className="badge badge-failure">Expired</span>;
  if (diff === 0) return <span className="badge badge-partial">Expires today</span>;
  return <span className="badge badge-pending">{diff} days left</span>;
}

// ── Inline medicine review / manual entry panel ────────────────────────────
function MedicineReviewPanel({ prescriptionId, initialMedicines, onDone, onCancel }) {
  const blank = () => ({ _id: Math.random(), name: '', dosage: '', form: '', sessions: ['morning'] });
  const [medicines, setMedicines] = useState(
    initialMedicines.length > 0
      ? initialMedicines.map(m => ({ ...m, _id: Math.random() }))
      : [blank()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateField = (idx, field, val) =>
    setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));

  const toggleSession = (idx, s) => {
    const current = medicines[idx].sessions || [];
    const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
    if (next.length > 0) updateField(idx, 'sessions', next);
  };

  const handleSave = async () => {
    const valid = medicines.filter(m => m.name?.trim());
    if (!valid.length) { setError('Add at least one medicine name.'); return; }
    setSaving(true);
    setError('');
    try {
      await confirmPrescription(prescriptionId, valid.map(m => ({
        name: m.name.trim(),
        dosage: m.dosage || null,
        form: m.form || null,
        sessions: m.sessions?.length ? m.sessions : ['morning'],
        needs_review: false,
      })));
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save medicines.');
      setSaving(false);
    }
  };

  return (
    <div style={{ background: '#FFF8F2', border: '2px solid var(--color-primary)', borderRadius: '14px', padding: '16px', marginTop: '12px' }}>
      <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px', color: 'var(--color-primary)' }}>
        💊 Review &amp; Confirm Medicines
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
        {initialMedicines.length > 0
          ? 'AI detected these medicines — verify and edit if needed.'
          : 'No medicines detected automatically. Add them manually below.'}
      </div>

      {medicines.map((med, idx) => (
        <div key={med._id} style={{ background: 'white', borderRadius: '10px', padding: '12px', marginBottom: '10px', border: '1px solid #F0E8DF' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={med.name || ''}
                onChange={e => updateField(idx, 'name', e.target.value)}
                placeholder="Medicine name *"
                style={{ marginBottom: '6px', fontWeight: '600' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={med.dosage || ''}
                  onChange={e => updateField(idx, 'dosage', e.target.value)}
                  placeholder="Dosage (e.g. 500mg)"
                  style={{ flex: 1, fontSize: '13px' }}
                />
                <input
                  type="text"
                  value={med.form || ''}
                  onChange={e => updateField(idx, 'form', e.target.value)}
                  placeholder="Form (tablet…)"
                  style={{ flex: 1, fontSize: '13px' }}
                />
              </div>
            </div>
            {medicines.length > 1 && (
              <button
                onClick={() => setMedicines(prev => prev.filter((_, i) => i !== idx))}
                style={{ background: '#FCEBEB', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--color-failure)', fontWeight: '700', fontSize: '16px', alignSelf: 'flex-start' }}
              >✕</button>
            )}
          </div>

          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '6px' }}>WHEN TO TAKE</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ALL_SESSIONS.map(s => {
              const on = (med.sessions || []).includes(s);
              return (
                <button key={s} onClick={() => toggleSession(idx, s)} style={{
                  padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                  border: 'none', cursor: 'pointer',
                  background: on ? 'var(--color-primary)' : '#E8E0D8',
                  color: on ? 'white' : 'var(--color-text-muted)',
                }}>
                  {SESSION_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={() => setMedicines(prev => [...prev, blank()])}
        style={{ background: 'none', border: '2px dashed #C8B8A8', borderRadius: '10px', padding: '10px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: '600', width: '100%', marginBottom: '12px' }}
      >
        + Add another medicine
      </button>

      {error && <div style={{ color: 'var(--color-failure)', fontSize: '13px', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #E8E0D8', background: 'white', cursor: 'pointer', fontWeight: '600', color: 'var(--color-text-muted)', fontSize: '14px' }}
        >
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
          {saving ? '⏳ Saving...' : `✓ Save ${medicines.filter(m => m.name?.trim()).length} Medicine(s)`}
        </button>
      </div>
    </div>
  );
}

// ── Single prescription card ───────────────────────────────────────────────
function PrescriptionCard({ rx, onDeleted, onUpdated }) {
  const [showEditor, setShowEditor] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete this ${rx.type} prescription and all its medicines? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deletePrescription(rx.id);
      onDeleted(rx.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
      setDeleting(false);
    }
  };

  const handleToggle = async (med) => {
    try {
      await updateMedicine(med.id, { is_active: !med.is_active });
      onUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: '700', fontSize: '15px' }}>
              {rx.type === 'chronic' ? '♾️ Ongoing' : '⏳ Temporary'}
            </span>
            {rx.is_active
              ? <span className="badge badge-success">Active</span>
              : <span className="badge badge-failure">Inactive</span>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Added {new Date(rx.created_at).toLocaleDateString('en-IN')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rx.expires_at && <DaysLeft expiresAt={rx.expires_at} />}
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete prescription"
            style={{ background: '#FCEBEB', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--color-failure)', fontWeight: '700', fontSize: '15px' }}
          >
            🗑
          </button>
        </div>
      </div>

      {/* Medicine list */}
      {rx.medicines && rx.medicines.length > 0 ? (
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            {rx.medicines.length} Medicine{rx.medicines.length !== 1 ? 's' : ''}
          </div>
          {rx.medicines.map(med => (
            <div key={med.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F5EFE9', opacity: med.is_active ? 1 : 0.5 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{med.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {[med.dosage, med.form].filter(Boolean).join(' · ')}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {(med.sessions || []).map(s => (
                    <span key={s} style={{ fontSize: '11px', background: 'var(--color-primary)', color: 'white', borderRadius: '10px', padding: '2px 8px', fontWeight: '600' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleToggle(med)}
                style={{ background: med.is_active ? '#FCEBEB' : '#EAF3DE', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: med.is_active ? 'var(--color-failure)' : 'var(--color-success)', whiteSpace: 'nowrap' }}
              >
                {med.is_active ? 'Disable' : 'Enable'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', padding: '4px 0 8px', fontStyle: 'italic' }}>
          No medicines saved yet.
        </div>
      )}

      {/* Edit / Add button */}
      {!showEditor && (
        <button
          onClick={() => setShowEditor(true)}
          style={{ marginTop: '10px', background: 'none', border: '2px dashed #C8B8A8', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: '600', width: '100%' }}
        >
          {rx.medicines?.length > 0 ? '✎ Edit medicines' : '+ Add medicines manually'}
        </button>
      )}

      {showEditor && (
        <MedicineReviewPanel
          prescriptionId={rx.id}
          initialMedicines={rx.medicines || []}
          onDone={() => { setShowEditor(false); onUpdated(); }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}

// ── Main Rx screen ─────────────────────────────────────────────────────────
export default function Rx() {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('chronic');
  const [uploadDays, setUploadDays] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [pendingReview, setPendingReview] = useState(null);

  const load = async () => {
    try {
      const res = await getPrescriptions();
      setPrescriptions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadType);
      if (uploadType === 'temporary' && uploadDays) formData.append('duration_days', uploadDays);

      const res = await uploadPrescription(formData);
      const rx = res.data;
      // Always show the review panel — even if OCR returned 0 medicines
      setPendingReview({ prescription_id: rx.prescription_id, medicines: rx.medicines || [], ocr_error: rx.ocr_error });
      setShowUploadForm(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
      <div>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ padding: '24px 16px' }}>
      {/* Title bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>{t('rx.title')}</h1>
        <button
          onClick={() => { setShowUploadForm(f => !f); setPendingReview(null); }}
          style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
        >
          + {t('rx.add')}
        </button>
      </div>

      {/* Upload form */}
      {showUploadForm && (
        <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--color-primary)' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '12px' }}>New Prescription</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {['chronic', 'temporary'].map(type => (
              <button key={type} onClick={() => setUploadType(type)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: uploadType === type ? '2px solid var(--color-primary)' : '2px solid #E8E0D8', background: uploadType === type ? '#FFF0E5' : 'white', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: uploadType === type ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                {type === 'chronic' ? '♾️ Ongoing' : '⏳ Temporary'}
              </button>
            ))}
          </div>
          {uploadType === 'temporary' && (
            <input type="number" value={uploadDays} onChange={e => setUploadDays(e.target.value)} placeholder="Number of days" style={{ marginBottom: '12px' }} min="1" max="365" />
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} />
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '⏳ Reading prescription...' : '📷 Take Photo / Upload'}
          </button>
        </div>
      )}

      {/* Post-upload medicine review */}
      {pendingReview && (
        <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--color-primary)', background: '#FFF8F2' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>📋 Prescription Uploaded</div>
          {pendingReview.ocr_error ? (
            <div style={{ fontSize: '13px', color: '#856404', background: '#FFF3CD', padding: '8px 10px', borderRadius: '8px', marginBottom: '4px' }}>
              ⚠️ AI could not read the prescription automatically. Please enter the medicines manually below.
            </div>
          ) : pendingReview.medicines.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              No medicines were detected. Please add them below.
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--color-success)', fontWeight: '600', marginBottom: '4px' }}>
              ✅ {pendingReview.medicines.length} medicine(s) detected — please verify:
            </div>
          )}
          <MedicineReviewPanel
            prescriptionId={pendingReview.prescription_id}
            initialMedicines={pendingReview.medicines}
            onDone={() => { setPendingReview(null); load(); }}
            onCancel={() => setPendingReview(null)}
          />
        </div>
      )}

      {/* Prescription list */}
      {prescriptions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <div style={{ fontWeight: '700', fontSize: '17px', marginBottom: '8px' }}>No prescriptions yet</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Tap <strong>+ Add Prescription</strong> to get started
          </div>
        </div>
      ) : (
        prescriptions.map(rx => (
          <PrescriptionCard
            key={rx.id}
            rx={rx}
            onDeleted={id => setPrescriptions(prev => prev.filter(p => p.id !== id))}
            onUpdated={load}
          />
        ))
      )}
    </div>
  );
}
