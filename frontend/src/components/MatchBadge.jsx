import './MatchBadge.css';

// Displays a match score as a colored badge, e.g. "92% - High Match"
const MatchBadge = ({ score, status }) => {
  // Pick a CSS class based on the match status so the badge color reflects it
  const getBadgeClass = () => {
    if (status === 'High Match') return 'match-badge match-badge--high';
    if (status === 'Possible Match') return 'match-badge match-badge--possible';
    return 'match-badge match-badge--none';
  };

  return (
    <div className={getBadgeClass()}>
      <span className="match-badge__score">{score}%</span>
      <span className="match-badge__status">{status}</span>
    </div>
  );
};

export default MatchBadge;
