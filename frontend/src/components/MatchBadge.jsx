import './MatchBadge.css';

/**
 * Displays match score & AI similarity badges, e.g. "AI Match Found — 87% Confidence"
 *
 * Phase 3 fix: the headline percentage is the OVERALL COMBINED confidence
 * (the weighted hybrid score), NOT imageSimilarityScore. The image-only
 * similarity is a component metric and belongs in the AI analysis panel.
 */
const MatchBadge = ({ score, status, isAiMatch }) => {
  // Overall combined confidence — never the image-only score.
  const overallConfidence = Math.round(Number(score) || 0);
  const isAi = Boolean(isAiMatch) || overallConfidence >= 75;

  if (isAi) {
    return (
      <div className="match-badge match-badge--ai">
        <span className="match-badge__ai-label">✨ AI Match Found</span>
        <span className="match-badge__score">{overallConfidence}% Confidence</span>
      </div>
    );
  }

  const getBadgeClass = () => {
    if (status === 'High Match' || overallConfidence >= 70) return 'match-badge match-badge--high';
    if (status === 'Possible Match' || overallConfidence >= 40) return 'match-badge match-badge--possible';
    return 'match-badge match-badge--none';
  };

  return (
    <div className={getBadgeClass()}>
      <span className="match-badge__score">{overallConfidence}%</span>
      <span className="match-badge__status">{status || 'Match'}</span>
    </div>
  );
};

export default MatchBadge;
