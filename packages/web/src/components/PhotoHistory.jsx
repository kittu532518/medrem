import React, { useState, useEffect } from 'react';

export default function PhotoHistory() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTodayPhotos();
  }, []);

  const fetchTodayPhotos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('medrem_token');
      const res = await fetch('/api/doses/history/today', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load photos');
      const data = await res.json();
      setPhotos(data.photos || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '16px', color: '#8C7B6B' }}>
        Loading photos...
      </div>
    );
  }

  if (photos.length === 0) {
    return null; // Don't show section if no photos
  }

  const statusColors = {
    success: '#4A7C59',
    partial_success: '#C07C2D',
    pending: '#2D6A9F',
    failure: '#C0392B',
  };

  const sessionEmojis = {
    morning: '🌅',
    afternoon: '☀️',
    evening: '🌆',
    night: '🌙',
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        fontWeight: '700',
        fontSize: '14px',
        color: '#7C4A2D',
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        📸 Today's Photos
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {photos.map((photo) => (
          <div
            key={photo.doseId}
            style={{
              background: 'white',
              border: '1px solid #EDE5DC',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {/* Thumbnail */}
            {photo.photoPath && (
              <img
                src={photo.photoPath}
                alt={`${photo.session} - ${photo.medicine.name}`}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: '1px solid #EDE5DC',
                }}
              />
            )}

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#2D1B0E' }}>
                {sessionEmojis[photo.session]} {photo.session.charAt(0).toUpperCase() + photo.session.slice(1)}
              </div>
              <div style={{ fontSize: '12px', color: '#8C7B6B', marginTop: '2px' }}>
                {photo.medicine.name}
                {photo.medicine.dosage && ` · ${photo.medicine.dosage}`}
              </div>
              {photo.submittedAt && (
                <div style={{ fontSize: '11px', color: '#8C7B6B', marginTop: '2px' }}>
                  {new Date(photo.submittedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>

            {/* Status Badge */}
            <div
              style={{
                background: statusColors[photo.status] + '22',
                color: statusColors[photo.status],
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600',
                textAlign: 'center',
                minWidth: '60px',
              }}
            >
              {photo.status === 'success' && '✓ OK'}
              {photo.status === 'partial_success' && '⚠ Manual'}
              {photo.status === 'pending' && 'Pending'}
              {photo.status === 'failure' && '✗ Failed'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
