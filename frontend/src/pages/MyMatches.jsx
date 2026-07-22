import { useEffect, useState } from 'react';
import { getMyMatches } from '../services/myService';
import MatchBadge from '../components/MatchBadge';
import MatchReasons from '../components/MatchReasons';
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
        setMatches(result.data.matches);
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
      <p className="report-page__subtitle">Matches involving items you reported as lost or found</p>

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
                    Lost: {match.lostItem?.itemName} &rarr; Found: {match.foundItem?.itemName}
                  </strong>
                  <p className="dashboard__list-meta">
                    {match.lostItem?.location} &middot; {match.verified ? 'Verified by admin' : 'Awaiting admin review'}
                    {match.returned ? ' · Returned' : ''}
                  </p>
                </div>
                <MatchBadge score={match.score} status={match.matchStatus} />
              </div>
              <MatchReasons matchedFields={match.matchedFields} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyMatches;
