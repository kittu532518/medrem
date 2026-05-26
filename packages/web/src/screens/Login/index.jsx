import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../../api/client.js';

export default function Login() {
  const navigate = useNavigate();
  const [stage, setStage] = useState('phone'); // 'phone' or 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await sendOTP(phone);
      setGeneratedOtp(response.data.otp);
      setStage('otp');
      setError('');
    } catch (err) {
      // ✅ NEW: Handle specific error cases
      const status = err.response?.status;
      const code = err.response?.data?.code;
      const message = err.response?.data?.message;

      if (status === 404 && code === 'PHONE_NOT_REGISTERED') {
        setError(
          'Phone number not registered. ' +
          'Please complete registration first to create an account.'
        );
      } else if (status === 403 && code === 'ACCOUNT_DISABLED') {
        setError(
          'Your account has been disabled. ' +
          'Please contact support for assistance.'
        );
      } else if (status === 400) {
        setError('Please enter a valid phone number');
      } else {
        setError(message || err.response?.data?.error || 'Failed to send OTP');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('OTP is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await verifyOTP(phone, otp);
      localStorage.setItem('medrem_token', response.data.token);
      localStorage.setItem('medrem_user', JSON.stringify(response.data.user));
      navigate('/', { replace: true });
    } catch (err) {
      // ✅ NEW: Handle specific error cases
      const status = err.response?.status;
      const code = err.response?.data?.code;
      const message = err.response?.data?.message;
      const userId = err.response?.data?.userId;

      if (status === 404 && code === 'USER_NOT_FOUND') {
        setError('User account not found. Please register first.');
      } else if (status === 403 && code === 'ACCOUNT_DISABLED') {
        setError(
          'Your account has been disabled. ' +
          'Please contact support for assistance.'
        );
      } else if (status === 403 && code === 'NO_MEDICINES') {
        // User registered but hasn't added medicines yet
        setError(
          'Please complete your registration first. ' +
          'You need to upload a prescription and add your medicines.'
        );
        // Optional: Redirect to onboarding/prescriptions
        // navigate('/onboarding', { state: { userId } });
      } else if (status === 400) {
        setError('Invalid or expired OTP. Please try again.');
      } else {
        setError(message || err.response?.data?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStage('phone');
    setOtp('');
    setGeneratedOtp('');
    setError('');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 20px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '32px' }}>
            💊
          </div>
          <div style={{ fontWeight: '800', fontSize: '22px', color: 'var(--color-primary)' }}>MedRem</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Smart Medicine Reminder</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {stage === 'phone' ? (
            <>
              <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: 'var(--color-text)' }}>
                Welcome Back
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
                Enter your phone number to continue
              </p>

              <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--color-text)' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #E8E0D8',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div style={{ padding: '12px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '13px', color: '#991B1B' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '12px',
                    background: loading ? '#CCCCCC' : 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>

              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #E8E0D8', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                  New to MedRem?
                </p>
                <button
                  onClick={() => navigate('/onboarding', { replace: true })}
                  style={{
                    padding: '12px',
                    background: 'white',
                    border: '2px solid var(--color-primary)',
                    color: 'var(--color-primary)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Register with New Phone
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: 'var(--color-text)' }}>
                Enter OTP
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
                We've sent an OTP to {phone}
              </p>

              <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--color-text)' }}>
                    One-Time Password
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength="6"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #E8E0D8',
                      borderRadius: '8px',
                      fontSize: '18px',
                      fontWeight: '600',
                      letterSpacing: '4px',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                    disabled={loading}
                  />
                </div>

                {/* Display OTP for testing */}
                <div style={{ padding: '12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', color: '#1E40AF' }}>
                  <strong>Test OTP:</strong> {generatedOtp}
                </div>

                {error && (
                  <div style={{ padding: '12px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '13px', color: '#991B1B' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '12px',
                    background: loading ? '#CCCCCC' : 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>

                <button
                  type="button"
                  onClick={handleBackToPhone}
                  disabled={loading}
                  style={{
                    padding: '12px',
                    background: 'white',
                    border: '1px solid #E8E0D8',
                    color: 'var(--color-text)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Change Phone Number
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
