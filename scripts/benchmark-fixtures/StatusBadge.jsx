const React = require('react');

/**
 * A status badge component that renders different styles based on status,
 * supports a click handler that cycles through states, and conditionally
 * shows a tooltip. Tests need render + fireEvent + state verification.
 */

const STATUS_LABELS = {
  idle: 'Idle',
  loading: 'Loading\u2026',
  success: 'Done',
  error: 'Error'
};

const STATUS_ORDER = ['idle', 'loading', 'success', 'error'];

function StatusBadge({ initialStatus = 'idle', onStatusChange }) {
  const [status, setStatus] = React.useState(initialStatus);
  const [showTooltip, setShowTooltip] = React.useState(false);

  const cycleStatus = () => {
    const currentIndex = STATUS_ORDER.indexOf(status);
    const nextIndex = (currentIndex + 1) % STATUS_ORDER.length;
    const next = STATUS_ORDER[nextIndex];
    setStatus(next);
    if (onStatusChange) onStatusChange(next);
  };

  return (
    <span
      role="status"
      data-status={status}
      onClick={cycleStatus}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {STATUS_LABELS[status]}
      {showTooltip && <span className="tooltip">Current: {status}</span>}
    </span>
  );
}

module.exports = { StatusBadge, STATUS_LABELS, STATUS_ORDER };
