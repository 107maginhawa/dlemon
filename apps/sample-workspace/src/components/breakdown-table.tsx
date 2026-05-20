import type { TreatmentNote } from '@/data/mock-visits'

interface BreakdownTableProps {
  notes: TreatmentNote[]
}

export function BreakdownTable({ notes }: BreakdownTableProps) {
  if (notes.length === 0) return null

  const total = notes.reduce((sum, n) => sum + (n.total ?? 0), 0)

  return (
    <div style={{
      marginTop: 24,
      border: '1px solid #e5e5e5',
      borderRadius: 10,
      overflow: 'hidden',
      background: '#fff',
    }}>
      <div style={{
        padding: '12px 16px',
        fontFamily: 'Sora, sans-serif',
        fontWeight: 700,
        fontSize: 14,
        color: '#111',
        borderBottom: '1px solid #e5e5e5',
        background: '#fafaf9',
      }}>
        Treatment Breakdown
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f5f5f3' }}>
            {['Tooth', 'Surface', 'Condition', 'Treatment', 'Status', 'Total'].map(h => (
              <th key={h} style={{
                padding: '8px 12px',
                textAlign: 'left',
                fontFamily: 'Sora, sans-serif',
                fontWeight: 600,
                fontSize: 12,
                color: '#6b7280',
                borderBottom: '1px solid #e5e5e5',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {notes.map((note, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f0f0ee' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'DM Sans, sans-serif', color: '#111', fontWeight: 600 }}>
                {note.tooth}
              </td>
              <td style={{ padding: '8px 12px', fontFamily: 'DM Sans, sans-serif', color: '#374151' }}>
                {note.surface}
              </td>
              <td style={{ padding: '8px 12px', fontFamily: 'DM Sans, sans-serif', color: '#374151' }}>
                {note.condition}
              </td>
              <td style={{ padding: '8px 12px', fontFamily: 'DM Sans, sans-serif', color: '#374151' }}>
                {note.treatment}
              </td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'Sora, sans-serif',
                  background: note.done ? '#dcfce7' : '#fef9c3',
                  color: note.done ? '#16a34a' : '#854d0e',
                }}>
                  {note.done ? 'Done' : 'Pending'}
                </span>
              </td>
              <td style={{ padding: '8px 12px', fontFamily: 'DM Sans, sans-serif', color: '#111', textAlign: 'right' }}>
                {note.total !== null ? `₱${note.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#fafaf9' }}>
            <td colSpan={5} style={{
              padding: '10px 12px',
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 13,
              color: '#111',
              borderTop: '2px solid #e5e5e5',
            }}>
              Total
            </td>
            <td style={{
              padding: '10px 12px',
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 13,
              color: '#111',
              borderTop: '2px solid #e5e5e5',
              textAlign: 'right',
            }}>
              ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
