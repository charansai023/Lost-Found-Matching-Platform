import './StatusBadge.css';

/**
 * Reusable status badge component for item and match statuses.
 * Handles: Pending, Matched, Verified, Rejected, Returned
 */
const StatusBadge = ({ status, size = 'sm' }) => {
  const normalized = (status || 'Pending').toLowerCase();

  return (
    <span className={`status-badge status-badge--${normalized} status-badge--${size}`}>
      {status || 'Pending'}
    </span>
  );
};

export default StatusBadge;
