import React, { useState, useContext } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminContext } from '../contexts/AdminContext';
import './feedback-form.css';

// Star rating icon
const StarIcon = ({ filled }) => (
  <svg width="24" height="24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
  </svg>
);

// Close icon
const CloseIcon = () => (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
  </svg>
);

const FeedbackForm = ({ isOpen, onClose }) => {
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error' | null
  const [submitMessage, setSubmitMessage] = useState('');

  const { isAdmin } = useContext(AdminContext);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Please enter your feedback');
      return;
    }

    if (!email.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const feedbackData = {
        name: name || 'Anonymous',
        email: email,
        message: message,
        rating: rating,
        timestamp: serverTimestamp(),
        resolved: false,
        userId: null, // Could add user ID if authenticated
      };

      console.log('📝 Submitting feedback:', feedbackData);
      const feedbackRef = collection(db, 'feedback');
      const docRef = await addDoc(feedbackRef, feedbackData);
      console.log('✅ Feedback submitted successfully! Doc ID:', docRef.id);

      // Reset form
      setRating(5);
      setMessage('');
      setName('');
      setEmail('');
      setSubmitStatus('success');
      setSubmitMessage('Thank you! Your feedback has been submitted.');

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        setSubmitStatus(null);
      }, 2000);
    } catch (error) {
      console.error('❌ Error submitting feedback:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      setSubmitStatus('error');
      setSubmitMessage(`Failed to submit feedback: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="feedback-modal-overlay" onClick={onClose}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="feedback-modal-header">
          <h2>Share Your Feedback</h2>
          <button 
            className="feedback-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="feedback-modal-body">
          {submitStatus === 'success' ? (
            <div className="feedback-success-message">
              <div className="success-icon">✓</div>
              <p>{submitMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="feedback-form">
              {/* Name Field */}
              <div className="feedback-form-group">
                <label htmlFor="feedback-name">Name (Optional)</label>
                <input
                  id="feedback-name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="feedback-input"
                />
              </div>

              {/* Email Field */}
              <div className="feedback-form-group">
                <label htmlFor="feedback-email">Email Address *</label>
                <input
                  id="feedback-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="feedback-input"
                  required
                />
              </div>

              {/* Rating Field */}
              <div className="feedback-form-group">
                <label>How would you rate your experience?</label>
                <div className="feedback-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`feedback-star ${rating >= star ? 'filled' : ''}`}
                      onClick={() => setRating(star)}
                      aria-label={`Rate ${star} stars`}
                    >
                      <StarIcon filled={rating >= star} />
                    </button>
                  ))}
                </div>
                <span className="feedback-rating-label">
                  {['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating - 1]}
                </span>
              </div>

              {/* Message Field */}
              <div className="feedback-form-group">
                <label htmlFor="feedback-message">Your Feedback *</label>
                <textarea
                  id="feedback-message"
                  placeholder="Tell us what you think..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="feedback-textarea"
                  rows="5"
                  required
                />
                <span className="feedback-char-count">
                  {message.length}/1000
                </span>
              </div>

              {/* Error Message */}
              {submitStatus === 'error' && (
                <div className="feedback-error-message">
                  {submitMessage}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="feedback-submit-btn"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackForm;
