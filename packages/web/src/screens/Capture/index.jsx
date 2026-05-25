import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { submitDosePhoto, partialOverride, getTodaySchedule } from '../../api/client.js';
import ValidationResult from '../../components/ValidationResult.jsx';

const MAX_ATTEMPTS = 3;

export default function Capture() {
  const { doseId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileRef = useRef(null);

  const [doseInfo, setDoseInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load dose info from today's schedule
  useEffect(() => {
    getTodaySchedule().then((res) => {
      const { sessions } = res.data;
      for (const doses of Object.values(sessions)) {
        const found = doses.find((d) => d.dose_id === doseId);
        if (found) {
          setDoseInfo(found);
          break;
        }
      }
    }).catch(console.error);
  }, [doseId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    handleSubmit(file);
  };

  const handleSubmit = async (file) => {
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await submitDosePhoto(doseId, formData);
      setResult(res.data);
      setAttempts((a) => a + 1);

      if (res.data.accepted) {
        // Success — go home after 2s
        setTimeout(() => navigate('/'), 2000);
      }
    } catch (err) {
      setResult({
        accepted: false,
        message: err.response?.data?.error || 'Upload failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetake = () => {
    setResult(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    fileRef.current?.click();
  };

  const handleOverride = async () => {
    setOverrideLoading(true);
    try {
      await partialOverride(doseId, 'Patient manually confirmed without photo');
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setOverrideLoading(false);
      setShowOverrideConfirm(false);
    }
  };

  const attemptsLeft = MAX_ATTEMPTS - attempts;
  const sessionLabels = {
    morning: '🌅 Morning',
    afternoon: '☀️ Afternoon',
    evening: '🌆 Evening',
    night: '🌙 Night',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        background: 'white',
        borderBottom: '1px solid #F0E8DF',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '16px', fontWeight: '600', marginRight: '12px' }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '16px' }}>{t('capture.title')}</div>
          {doseInfo && (
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {doseInfo.medicine_name} · {sessionLabels[doseInfo.session]}
            </div>
          )}
        </div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      <div style={{ padding: '20px 16px', flex: 1 }}>
        {/* Camera guide */}
        {!result && !loading && (
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#1a1a1a',
                aspectRatio: '4/3',
                position: 'relative',
                display: 'flex',
              }}
            >
              {preview ? (
                <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  {/* Split frame guide */}
                  <div style={{
                    flex: 1,
                    border: '2px dashed rgba(255,255,255,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '13px',
                    fontWeight: '600',
                    gap: '6px',
                  }}>
                    <span style={{ fontSize: '28px' }}>😊</span>
                    <span>{t('capture.guide_face')}</span>
                  </div>
                  <div style={{ width: '2px', background: 'rgba(255,255,255,0.2)' }} />
                  <div style={{
                    flex: 1,
                    border: '2px dashed rgba(255,255,255,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '13px',
                    fontWeight: '600',
                    gap: '6px',
                  }}>
                    <span style={{ fontSize: '28px' }}>💊</span>
                    <span>{t('capture.guide_medicine')}</span>
                  </div>
                </>
              )}
            </div>
            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '10px' }}>
              {t('capture.guide_hint')}
            </div>
          </div>
        )}

        {/* Medicine info */}
        {doseInfo && (
          <div className="card" style={{ marginBottom: '16px', background: '#FFF5EB' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Medicine to verify:</div>
            <div style={{ fontWeight: '700', fontSize: '16px' }}>{doseInfo.medicine_name}</div>
            {doseInfo.dosage && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{doseInfo.dosage}</div>}
            {doseInfo.special_instructions && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                {doseInfo.special_instructions}
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: '16px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🤖</div>
            <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '6px' }}>
              {t('capture.uploading')}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Checking face and medicine...
            </div>
            <div style={{ marginTop: '16px', height: '4px', background: '#E8D5C4', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', background: 'var(--color-primary)', borderRadius: '2px' }} />
            </div>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div style={{ marginBottom: '16px' }}>
            <ValidationResult
              result={result}
              onRetake={attemptsLeft > 0 ? handleRetake : null}
              onOverride={() => setShowOverrideConfirm(true)}
              attemptsLeft={attemptsLeft}
            />
          </div>
        )}

        {/* Capture button */}
        {!result && !loading && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              className="btn-primary"
              onClick={() => fileRef.current?.click()}
              style={{ fontSize: '18px', padding: '18px' }}
            >
              📷 {t('capture.capture_btn')}
            </button>
          </>
        )}

        {/* Attempts counter */}
        {attempts > 0 && !result?.accepted && (
          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            {attemptsLeft} {t('capture.attempts_left')}
          </div>
        )}
      </div>

      {/* Partial override confirmation modal */}
      {showOverrideConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 200,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px 20px 0 0',
            padding: '24px',
            width: '100%',
            maxWidth: '480px',
          }}>
            <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px' }}>
              {t('capture.partial_confirm_title')}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              {t('capture.partial_confirm_body')}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-secondary"
                onClick={() => setShowOverrideConfirm(false)}
                style={{ flex: 1 }}
              >
                {t('capture.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleOverride}
                disabled={overrideLoading}
                style={{ flex: 1, background: 'var(--color-partial)' }}
              >
                {overrideLoading ? t('common.loading') : t('capture.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
