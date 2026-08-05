import { useEffect, useState } from 'react';
import { getMyMatches } from '../services/myService';
import MatchBadge from '../components/MatchBadge';
import MatchReasons from '../components/MatchReasons';
import AiMatchAnalysis from '../components/AiMatchAnalysis';
import Loader from '../components/Loader';
import './MatchResults.css';

const MyMatches = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const result = await getMyMatches();
        setMatches(result.data.matches || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load your matches');
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="match-results-page">
      <h1>My Matches</h1>
      <p className="report-page__subtitle">AI-suggested matches involving items you reported as lost or found</p>

      {error && <div className="auth-error">{error}</div>}

      {matches.length === 0 ? (
        <p className="dashboard__empty">No matches involving your reports yet.</p>
      ) : (
        <div className="match-results-list">
          {matches.map((match) => (
            <div className="match-result-row match-result-row--column" key={match._id}>
              <div className="match-result-row__header">
                <div>
                  <strong>
                    Lost: {match.lostItem?.itemType || match.lostItem?.category} &rarr; Found: {match.foundItem?.itemType || match.foundItem?.category}
                  </strong>
                  <p className="dashboard__list-meta">
                    Location: {match.lostItem?.location} &middot; {match.status === 'Verified' ? '✅ Verified by Admin' : match.status === 'Returned' ? '📦 Returned' : '⏳ Awaiting Admin Review'}
                  </p>
                  {match.matchingMethod === 'Hybrid AI Engine' ? (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.85rem', color: '#555', background: '#f5f5f7', padding: '6px 10px', borderRadius: '4px' }}>
                      <span><strong>AI Confidence:</strong> <span style={{color: '#4f46e5', fontWeight: 'bold'}}>{match.finalConfidenceScore}%</span></span>
                      <span><strong>Image Similarity:</strong> {match.imageSimilarityScore}%</span>
                      <span><strong>Text Similarity:</strong> {match.overallTextSimilarity || match.semanticSimilarity}%</span>
                      <span><strong>Location Similarity:</strong> {match.locationSimilarity}%</span>
                      <span><strong>Method:</strong> {match.matchingMethod}</span>
                    </div>
                  ) : (
                    match.imageSimilarityScore > 0 && (
                      <p className="dashboard__list-meta">
                        Visual Similarity: {match.imageSimilarityScore}%
                      </p>
                    )
                  )}
                </div>
                <MatchBadge
                  score={match.score}
                  status={match.matchLevel || match.status}
                  isAiMatch={match.isAiMatch}
                  imageSimilarityScore={match.imageSimilarityScore}
                  aiConfidence={match.aiConfidence}
                />
              </div>
              <MatchReasons matchedFields={match.matchedFields} />
              
              {/* Expandable AI Analysis Panel */}
              <AiMatchAnalysis match={match} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyMatches;
