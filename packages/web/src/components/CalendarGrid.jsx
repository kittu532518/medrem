import React, { useState } from 'react';

function getDayColor(summary) {
  if (!summary || summary.total === 0) return '#E8E0D8'; // grey - no data
  const { success, partial_success, failure, pending, total } = summary;

  const pct = ((success + partial_success * 0.5) / total) * 100;
  if (pct >= 80) return '#639922'; // green - good
  if (pct >= 50) return '#EF9F27'; // amber - partial
  if (pct > 0) return '#E24B4A'; // red - poor
  return '#E24B4A'; // red - all failed
}

export default function CalendarGrid({ days, onDaySelect }) {
  const [selected, setSelected] = useState(null);

  // Build a map of date -> summary
  const dayMap = {};
  for (const day of days) {
    dayMap[day.date] = day;
  }

  // Generate last 30 days
  const dates = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Group into weeks
  const weeks = [];
  let week = [];
  for (let i = 0; i < dates.length; i++) {
    week.push(dates[i]);
    if (week.length === 7 || i === dates.length - 1) {
      weeks.push(week);
      week = [];
    }
  }

  const handleSelect = (date) => {
    setSelected(date);
    onDaySelect?.(date, dayMap[date]);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', justifyContent: 'space-between' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '600' }}>
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          {week.map((date) => {
            const dayData = dayMap[date];
            const color = getDayColor(dayData?.summary);
            const today = new Date().toISOString().split('T')[0];
            const isToday = date === today;
            const isSelected = date === selected;
            const dayNum = parseInt(date.split('-')[2]);

            return (
              <button
                key={date}
                onClick={() => handleSelect(date)}
                style={{
                  flex: 1,
                  aspectRatio: '1',
                  borderRadius: '8px',
                  background: color,
                  border: isSelected ? '3px solid var(--color-primary)' : isToday ? '2px solid var(--color-text)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: isToday ? '700' : '400',
                  color: color === '#E8E0D8' ? '#888780' : 'white',
                  transition: 'transform 0.1s',
                }}
                title={date}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
        {[
          { color: '#639922', label: 'Good (≥80%)' },
          { color: '#EF9F27', label: 'Partial (50–79%)' },
          { color: '#E24B4A', label: 'Missed (<50%)' },
          { color: '#E8E0D8', label: 'No data' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color }} />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
