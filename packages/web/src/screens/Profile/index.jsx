import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMe, updateMe, subscribePush, sendTestPush, getVapidKey } from '../../api/client.js';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'mr', label: 'मराठी' },
];

export default function Profile() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    getMe().then((res) => {
      setProfile(res.data);
      setEditing(res.data);
    }).catch(console.error);

    // Check push permission
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMe({
        name: editing.name,
        date_of_birth: editing.date_of_birth,
        language: editing.language,
        caregiver_name: editing.caregiver_name,
        caregiver_phone: editing.caregiver_phone,
      });
      if (editing.language) {
        i18n.changeLanguage(editing.language);
        localStorage.setItem('medrem_language', editing.language);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // Update stored user
      const storedUser = JSON.parse(localStorage.getItem('medrem_user') || '{}');
      localStorage.setItem('medrem_user', JSON.stringify({ ...storedUser, name: editing.name, language: editing.language }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Please allow notifications in your browser settings.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidRes = await getVapidKey();
      const vapidKey = vapidRes.data.publicKey;

      if (!vapidKey) {
        alert('Push notifications are not configured on this server yet.');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      await subscribePush(sub.toJSON());
      setPushEnabled(true);
    } catch (err) {
      console.error(err);
      alert('Failed to enable push notifications.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    try {
      await sendTestPush();
      alert('Test notification sent!');
    } catch (err) {
      alert('Failed to send test notification.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('medrem_token');
    localStorage.removeItem('medrem_user');
    navigate('/onboarding', { replace: true });
  };

  if (!profile) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
        <div>{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '20px' }}>{t('profile.title')}</h1>

      {/* Avatar */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '22px',
          background: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          color: 'white',
          fontWeight: '700',
          margin: '0 auto 8px',
        }}>
          {profile.name ? profile.name[0].toUpperCase() : '?'}
        </div>
        <div style={{ fontWeight: '700', fontSize: '17px' }}>{profile.name || 'Anonymous'}</div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{profile.phone}</div>
      </div>

      {/* Fields */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>Personal Info</div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
            {t('profile.name')}
          </label>
          <input
            type="text"
            value={editing.name || ''}
            onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
            placeholder="Your name"
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
            {t('profile.dob')}
          </label>
          <input
            type="date"
            value={editing.date_of_birth ? editing.date_of_birth.split('T')[0] : ''}
            onChange={(e) => setEditing((p) => ({ ...p, date_of_birth: e.target.value }))}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
            {t('profile.language')}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setEditing((p) => ({ ...p, language: lang.code }))}
                style={{
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: editing.language === lang.code ? '2px solid var(--color-primary)' : '1px solid #E8E0D8',
                  background: editing.language === lang.code ? '#FFF0E5' : 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: editing.language === lang.code ? '700' : '400',
                  color: editing.language === lang.code ? 'var(--color-primary)' : 'var(--color-text)',
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Caregiver */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>
          {t('profile.caregiver')}
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
            {t('profile.caregiver_name')}
          </label>
          <input
            type="text"
            value={editing.caregiver_name || ''}
            onChange={(e) => setEditing((p) => ({ ...p, caregiver_name: e.target.value }))}
            placeholder="Caregiver's name"
          />
        </div>

        <div>
          <label style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
            {t('profile.caregiver_phone')}
          </label>
          <input
            type="tel"
            value={editing.caregiver_phone || ''}
            onChange={(e) => setEditing((p) => ({ ...p, caregiver_phone: e.target.value }))}
            placeholder="+91 9876543210"
          />
        </div>
      </div>

      {/* Push notifications */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>
          {t('profile.push_notifications')}
        </div>

        {pushEnabled ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontWeight: '600' }}>
              🔔 {t('profile.push_enabled')}
            </div>
            <button className="btn-secondary" onClick={handleTestPush}>
              {t('profile.test_push')}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleEnablePush} disabled={pushLoading}>
            {pushLoading ? t('common.loading') : `🔔 ${t('profile.enable_push')}`}
          </button>
        )}
      </div>

      {saved && (
        <div style={{
          background: 'var(--color-success-bg)',
          border: '2px solid var(--color-success)',
          borderRadius: '12px',
          padding: '12px',
          textAlign: 'center',
          color: 'var(--color-success)',
          fontWeight: '600',
          marginBottom: '12px',
        }}>
          ✅ {t('profile.saved')}
        </div>
      )}

      <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ marginBottom: '12px' }}>
        {saving ? t('common.loading') : t('profile.save')}
      </button>

      <button
        onClick={handleLogout}
        style={{
          width: '100%',
          padding: '14px',
          background: 'none',
          border: '2px solid var(--color-failure)',
          borderRadius: '12px',
          color: 'var(--color-failure)',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Sign Out
      </button>
    </div>
  );
}
