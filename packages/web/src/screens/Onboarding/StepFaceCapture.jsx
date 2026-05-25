import React, { useState, useRef } from 'react';

export default function StepFaceCapture({ onNext, data, setData }) {
  const [preview, setPreview] = useState(data.facePhotoPreview || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    const url = URL.createObjectURL(file);
    setPreview(url);
    setData(prev => ({ ...prev, facePhotoFile: file, facePhotoPreview: url }));
  };

  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '8px' }}>
          Your Reference Photo
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px', lineHeight: '1.5' }}>
          Take a clear selfie so MedRem can verify it's really you when you submit daily dose photos.
        </p>
      </div>

      {/* Preview */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        {preview ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={preview}
              alt="Your selfie"
              style={{ width: '160px', height: '160px', objectFit: 'cover', borderRadius: '80px', border: '4px solid var(--color-primary)', display: 'block' }}
            />
            <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'var(--color-success)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
              ✓
            </div>
          </div>
        ) : (
          <div style={{ width: '160px', height: '160px', borderRadius: '80px', border: '3px dashed #C8B8A8', background: '#FFF8F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '4px' }}>🤳</div>
            <div style={{ fontSize: '12px', fontWeight: '600' }}>No photo yet</div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div style={{ background: '#F5EFE9', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
        <div style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--color-text)' }}>📸 Tips for a good selfie</div>
        <div>• Face the camera directly in good lighting</div>
        <div>• Keep your face clearly visible, no sunglasses</div>
        <div>• Plain background works best</div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <button
        className={preview ? 'btn-secondary' : 'btn-primary'}
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{ marginBottom: '12px' }}
      >
        🤳 {preview ? 'Retake Selfie' : 'Take Selfie'}
      </button>

      {error && (
        <div style={{ color: 'var(--color-failure)', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {preview && (
        <button className="btn-primary" onClick={onNext} disabled={uploading}>
          {uploading ? 'Saving...' : 'Continue →'}
        </button>
      )}

      <button
        onClick={onNext}
        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '14px', width: '100%', marginTop: '8px' }}
      >
        Skip for now →
      </button>
    </div>
  );
}
