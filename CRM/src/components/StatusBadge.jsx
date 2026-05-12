import { STATUS_LABELS, STATUS_COLORS, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '../data/mockData'

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function LeadStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${LEAD_STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {LEAD_STATUS_LABELS[status] || status}
    </span>
  )
}
