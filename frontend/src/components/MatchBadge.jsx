import './MatchBadge.css';

/**
 * Displays match score & AI similarity badges, e.g. "AI Match Found (92% Similar)"
 */
const MatchBadge = ({ score, status, isAiMatch, imageSimilarityScore, aiConfidence }) => {
  const similarity = imageSimilarityScore || score;
  const isAi = isAiMatch || similarity >= 75;

  if (isAi) {
    return (
      <div className="match-badge match-badge--ai">
        <span className="match-badge__ai-label">✨ AI Match Found</span>
        <span className="match-badge__score">{similarity}% Similar</span>
      </div>
    );
  }

  const getBadgeClass = () => {
    if (status === 'High Match' || score >= 70) return 'match-badge match-badge--high';
    if (status === 'Possible Match' || score >= 40) return 'match-badge match-badge--possible';
    return 'match-badge match-badge--none';
  };

  return (
    <div className={getBadgeClass()}>
      <span className="match-badge__score">{score}%</span>
      <span className="match-badge__status">{status || 'Match'}</span>
    </div>
  );
};

export default MatchBadge;
