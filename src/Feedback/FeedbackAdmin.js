import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminContext } from '../contexts/AdminContext';
import './feedback-admin.css';

// Icons
const TrashIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"></path>
  </svg>
);

const StarIcon = ({ filled }) => (
  <svg width="18" height="18" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
  </svg>
);

const FeedbackAdmin = ({ onNavigate, onRequestLogin }) => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'rating-high' | 'rating-low'
  const [filterResolved, setFilterResolved] = useState('all'); // 'all' | 'unresolved' | 'resolved'
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const unsubscribeRef = React.useRef(null);

  const { isAdmin } = useContext(AdminContext);

  // Check if admin
  useEffect(() => {
    if (!isAdmin) {
      onRequestLogin();
    }
  }, [isAdmin, onRequestLogin]);

  // Fetch feedbacks
  useEffect(() => {
    // Only set up listener if admin is explicitly true
    if (isAdmin !== true) {
      setIsLoading(false);
      return;
    }

    try {
      const feedbackRef = collection(db, 'feedback');

      const unsubscribe = onSnapshot(
        feedbackRef,
        (snapshot) => {
          try {
            const feedbackList = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            }));
            // Sort by timestamp in JavaScript
            feedbackList.sort((a, b) => {
              const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
              const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
              return timeB - timeA; // newest first
            });
            setFeedbacks(feedbackList);
            setIsLoading(false);
          } catch (err) {
            console.error('Error processing feedbacks:', err);
            setIsLoading(false);
          }
        },
        (error) => {
          console.error('Error fetching feedbacks:', error);
          setIsLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    } catch (error) {
      console.error('Error setting up feedback listener:', error);
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Filter and sort feedbacks
  const filteredFeedbacks = feedbacks
    .filter((fb) => {
      // Filter by resolution status
      if (filterResolved === 'resolved' && !fb.resolved) return false;
      if (filterResolved === 'unresolved' && fb.resolved) return false;

      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          fb.name?.toLowerCase().includes(term) ||
          fb.email?.toLowerCase().includes(term) ||
          fb.message?.toLowerCase().includes(term)
        );
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0);
      } else if (sortBy === 'oldest') {
        return (a.timestamp?.toDate?.() || 0) - (b.timestamp?.toDate?.() || 0);
      } else if (sortBy === 'rating-high') {
        return (b.rating || 0) - (a.rating || 0);
      } else if (sortBy === 'rating-low') {
        return (a.rating || 0) - (b.rating || 0);
      }
      return 0;
    });

  const handleDeleteFeedback = async (id) => {
    if (window.confirm('Are you sure you want to delete this feedback?')) {
      try {
        await deleteDoc(doc(db, 'feedback', id));
      } catch (error) {
        console.error('Error deleting feedback:', error);
        alert('Failed to delete feedback');
      }
    }
  };

  const handleToggleResolved = async (id, currentResolved) => {
    try {
      await updateDoc(doc(db, 'feedback', id), {
        resolved: !currentResolved,
      });
    } catch (error) {
      console.error('Error updating feedback:', error);
      alert('Failed to update feedback');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return '#28a745';
    if (rating >= 3) return '#ffc107';
    return '#dc3545';
  };

  if (isLoading) {
    return <div className="feedback-admin-container"><div className="feedback-loading">Loading feedbacks...</div></div>;
  }

  return (
    <div className="feedback-admin-container">
      <div className="feedback-admin-header">
        <h1>User Feedback Management</h1>
        <div className="feedback-stats">
          <div className="stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{feedbacks.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Pending</span>
            <span className="stat-value">{feedbacks.filter(f => !f.resolved).length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Resolved</span>
            <span className="stat-value">{feedbacks.filter(f => f.resolved).length}</span>
          </div>
        </div>
      </div>

      <div className="feedback-controls">
        <div className="feedback-search">
          <input
            type="text"
            placeholder="Search by name, email, or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="feedback-search-input"
          />
        </div>

        <div className="feedback-filters">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="feedback-select"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="rating-high">Highest Rating</option>
            <option value="rating-low">Lowest Rating</option>
          </select>

          <select
            value={filterResolved}
            onChange={(e) => setFilterResolved(e.target.value)}
            className="feedback-select"
          >
            <option value="all">All Feedbacks</option>
            <option value="unresolved">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="feedback-list">
        {filteredFeedbacks.length === 0 ? (
          <div className="feedback-empty">
            <p>No feedbacks found</p>
          </div>
        ) : (
          filteredFeedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className={`feedback-card ${feedback.resolved ? 'resolved' : ''} ${
                expandedId === feedback.id ? 'expanded' : ''
              }`}
            >
              <div
                className="feedback-card-header"
                onClick={() =>
                  setExpandedId(expandedId === feedback.id ? null : feedback.id)
                }
              >
                <div className="feedback-card-title">
                  <h3>{feedback.name || 'Anonymous'}</h3>
                  <div className="feedback-rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <StarIcon
                        key={star}
                        filled={feedback.rating >= star}
                      />
                    ))}
                  </div>
                </div>
                <div className="feedback-card-meta">
                  <span className="feedback-date">{formatDate(feedback.timestamp)}</span>
                  {feedback.resolved && <span className="feedback-resolved-badge">Resolved</span>}
                </div>
              </div>

              {expandedId === feedback.id && (
                <div className="feedback-card-body">
                  <div className="feedback-info">
                    <p>
                      <strong>Email:</strong> <a href={`mailto:${feedback.email}`}>{feedback.email}</a>
                    </p>
                    <div className="feedback-message-container">
                      <strong>Feedback:</strong>
                      <p className="feedback-message">{feedback.message}</p>
                    </div>
                  </div>

                  <div className="feedback-actions">
                    <button
                      onClick={() => handleToggleResolved(feedback.id, feedback.resolved)}
                      className={`feedback-action-btn ${feedback.resolved ? 'unresolved-btn' : 'resolve-btn'}`}
                      title={feedback.resolved ? 'Mark as Unresolved' : 'Mark as Resolved'}
                    >
                      <CheckIcon />
                      {feedback.resolved ? 'Unresolved' : 'Resolve'}
                    </button>
                    <button
                      onClick={() => handleDeleteFeedback(feedback.id)}
                      className="feedback-action-btn delete-btn"
                      title="Delete feedback"
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FeedbackAdmin;
