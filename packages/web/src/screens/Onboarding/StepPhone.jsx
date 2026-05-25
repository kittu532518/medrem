import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../../api/client.js';

export default function StepPhone({ onNext, data, setData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(data.phone || '');
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fullPhone = `${countryCode}${phone.replace(/^0+/, '')}`;

  const handleSendOtp = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendOTP(fullPhone);
      setOtpSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOTP(fullPhone, otp);
      const { token, user } = res.data;
      localStorage.setItem('medrem_token', token);
      localStorage.setItem('medrem_user', JSON.stringify(user));

      // ── Returning user: skip onboarding, go straight to home ──
      if (!user.isNewUser) {
        navigate('/', { replace: true });
        return;
      }

      // ── New user: continue onboarding ──
      setData(prev => ({ ...prev, phone: fullPhone, userId: user.id, isNewUser: true }));
      onNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '8px' }}>
          {t('onboarding.step2.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>
          {t('onboarding.step2.subtitle')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Phone input with country code */}
        {!otpSent && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={countryCode}
              onChange={e => setCountryCode(e.target.value)}
              style={{
                width: '100px', padding: '12px 8px', border: '2px solid #E8E0D8',
                borderRadius: '12px', fontSize: '16px', background: 'white',
                color: 'var(--color-text)', fontWeight: '600',
              }}
            >
              <option value="+91">🇮🇳 +91</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+61">🇦🇺 +61</option>
              <option value="+971">🇦🇪 +971</option>
              <option value="+65">🇸🇬 +65</option>
            </select>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              style={{ flex: 1 }}
              autoFocus
            />
          </div>
        )}

        {otpSent && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#F9F5F1', borderRadius: '12px', padding: '12px 16px',
          }}>
            <span style={{ fontSize: '20px' }}>📱</span>
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text)' }}>
              {fullPhone}
            </span>
            <button
              onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
            >
              Change
            </button>
          </div>
        )}

        {!otpSent ? (
          <button className="btn-primary" onClick={handleSendOtp} disabled={loading}>
            {loading ? t('common.loading') : t('onboarding.step2.send_otp')}
          </button>
        ) : (
          <>
            <div style={{
              background: '#EAF3DE', borderRadius: '10px', padding: '12px 16px',
              fontSize: '14px', color: 'var(--color-success)', fontWeight: '500',
            }}>
              ✓ OTP sent to {fullPhone}
            </div>

            <input
              type="number"
              value={otp}
              onChange={e => setOtp(e.target.value.slice(0, 6))}
              placeholder="Enter 6-digit OTP"
              autoFocus
              style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '24px', fontWeight: '700' }}
            />

            <button className="btn-primary" onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>

            <button
              onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '14px' }}
            >
              {t('onboarding.step2.resend')}
            </button>
          </>
        )}

        {error && (
          <div style={{ color: 'var(--color-failure)', fontSize: '14px', fontWeight: '500', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{
          background: 'var(--color-pending-bg)', borderRadius: '10px',
          padding: '10px 14px', fontSize: '13px', color: 'var(--color-pending)', textAlign: 'center',
        }}>
          💡 Dev mode: use OTP <strong>123456</strong> for any number
        </div>
      </div>
    </div>
  );
}
