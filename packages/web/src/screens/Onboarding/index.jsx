import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StepLanguage from './StepLanguage.jsx';
import StepPhone from './StepPhone.jsx';
import StepProfile from './StepProfile.jsx';
import StepFaceCapture from './StepFaceCapture.jsx';
import StepPrescriptions from './StepPrescriptions.jsx';
import StepReview from './StepReview.jsx';
import StepCaregiver from './StepCaregiver.jsx';

const STEPS = [
  { component: StepLanguage,     title: 'Language' },
  { component: StepPhone,        title: 'Phone' },
  { component: StepProfile,      title: 'Profile' },
  { component: StepFaceCapture,  title: 'Your Photo' },
  { component: StepPrescriptions, title: 'Prescriptions' },
  { component: StepReview,       title: 'Review' },
  { component: StepCaregiver,    title: 'Caregiver' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    language: localStorage.getItem('medrem_language') || 'en',
    prescriptions: [],
  });

  useEffect(() => {
    if (localStorage.getItem('medrem_token')) {
      const user = JSON.parse(localStorage.getItem('medrem_user') || '{}');
      if (user.name) navigate('/', { replace: true });
    }
  }, []);

  const handleNext = async () => {
    // After face capture step, upload the photo if one was chosen
    if (STEPS[step].title === 'Your Photo' && data.facePhotoFile) {
      try {
        const token = localStorage.getItem('medrem_token');
        const formData = new FormData();
        formData.append('file', data.facePhotoFile);
        await fetch('/api/users/face-photo', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } catch (err) {
        console.error('Face photo upload failed (non-fatal):', err);
      }
    }

    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      // Save phone number for login screen, then redirect to login
      if (data.phone) {
        localStorage.setItem('medrem_phone_registered', data.phone);
      }
      // Clear any auth tokens so user must login
      localStorage.removeItem('medrem_token');
      localStorage.removeItem('medrem_user');
      navigate('/login', { replace: true });
    }
  };

  const handleBack = () => { if (step > 0) setStep(s => s - 1); };

  const CurrentStep = STEPS[step].component;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F0E8DF', background: 'white' }}>
        {step > 0 && (
          <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '16px', fontWeight: '600', padding: 0, marginRight: '12px' }}>
            ← Back
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ height: '4px', flex: 1, borderRadius: '2px', background: i <= step ? 'var(--color-primary)' : '#E8E0D8', transition: 'background 0.3s' }} />
            ))}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Step {step + 1} of {STEPS.length} — {STEPS[step].title}
          </div>
        </div>
      </div>

      {step === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0 0' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '32px' }}>
            💊
          </div>
          <div style={{ fontWeight: '800', fontSize: '22px', color: 'var(--color-primary)' }}>MedRem</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Smart Medicine Reminder</div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <CurrentStep onNext={handleNext} data={data} setData={setData} />
      </div>
    </div>
  );
}
