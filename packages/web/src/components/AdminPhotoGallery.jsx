import React, { useState } from 'react';

export default function AdminPhotoGallery({ userId, userName, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last7days');
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  React.useEffect(() => {
    loadPhotos();
  }, [userId, dateRange]);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('medrem_admin_token');
      const res = await fetch(`/api/admin/users/${userId}/photos?dateRange=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load photos');
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (err) {
      console.error('Error loading photos:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusBg = {
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
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px 20px 0 0',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '28px 20px 20px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#2D1B0E' }}>
              📸 Photo History
            </div>
            <div style={{ fontSize: '13px', color: '#8C7B6B', marginTop: '2px' }}>
              {userName}
            </div>
          </div>
          <button
            onClick={onClose}
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

        {/* Date Range Filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {['today', 'last7days', 'last30days'].map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: dateRange === range ? '2px solid #7C4A2D' : '1px solid #EDE5DC',
                background: dateRange === range ? '#FFF5EB' : 'white',
                color: '#2D1B0E',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {range === 'today' && 'Today'}
              {range === 'last7days' && 'Last 7 Days'}
              {range === 'last30days' && 'Last 30 Days'}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8C7B6B' }}>
            Loading photos...
          </div>
        )}

        {/* Photos Grid */}
        {!loading && photos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8C7B6B' }}>
            No photos found
          </div>
        )}

        {!loading && photos.length > 0 && (
          <>
            <div style={{ fontSize: '12px', color: '#8C7B6B', marginBottom: '12px' }}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '10px',
            }}>
              {photos.map(photo => (
                <div
                  key={photo.doseId}
                  onClick={() => setSelectedPhoto(photo)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid #EDE5DC',
                    position: 'relative',
                  }}
                >
                  {/* Thumbnail */}
                  <img
                    src={photo.photoPath}
                    alt={`${photo.session} - ${photo.medicine.name}`}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />

                  {/* Overlay */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '8px',
                    color: 'white',
                    fontSize: '12px',
                  }}>
                    <div style={{ fontWeight: '600' }}>
                      {sessionEmojis[photo.session]} {photo.session}
                    </div>
                    <div
                      style={{
                        background: statusBg[photo.status],
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '600',
                        alignSelf: 'flex-start',
                      }}
                    >
                      {photo.status === 'success' && '✓ OK'}
                      {photo.status === 'partial_success' && '⚠ Manual'}
                      {photo.status === 'pending' && 'Pending'}
                      {photo.status === 'failure' && '✗ Failed'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Photo Detail Modal */}
        {selectedPhoto && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '16px',
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
            }}>
              <div style={{ position: 'relative' }}>
                <img
                  src={selectedPhoto.photoPath}
                  alt="Photo detail"
                  style={{
                    width: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                <button
                  onClick={() => setSelectedPhoto(null)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    fontSize: '18px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#8C7B6B', fontWeight: '600' }}>DATE & TIME</div>
                  <div style={{ fontSize: '14px', color: '#2D1B0E', marginTop: '4px' }}>
                    {new Date(selectedPhoto.date).toLocaleDateString()} · {new Date(selectedPhoto.submittedAt).toLocaleTimeString()}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#8C7B6B', fontWeight: '600' }}>MEDICINE</div>
                  <div style={{ fontSize: '14px', color: '#2D1B0E', marginTop: '4px' }}>
                    {selectedPhoto.medicine.name}
                    {selectedPhoto.medicine.dosage && ` · ${selectedPhoto.medicine.dosage}`}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#8C7B6B', fontWeight: '600' }}>SESSION</div>
                  <div style={{ fontSize: '14px', color: '#2D1B0E', marginTop: '4px' }}>
                    {sessionEmojis[selectedPhoto.session]} {selectedPhoto.session.charAt(0).toUpperCase() + selectedPhoto.session.slice(1)}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#8C7B6B', fontWeight: '600' }}>STATUS</div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: statusBg[selectedPhoto.status],
                      marginTop: '4px',
                      fontWeight: '600',
                    }}
                  >
                    {selectedPhoto.status === 'success' && '✓ Successfully Verified'}
                    {selectedPhoto.status === 'partial_success' && '⚠ Manually Confirmed'}
                    {selectedPhoto.status === 'pending' && 'Pending Verification'}
                    {selectedPhoto.status === 'failure' && '✗ Verification Failed'}
                  </div>
                </div>

                {selectedPhoto.validation && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: '#FFF5EB',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#7C4A2D' }}>AI VALIDATION</div>
                    <div style={{ color: '#5D4C42', lineHeight: '1.5' }}>
                      {selectedPhoto.validation.reason || selectedPhoto.validation.message || 'Validation details not available'}
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
