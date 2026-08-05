import { useState } from 'react';
import './AiMatchAnalysis.css';

/**
 * Professional AI Match Analysis Panel Component
 * Displays score breakdowns, side-by-side attributes comparison, checklist reasonings, and explainable AI descriptions.
 */
const AiMatchAnalysis = ({ match }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!match) return null;

  const {
    lostItem,
    foundItem,
    score = 0,
    imageSimilarityScore = 0,
    overallTextSimilarity,
    semanticSimilarity = 0,
    locationSimilarity = 0,
    categoryScore = 0,
    brandScore = 50,
    colorScore = 50,
    textScore = 0,
    explanation = '',
    matchingMethod = '',
  } = match;

  // Retrieve text similarity score (prioritizing overallTextSimilarity or semanticSimilarity)
  const textSimilarity = typeof overallTextSimilarity === 'number' ? overallTextSimilarity : semanticSimilarity;

  // 1. Get Confidence Badge Details
  const getConfidenceDetails = (val) => {
    if (val >= 90) {
      return {
        label: 'Excellent Match',
        class: 'excellent',
        icon: '🟢',
        range: '(90–100%)',
      };
    }
    if (val >= 75) {
      return {
        label: 'Strong Match',
        class: 'strong',
        icon: '🟡',
        range: '(75–89%)',
      };
    }
    if (val >= 50) {
      return {
        label: 'Possible Match',
        class: 'possible',
        icon: '🟠',
        range: '(50–74%)',
      };
    }
    return {
      label: 'Low Match',
      class: 'low',
      icon: '🔴',
      range: '(Below 50%)',
    };
  };

  const confidence = getConfidenceDetails(score);

  // 2. Determine checklist items
  const checks = [];
  const sameCategory = categoryScore >= 80;
  const sameBrand = (lostItem?.brand && foundItem?.brand && brandScore >= 70);
  const sameColor = (lostItem?.color && foundItem?.color && colorScore >= 70);
  const similarDescription = textScore >= 50 || (match.descriptionSimilarity >= 50);
  const similarImages = imageSimilarityScore >= 50;
  const similarLocation = locationSimilarity >= 70;

  if (sameCategory) checks.push('Category Match');
  if (lostItem?.itemType && foundItem?.itemType) checks.push('Same Object Type');
  if (sameBrand) checks.push('Same Brand');
  if (sameColor) checks.push('Same Color');
  if (similarDescription) checks.push('Similar Description');
  if (similarImages) checks.push('Similar Images');
  if (similarLocation) checks.push('Similar Location');

  return (
    <div className="ai-match-container">
      {/* Summary Header */}
      <div className="ai-match-header">
        <div className="ai-match-header__info">
          <span className="ai-match-header__title">🤖 AI Match Analysis</span>
          <span className="ai-match-header__method">
            Method: {matchingMethod || 'Hybrid AI Engine'}
          </span>
        </div>
        <button
          className={`btn-toggle-analysis ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? 'Hide AI Analysis ▲' : 'View AI Analysis ▼'}
        </button>
      </div>

      {/* Expandable detailed panel */}
      <div className={`ai-match-body ${isOpen ? 'expanded' : 'collapsed'}`}>
        <div className="ai-match-grid">
          {/* Column 1: Scores and Progress Bars */}
          <div className="ai-match-col">
            <h4 className="ai-section-title">Final AI Confidence</h4>
            <div className="final-confidence-card">
              <span className="final-score-val">{score}%</span>
              <div className={`confidence-badge confidence-badge--${confidence.class}`}>
                <span>{confidence.icon} {confidence.label}</span>
                <span className="confidence-range">{confidence.range}</span>
              </div>
            </div>

            <h4 className="ai-section-title" style={{ marginTop: '16px' }}>Similarity Breakdown</h4>
            <div className="breakdown-list">
              <div className="breakdown-item">
                <div className="breakdown-label">
                  <span>🖼️ Image Similarity</span>
                  <span>{imageSimilarityScore}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${imageSimilarityScore}%` }}></div>
                </div>
              </div>

              <div className="breakdown-item">
                <div className="breakdown-label">
                  <span>🧠 Semantic Text Similarity</span>
                  <span>{textSimilarity}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill text-fill" style={{ width: `${textSimilarity}%` }}></div>
                </div>
              </div>

              <div className="breakdown-item">
                <div className="breakdown-label">
                  <span>📍 Location Similarity</span>
                  <span>{locationSimilarity}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill loc-fill" style={{ width: `${locationSimilarity}%` }}></div>
                </div>
              </div>

              <div className="breakdown-item">
                <div className="breakdown-label">
                  <span>📂 Category Similarity</span>
                  <span>{categoryScore}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill cat-fill" style={{ width: `${categoryScore}%` }}></div>
                </div>
              </div>

              {lostItem?.brand && foundItem?.brand && (
                <div className="breakdown-item">
                  <div className="breakdown-label">
                    <span>🏷️ Brand Similarity</span>
                    <span>{brandScore}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill brand-fill" style={{ width: `${brandScore}%` }}></div>
                  </div>
                </div>
              )}

              {lostItem?.color && foundItem?.color && (
                <div className="breakdown-item">
                  <div className="breakdown-label">
                    <span>🎨 Color Similarity</span>
                    <span>{colorScore}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill color-fill" style={{ width: `${colorScore}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Side-by-side comparison & Explanation */}
          <div className="ai-match-col">
            <h4 className="ai-section-title">Matched Attributes</h4>
            <div className="attributes-grid">
              <div className="attr-row attr-row--header">
                <span>Field</span>
                <span>Lost Report ↔ Found Report</span>
              </div>
              <div className="attr-row">
                <span className="attr-key">Object Type</span>
                <span className="attr-val">{lostItem?.itemType} ↔ {foundItem?.itemType}</span>
              </div>
              {lostItem?.brand && foundItem?.brand && (
                <div className="attr-row">
                  <span className="attr-key">Brand</span>
                  <span className="attr-val">{lostItem.brand} ↔ {foundItem.brand}</span>
                </div>
              )}
              {lostItem?.color && foundItem?.color && (
                <div className="attr-row">
                  <span className="attr-key">Color</span>
                  <span className="attr-val">{lostItem.color} ↔ {foundItem.color}</span>
                </div>
              )}
              <div className="attr-row">
                <span className="attr-key">Location</span>
                <span className="attr-val">{lostItem?.location} ↔ {foundItem?.location}</span>
              </div>
            </div>

            <h4 className="ai-section-title" style={{ marginTop: '20px' }}>AI Reasoning</h4>
            <div className="reasoning-checklist">
              <div className="reasoning-subtitle">Matched because:</div>
              <div className="checklist-grid">
                {checks.map((check) => (
                  <div key={check} className="check-item">
                    <span className="check-icon">✓</span>
                    <span>{check}</span>
                  </div>
                ))}
                {checks.length === 0 && (
                  <span className="empty-checklist">Weak feature correlations detected.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {explanation && (
          <div className="ai-explanation-panel">
            <div className="ai-explanation-title">💡 Explanation Details</div>
            <p className="ai-explanation-text">"{explanation}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiMatchAnalysis;
