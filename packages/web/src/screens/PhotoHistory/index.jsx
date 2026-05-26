import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API = '/api';

function api(path, opts = {}) {
  const token = localStorage.getItem('medrem_token');
  return fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  });
}

export default function PhotoHistory() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState('last7days');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const loadPhotos = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/doses/history/${dateRange}`);
      setPhotos(data.photos || []);
    } catch (err) {
      setError(err.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [dateRange]);

  const sessionLabels = {
    morning: '🌅 Morning',
    afternoon: '☀️ Afternoon',
    evening: '🌆 Evening',
    night: '🌙 Night',
  };

  const statusConfig = {
    success: { color: '#4A7C59', label: '✓ Verified', bg: '#EAF3DE' },
    partial_success: { color: '#C07C2D', label: '⚠ Manual', bg: '#FFF8F0' },
    pending: { color: '#2D6A9F', label: 'Pending', bg: '#EFF6FF' },
    failure: { color: '#C0392B', label: '✗ Failed', bg: '#FEE2E2' },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FBF7F4' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #EDE5DC',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#7C4A2D',
            fontSize: '16px',
            fontWeight: '600',
          }}
        >
          ← Back
        </button>
        <div>
          <div style={{ fontWeight: '700', fontSize: '16px' }}>📸 Photo History</div>
          <div style={{ fontSize: '12px', color: '#8C7B6B' }}>Review your medication intake photos</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 16px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Date Range Selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[
            { value: 'last7days', label: 'Last 7 Days' },
            { value: 'last30days', label: 'Last 30 Days' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: dateRange === opt.value ? '2px solid #7C4A2D' : '2px solid #EDE5DC',
                background: dateRange === opt.value ? '#FFF0E5' : 'white',
                color: dateRange === opt.value ? '#7C4A2D' : '#8C7B6B',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
            <div style={{ color: '#8C7B6B' }}>Loading photos...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            background: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            padding: '16px',
            color: '#991B1B',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && photos.length === 0 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            border: '1px solid #EDE5DC',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
            <div style={{ fontWeight: '700', fontSize: '17px', marginBottom: '8px' }}>No photos yet</div>
            <div style={{ color: '#8C7B6B', fontSize: '14px' }}>
              Photos from dose verification will appear here
            </div>
          </div>
        )}

        {/* Photos Grid */}
        {!loading && photos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}>
            {photos.map(photo => {
              const config = statusConfig[photo.status];
              return (
                <div
                  key={photo.doseId}
                  onClick={() => setSelectedPhoto(photo)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid #EDE5DC',
                    transition: 'all 0.2s',
                    transform: 'scale(1)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.borderColor = '#7C4A2D';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.borderColor = '#EDE5DC';
                  }}
                >
                  {/* Thumbnail */}
                  {photo.photoPath && (
                    <img
                      src={photo.photoPath}
                      alt="Dose"
                      style={{
                        width: '100%',
                        height: '120px',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  )}

                  {/* Info */}
                  <div style={{
                    padding: '10px',
                    background: config.bg,
                    borderTop: '1px solid #EDE5DC',
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#2D1B0E',
                      marginBottom: '4px',
                    }}>
                      {photo.date}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#8C7B6B',
                      marginBottom: '4px',
                    }}>
                      {sessionLabels[photo.session]}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: config.color,
                      fontWeight: '600',
                    }}>
                      {config.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Photo Detail Modal */}
        {selectedPhoto && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              overflow: 'auto',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '85vh',
            }}>
              {/* Close Button */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '16px',
                borderBottom: '1px solid #EDE5DC',
              }}>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#8C7B6B',
                  }}
                >
                  ×
                </button>
              </div>

              {/* Photo */}
              {selectedPhoto.photoPath && (
                <img
                  src={selectedPhoto.photoPath}
                  alt="Dose"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                  }}
                />
              )}

              {/* Details */}
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#8C7B6B', fontWeight: '600', marginBottom: '4px' }}>
                    MEDICINE
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#2D1B0E' }}>
                    {selectedPhoto.medicine.name}
                  </div>
                  {selectedPhoto.medicine.dosage && (
                    <div style={{ fontSize: '13px', color: '#8C7B6B' }}>
                      {selectedPhoto.medicine.dosage}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#8C7B6B', fontWeight: '600', marginBottom: '4px' }}>
                      DATE
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#2D1B0E' }}>
                      {selectedPhoto.date}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#8C7B6B', fontWeight: '600', marginBottom: '4px' }}>
                      SESSION
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#2D1B0E' }}>
                      {sessionLabels[selectedPhoto.session]}
                    </div>
                  </div>
                </div>

                {selectedPhoto.submittedAt && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#8C7B6B', fontWeight: '600', marginBottom: '4px' }}>
                      SUBMITTED AT
                    </div>
                    <div style={{ fontSize: '14px', color: '#2D1B0E' }}>
                      {new Date(selectedPhoto.submittedAt).toLocaleString('en-IN')}
                    </div>
                  </div>
                )}

                {/* Status */}
                {selectedPhoto.status && (
                  <div style={{
                    background: statusConfig[selectedPhoto.status].bg,
                    border: `2px solid ${statusConfig[selectedPhoto.status].color}`,
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: statusConfig[selectedPhoto.status].color,
                    }}>
                      {statusConfig[selectedPhoto.status].label}
                    </div>
                    {selectedPhoto.status === 'success' && (
                      <div style={{ fontSize: '12px', color: '#4A7C59', marginTop: '4px' }}>
                        AI verified this medication intake
                      </div>
                    )}
                    {selectedPhoto.status === 'partial_success' && (
                      <div style={{ fontSize: '12px', color: '#C07C2D', marginTop: '4px' }}>
                        Manually confirmed by you
                      </div>
                    )}
                    {selectedPhoto.status === 'pending' && (
                      <div style={{ fontSize: '12px', color: '#2D6A9F', marginTop: '4px' }}>
                        Waiting for verification
                      </div>
                    )}
                    {selectedPhoto.status === 'failure' && (
                      <div style={{ fontSize: '12px', color: '#C0392B', marginTop: '4px' }}>
                        Verification failed
                      </div>
                    )}
                  </div>
                )}

                {/* AI Validation Results */}
                {selectedPhoto.validation && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#8C7B6B', fontWeight: '600', marginBottom: '8px' }}>
                      AI VALIDATION DETAILS
                    </div>
                    <div style={{
                      background: '#F5F5F5',
                      borderRadius: '10px',
                      padding: '12px',
                      fontSize: '12px',
                      color: '#555',
                      fontFamily: 'monospace',
                      maxHeight: '200px',
                      overflow: 'auto',
                    }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {typeof selectedPhoto.validation === 'string'
                          ? selectedPhoto.validation
                          : JSON.stringify(selectedPhoto.validation, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
