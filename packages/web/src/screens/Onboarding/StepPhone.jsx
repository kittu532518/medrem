import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../../api/client.js';

export default function StepPhone({ onNext, data, setData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [phone, setPhone]           = useState(data.phone || '');
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp]               = useState('');
  const [otpSent, setOtpSent]       = useState(false);
  const [serverOtp, setServerOtp]   = useState('');   // OTP returned by server (until SMS is live)
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const fullPhone = `${countryCode}${phone.replace(/^0+/, '')}`;

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await sendOTP(fullPhone);
      setOtpSent(true);
      // Server returns otp in response until SMS (Twilio) is configured.
      // Auto-populate so users don't have to type it.
      if (res.data?.otp) {
        setServerOtp(res.data.otp);
        setOtp(res.data.otp);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!otp || otp.replace(/\D/g, '').length !== 6) {
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

      if (!user.isNewUser) {
        // Returning user — skip onboarding entirely
        navigate('/', { replace: true });
        return;
      }

      // New user — continue onboarding
      setData(prev => ({ ...prev, phone: fullPhone, userId: user.id, isNewUser: true }));
      onNext();
    } catch (err) {
      // Note: we changed invalid-OTP to return 400, so the global interceptor
      // will NOT redirect to /onboarding — the error is shown inline here.
      setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = () => {
    setOtpSent(false);
    setOtp('');
    setServerOtp('');
    setError('');
  };

  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '8px' }}>
          {t('onboarding.step2.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>
          Enter your mobile number to get started
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Phone input ── */}
        {!otpSent && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={countryCode}
              onChange={e => setCountryCode(e.target.value)}
              style={{
                width: '110px', padding: '12px 8px', border: '2px solid #E8E0D8',
                borderRadius: '12px', fontSize: '15px', background: 'white',
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
              placeholder="10-digit number"
              style={{ flex: 1 }}
              autoFocus
            />
          </div>
        )}

        {/* ── Phone badge (after OTP sent) ── */}
        {otpSent && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#F9F5F1', borderRadius: '12px', padding: '12px 16px',
          }}>
            <span style={{ fontSize: '22px' }}>📱</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text)' }}>
              {fullPhone}
            </span>
            <button
              onClick={handleResend}
              style={{ marginLeft: 'auto', background: 'none', border: 'none',
                color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
            >
              Change
            </button>
          </div>
        )}

        {/* ── Send OTP button ── */}
        {!otpSent && (
          <button className="btn-primary" onClick={handleSendOtp} disabled={loading}>
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        )}

        {/* ── OTP entry ── */}
        {otpSent && (
          <>
            {/* OTP hint banner — shown when server returns OTP directly */}
            {serverOtp ? (
              <div style={{
                background: '#EAF3DE', borderRadius: '12px', padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#4A7C59', marginBottom: '4px' }}>
                    YOUR OTP (auto-filled)
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '0.25em', color: '#2D5C3A' }}>
                    {serverOtp}
                  </div>
                </div>
                <button
                  onClick={() => setOtp(serverOtp)}
                  style={{
                    background: '#4A7C59', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '8px 14px', fontSize: '13px',
                    fontWeight: '700', cursor: 'pointer',
                  }}
                >
                  Use ↓
                </button>
              </div>
            ) : (
              <div style={{
                background: '#EAF3DE', borderRadius: '10px', padding: '12px 16px',
                fontSize: '14px', color: 'var(--color-success)', fontWeight: '500',
              }}>
                ✓ OTP sent to {fullPhone}
              </div>
            )}

            <input
              type="number"
              value={otp}
              onChange={e => setOtp(e.target.value.slice(0, 6))}
              placeholder="6-digit OTP"
              autoFocus
              style={{
                letterSpacing: '0.3em', textAlign: 'center',
                fontSize: '28px', fontWeight: '800',
              }}
            />

            <button className="btn-primary" onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying…' : '✓ Verify & Continue'}
            </button>

            <button
              onClick={handleResend}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)',
                cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
            >
              ↩ Resend OTP
            </button>
          </>
        )}

        {/* ── Error message ── */}
        {error && (
          <div style={{
            background: '#FDECEA', border: '1px solid #F5A0A0',
            borderRadius: '10px', padding: '12px 16px',
            color: 'var(--color-failure)', fontSize: '14px', fontWeight: '500', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* ── Dev hint ── */}
        <div style={{
          background: 'var(--color-pending-bg)', borderRadius: '10px',
          padding: '10px 14px', fontSize: '12px', color: 'var(--color-pending)', textAlign: 'center',
        }}>
          Master OTP <strong>123456</strong> always works · Real OTP shown above
        </div>

      </div>
    </div>
  );
}
