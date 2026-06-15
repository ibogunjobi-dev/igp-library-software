// Coloured status pill, shared across catalogue, members and loans.
const CLASS = {
  Available: 'available',
  'On loan': 'onloan',
  Overdue: 'overdue',
  'Reference only': 'reference',
  Missing: 'missing',
  Withdrawn: 'withdrawn',
  Returned: 'returned',
  Active: 'active',
  Inactive: 'inactive',
};

export default function StatusBadge({ status }) {
  const cls = CLASS[status] || 'withdrawn';
  return <span className={`badge badge--${cls}`}>{status}</span>;
}

export function FirmAuthorshipBadge() {
  return <span className="badge badge--firm" title="Authored by the Founder/Chairman">Firm authorship</span>;
}
