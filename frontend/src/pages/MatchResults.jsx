import { useEffect, useState } from 'react';
import { getAllMatches } from '../services/matchService';
import MatchBadge from '../components/MatchBadge';
import MatchReasons from '../components/MatchReasons';
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
        // Only show found items that actually have at least one meaningful match
        const withMatches = result.data.results.filter((entry) => entry.matches.length > 0);
        setResults(withMatches);
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
      <h1>Match Results</h1>
      <p className="report-page__subtitle">Found items compared against all reported lost items</p>

      {error && <div className="auth-error">{error}</div>}

      {results.length === 0 ? (
        <p className="dashboard__empty">No matches found yet. Check back after more items are reported.</p>
      ) : (
        results.map((entry) => (
          <div className="match-group" key={entry.foundItem._id}>
            <h2 className="match-group__title">
              Found: {entry.foundItem.itemName} <span className="match-group__meta">({entry.foundItem.location})</span>
            </h2>

            <div className="match-results-list">
              {entry.matches.map((match) => (
                <div className="match-result-row match-result-row--column" key={match.lostItem._id}>
                  <div className="match-result-row__header">
                    <div>
                      <strong>{match.lostItem.itemName}</strong>
                      <p className="dashboard__list-meta">
                        Lost at {match.lostItem.location} &middot; Reported by {match.lostItem.user?.name || 'Unknown'}
                      </p>
                    </div>
                    <MatchBadge score={match.score} status={match.status} />
                  </div>
                  <MatchReasons matchedFields={match.matchedFields} />
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
