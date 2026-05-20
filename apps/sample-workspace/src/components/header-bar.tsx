interface HeaderBarProps {
  patientName: string
  dateLabel: string
}

export function HeaderBar({ patientName, dateLabel }: HeaderBarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
      padding: '12px 0',
      borderBottom: '1px solid #e8e6e1',
    }}>
      <div>
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'Sora, sans-serif',
          color: '#111',
        }}>
          {patientName}
        </div>
        <div style={{
          fontSize: 13,
          color: '#6b7280',
          fontFamily: 'DM Sans, sans-serif',
          marginTop: 2,
        }}>
          {dateLabel}
        </div>
      </div>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: 20,
        border: '1.5px solid #FFE97D',
        background: '#fffde8',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'Sora, sans-serif',
        color: '#111',
      }}>
        Dental Chart
      </div>
    </div>
  )
}
