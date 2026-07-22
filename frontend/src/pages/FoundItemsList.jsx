import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFoundItems, deleteFoundItem } from '../services/foundItemService';
import ItemCard from '../components/ItemCard';
import Loader from '../components/Loader';
import useAuth from '../hooks/useAuth';
import './ItemsList.css';

const CATEGORY_OPTIONS = [
  'Electronics', 'Bags', 'Wallets', 'Jewelry', 'Documents',
  'Clothing', 'Keys', 'Books', 'Sports Equipment', 'Other',
];

const FoundItemsList = () => {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { user } = useAuth();

  const fetchItems = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const result = await getFoundItems({ page, limit: 8, search, category, location });
      setItems(result.data.foundItems);
      setPagination({
        page: result.data.pagination.page,
        totalPages: result.data.pagination.totalPages,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load found items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchItems(1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this found item report?')) return;
    try {
      await deleteFoundItem(id);
      setItems((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete item');
    }
  };

  return (
    <div className="items-list-page">
      <div className="items-list-page__header">
        <h1>Found Items</h1>
        <Link to="/found-items/new" className="btn btn--primary">
          + Report Found Item
        </Link>
      </div>

      <form className="items-list-page__filters" onSubmit={handleFilterSubmit}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by item name or type"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          className="form-input"
          placeholder="Filter by location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <button type="submit" className="btn btn--secondary">
          Apply Filters
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <p className="dashboard__empty">No found items reported yet.</p>
      ) : (
        <>
          <div className="items-grid">
            {items.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                type="found"
                showActions={user && item.user?._id === user.id}
                onDelete={handleDelete}
                onEdit={() => {}}
              />
            ))}
          </div>

          <div className="items-list-page__pagination">
            <button
              className="btn btn--secondary"
              disabled={pagination.page <= 1}
              onClick={() => fetchItems(pagination.page - 1)}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              className="btn btn--secondary"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchItems(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FoundItemsList;
