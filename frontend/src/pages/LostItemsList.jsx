import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLostItems, deleteLostItem } from '../services/lostItemService';
import ItemCard from '../components/ItemCard';
import Loader from '../components/Loader';
import useAuth from '../hooks/useAuth';
import './ItemsList.css';

const CATEGORY_OPTIONS = [
  'Electronics', 'Bags', 'Wallets', 'Jewelry', 'Documents',
  'Clothing', 'Keys', 'Books', 'Sports Equipment', 'Other',
];

const LostItemsList = () => {
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
      const result = await getLostItems({ page, limit: 8, search, category, location });
      setItems(result.data.lostItems);
      setPagination({
        page: result.data.pagination.page,
        totalPages: result.data.pagination.totalPages,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load lost items');
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
    if (!window.confirm('Delete this report?')) return;
    try {
      await deleteLostItem(id);
      setItems((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete item');
    }
  };

  return (
    <div className="items-list-page">
      <div className="items-list-page__header">
        <h1>Lost Items</h1>
        <Link to="/lost-items/new" className="btn btn--primary">
          + Report Lost Item
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
        <p className="dashboard__empty">No lost items found.</p>
      ) : (
        <>
          <div className="items-grid">
            {items.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                type="lost"
                showActions={user && item.user?._id === user.id}
                onDelete={handleDelete}
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

export default LostItemsList;
