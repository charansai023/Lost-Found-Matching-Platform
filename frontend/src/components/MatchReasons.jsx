import './MatchReasons.css';

// All fields the matching algorithm can compare — updated to match new matchingService weights
const ALL_FIELDS = [
  { key: 'category', label: 'Category matched' },
  { key: 'itemType', label: 'Item type matched' },
  { key: 'color', label: 'Color matched' },
  { key: 'location', label: 'Location matched' },
  { key: 'brand', label: 'Brand matched' },
  { key: 'model', label: 'Model matched' },
  { key: 'description', label: 'Description keywords matched' },
  { key: 'uniqueMarks', label: 'Unique marks matched' },
];

/**
 * Renders a ✔ / ✘ checklist explaining why a match got its score.
 * Shows a transparent breakdown rather than just a percentage.
 */
const MatchReasons = ({ matchedFields = [] }) => {
  // Only show fields that were either matched or are important enough to call out
  const relevantFields = ALL_FIELDS.filter(
    (f) => matchedFields.includes(f.key) || ['category', 'itemType', 'color', 'location'].includes(f.key)
  );

  return (
    <ul className="match-reasons">
      {relevantFields.map((field) => {
        const isMatched = matchedFields.includes(field.key);
        return (
          <li key={field.key} className={isMatched ? 'match-reasons__item--yes' : 'match-reasons__item--no'}>
            <span className="match-reasons__icon">{isMatched ? '✅' : '✘'}</span>
            {field.label}
          </li>
        );
      })}
    </ul>
  );
};

export default MatchReasons;
