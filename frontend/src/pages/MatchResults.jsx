import { useEffect, useState } from 'react';
import { getAllMatches } from '../services/matchService';
import MatchBadge from '../components/MatchBadge';
import MatchReasons from '../components/MatchReasons';
import AiMatchAnalysis from '../components/AiMatchAnalysis';
import Loader from '../components/Loader';
import './MatchResults.css';

const MatchResults = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const result = await getAllMatches();
        const dataResults = result.data.results || [];
        if (dataResults.length > 0) {
          const withMatches = dataResults.filter((entry) => entry.matches && entry.matches.length > 0);
          setResults(withMatches);
        } else if (result.data.matches && result.data.matches.length > 0) {
          // Fallback group by foundItem
          const groupedMap = new Map();
          result.data.matches.forEach((m) => {
            if (!m.foundItem) return;
            const fId = m.foundItem._id;
            if (!groupedMap.has(fId)) {
              groupedMap.set(fId, { foundItem: m.foundItem, matches: [] });
            }
            groupedMap.get(fId).matches.push(m);
          });
          setResults(Array.from(groupedMap.values()));
        } else {
          setResults([]);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load matches');
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="match-results-page">
      <h1>AI Match Results</h1>
      <p className="report-page__subtitle">AI feature embeddings & visual similarity suggestions between Lost & Found items</p>

      {error && <div className="auth-error">{error}</div>}

      {results.length === 0 ? (
        <p className="dashboard__empty">No AI matches found yet. Check back after more items are reported.</p>
      ) : (
        results.map((entry) => (
          <div className="match-group" key={entry.foundItem?._id || Math.random()}>
            <h2 className="match-group__title">
              Found: {entry.foundItem?.itemType || entry.foundItem?.category || 'Found Item'}{' '}
              <span className="match-group__meta">({entry.foundItem?.location})</span>
            </h2>

            <div className="match-results-list">
              {entry.matches
                .sort((a, b) => (b.imageSimilarityScore || b.score) - (a.imageSimilarityScore || a.score))
                .map((match) => (
                  <div className="match-result-row match-result-row--column" key={match._id || match.lostItem?._id}>
                    <div className="match-result-row__header">
                      <div>
                        <strong>{match.lostItem?.itemType || match.lostItem?.category || 'Lost Item'}</strong>
                        <p className="dashboard__list-meta">
                          Lost at {match.lostItem?.location || 'Unknown'} &middot; Reported by {match.lostItem?.user?.name || 'Unknown'}
                        </p>
                        {match.matchingMethod === 'Hybrid AI Engine' ? (
                          <div style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.85rem', color: '#555', background: '#f5f5f7', padding: '6px 10px', borderRadius: '4px' }}>
                            <span><strong>AI Confidence:</strong> <span style={{color: '#4f46e5', fontWeight: 'bold'}}>{match.finalConfidenceScore || match.score}%</span></span>
                            <span><strong>Image Similarity:</strong> {match.imageSimilarityScore || 0}%</span>
                            <span><strong>Text Similarity:</strong> {match.overallTextSimilarity || match.semanticSimilarity || 0}%</span>
                            <span><strong>Location Similarity:</strong> {match.locationSimilarity || 0}%</span>
                            <span><strong>Category Compatibility:</strong> {match.categoryScore || 0}%</span>
                            <span><strong>Method:</strong> {match.matchingMethod || 'Legacy'}</span>
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
          </div>
        ))
      )}
    </div>
  );
};

export default MatchResults;
