import React from 'react';

export default function ValidationResult({ result, onRetake, onOverride, attemptsLeft }) {
  if (!result) return null;

  const { accepted, validation, message, action } = result;

  if (accepted) {
    return (
      <div
        style={{
          background: 'var(--color-success-bg)',
          border: '2px solid var(--color-success)',
          borderRadius: '14px',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
        <div style={{ fontWeight: '700', fontSize: '18px', color: 'var(--color-success)', marginBottom: '4px' }}>
          Dose Verified!
        </div>
        <div style={{ fontSize: '14px', color: '#4a7a1a' }}>{message}</div>
        {validation && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#4a7a1a', background: 'rgba(99, 153, 34, 0.1)', borderRadius: '8px', padding: '8px' }}>
            Confidence: {Math.round((validation.confidence || 0) * 100)}%
          </div>
        )}
      </div>
    );
  }

  const isWrongDay = action === 'reject_wrong_day';
  const isSessionExpired = action === 'reject';
  const isAssignedNext = action === 'assign_to_next';
  const isAIFail = action === 'accept' || !action;

  return (
    <div>
      <div
        style={{
          background: isAssignedNext ? 'var(--color-partial-bg)' : 'var(--color-failure-bg)',
          border: `2px solid ${isAssignedNext ? 'var(--color-partial)' : 'var(--color-failure)'}`,
          borderRadius: '14px',
          padding: '20px',
          textAlign: 'center',
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>
          {isAssignedNext ? '⚠️' : '❌'}
        </div>
        <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '8px', color: isAssignedNext ? '#b07a1a' : '#b03535' }}>
          {isAssignedNext ? 'Session Changed' : 'Verification Failed'}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{message}</div>

        {validation && !validation.passed && (
          <div style={{ marginTop: '12px', textAlign: 'left', background: 'rgba(226, 75, 74, 0.08)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#b03535' }}>Check Details:</div>
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span>{validation.face_detected ? '✅' : '❌'} Face detected</span>
              <span>{validation.medicine_detected ? '✅' : '❌'} Medicine visible</span>
              <span>{validation.medicine_name_matched ? '✅' : '⚠️'} Medicine matched</span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Retake option for AI failures */}
        {(isAIFail || (!isWrongDay && !isSessionExpired && !isAssignedNext)) && attemptsLeft > 0 && (
          <button className="btn-primary" onClick={onRetake}>
            📷 Retake Photo ({attemptsLeft} {attemptsLeft === 1 ? 'attempt' : 'attempts'} left)
          </button>
        )}

        {/* Navigate to next dose if assigned */}
        {isAssignedNext && result.next_dose_id && (
          <button
            className="btn-primary"
            onClick={() => window.location.href = `/capture/${result.next_dose_id}`}
          >
            Go to {result.next_session} dose →
          </button>
        )}

        {/* Partial override */}
        {(isSessionExpired || isWrongDay || attemptsLeft === 0) && onOverride && (
          <button className="btn-secondary" onClick={onOverride}>
            ⚠️ Mark as Taken (No Photo)
          </button>
        )}
      </div>
    </div>
  );
}
