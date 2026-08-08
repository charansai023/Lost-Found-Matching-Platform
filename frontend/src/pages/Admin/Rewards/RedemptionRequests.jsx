import React, { useState, useEffect } from 'react';
import rewardService from '../../../services/rewardService';

const RedemptionRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await rewardService.getRedemptionRequests();
      setRequests(response.data.requests);
    } catch (err) {
      console.error('Failed to load redemption requests', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;
    
    setActionLoading(id);
    try {
      await rewardService.updateRedemptionRequest(id, action);
      // Update UI
      setRequests(requests.map(req => 
        req._id === id ? { ...req, status: action === 'approve' ? 'approved' : 'rejected' } : req
      ));
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="page-transition">Loading...</div>;

  return (
    <div className="dashboard page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Redemption Requests</h1>
      </div>
      
      <div className="stat-card" style={{ padding: '0', overflow: 'hidden' }}>
        {requests.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '16px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280' }}>Date</th>
                <th style={{ padding: '16px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280' }}>User</th>
                <th style={{ padding: '16px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280' }}>Reward Requested</th>
                <th style={{ padding: '16px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280' }}>Cost</th>
                <th style={{ padding: '16px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280' }}>Status</th>
                <th style={{ padding: '16px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: '600' }}>{req.user?.name}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{req.user?.email}</div>
                    <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700' }}>Bal: {req.user?.rewardPoints} pts</div>
                  </td>
                  <td style={{ padding: '16px', fontWeight: '500' }}>{req.rewardName}</td>
                  <td style={{ padding: '16px' }}>{req.pointsCost}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      fontWeight: '600',
                      backgroundColor: req.status === 'pending' ? '#fef3c7' : req.status === 'approved' ? '#dcfce7' : '#fee2e2',
                      color: req.status === 'pending' ? '#b45309' : req.status === 'approved' ? '#166534' : '#991b1b',
                    }}>
                      {req.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn" 
                          style={{ background: '#10b981', color: 'white', padding: '6px 12px', fontSize: '12px' }}
                          disabled={actionLoading === req._id || req.user?.rewardPoints < req.pointsCost}
                          onClick={() => handleAction(req._id, 'approve')}
                        >
                          Approve
                        </button>
                        <button 
                          className="btn" 
                          style={{ background: '#ef4444', color: 'white', padding: '6px 12px', fontSize: '12px' }}
                          disabled={actionLoading === req._id}
                          onClick={() => handleAction(req._id, 'reject')}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No redemption requests found.</div>
        )}
      </div>
    </div>
  );
};

export default RedemptionRequests;
