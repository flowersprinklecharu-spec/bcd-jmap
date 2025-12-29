import React, { useState, useEffect, useContext } from 'react';
// Navbar moved to App.js (top-level)
import { saveAboutContent, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { AdminContext } from '../contexts/AdminContext';
import './about.css';

// Edit Icon
const EditIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
  </svg>
);

const About = ({ onNavigate, onRequestLogin }) => {
  const { isAdmin } = useContext(AdminContext);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aboutContent, setAboutContent] = useState({
    title: 'About JeepneyMap',
    description: 'JeepneyMap is a comprehensive jeepney route information system designed specifically for Bacolod City commuters. Our mission is to make public transportation more accessible and convenient for residents and visitors alike.',
    features: [
      'Real-time jeepney tracking and route suggestions',
      'Comprehensive database of all jeepney routes in Bacolod City',
      'Information on landmarks, fare rates, and schedules',
      'Latest announcements about route changes and transportation updates',
      'User accounts for saving favorite routes and destinations'
    ],
    email: 'info@jeepneymap.com',
    phone: '(034) 123-4567',
    address: 'Bacolod City Public Transport Office, Bacolod City Hall'
  });

  // Load About content from Firestore on component mount
  useEffect(() => {
    const loadAboutContent = async () => {
      try {
        if (!db) {
          console.log('Firestore not initialized, using default content');
          return;
        }
        const docRef = doc(db, 'about', 'content');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          console.log('Loaded about content from Firestore:', docSnap.data());
          setAboutContent(docSnap.data());
        } else {
          console.log('No about content found in Firestore, using defaults');
        }
      } catch (err) {
        console.error('Failed to load about content:', err);
        // Use default content if loading fails
      }
    };
    loadAboutContent();
  }, []);

  const handleSaveAbout = async () => {
    if (isSaving) return; // Prevent multiple clicks
    setIsSaving(true);
    try {
      console.log('Saving about content:', aboutContent);
      
      // Create a timeout promise that rejects after 10 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save took too long (timeout)')), 10000)
      );
      
      // Race between save and timeout
      await Promise.race([saveAboutContent(aboutContent), timeoutPromise]);
      
      console.log('Successfully saved!');
      alert('✅ About page saved successfully!');
      setIsEditing(false);
    } catch (err) {
      console.error('Save error:', err);
      alert('❌ Failed to save about content:\n' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="about-page">
      {/* Navbar is rendered by App.js */}
      <div className="about-container">
        <div className="about-content">
          {/* Admin edit removed from public UI */}
          {isEditing ? (
            // Edit Mode
            <div className="edit-form">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  value={aboutContent.title}
                  onChange={(e) => setAboutContent({...aboutContent, title: e.target.value})}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  value={aboutContent.description}
                  onChange={(e) => setAboutContent({...aboutContent, description: e.target.value})}
                  className="form-textarea"
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Features</label>
                {aboutContent.features.map((feature, index) => (
                  <div key={index} className="feature-edit-item">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => {
                        const newFeatures = [...aboutContent.features];
                        newFeatures[index] = e.target.value;
                        setAboutContent({...aboutContent, features: newFeatures});
                      }}
                      className="form-input"
                    />
                    <button
                      className="delete-btn"
                      onClick={() => {
                        const newFeatures = aboutContent.features.filter((_, i) => i !== index);
                        setAboutContent({...aboutContent, features: newFeatures});
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="add-feature-btn"
                  onClick={() => setAboutContent({...aboutContent, features: [...aboutContent.features, '']})}
                >
                  + Add Feature
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={aboutContent.email}
                  onChange={(e) => setAboutContent({...aboutContent, email: e.target.value})}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={aboutContent.phone}
                  onChange={(e) => setAboutContent({...aboutContent, phone: e.target.value})}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  value={aboutContent.address}
                  onChange={(e) => setAboutContent({...aboutContent, address: e.target.value})}
                  className="form-textarea"
                  rows="2"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsEditing(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#e0e0e0',
                    color: '#333',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="save-btn"
                  onClick={handleSaveAbout}
                  disabled={isSaving}
                  style={{ cursor: isSaving ? 'not-allowed' : 'pointer', zIndex: 10, opacity: isSaving ? 0.6 : 1 }}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            // View Mode
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '30px' }}>
                <h1 className="about-title">{aboutContent.title}</h1>
                {isAdmin && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="admin-edit-btn"
                  >
                    <EditIcon />
                  </button>
                )}
              </div>

              <div className="about-section">
                <p className="about-description">
                  {aboutContent.description}
                </p>
              </div>

              <div className="about-section">
                <h2 className="section-heading">Features</h2>
                <ul className="features-list">
                  {aboutContent.features.map((feature, index) => (
                    <li key={index} className="feature-item">{feature}</li>
                  ))}
                </ul>
              </div>

              <div className="about-section">
                <h2 className="section-heading">Contact Us</h2>
                <p className="contact-intro">
                  For inquiries, suggestions, or partnership opportunities, please contact us at:
                </p>
                <div className="contact-details">
                  <div className="contact-item">
                    <span className="contact-label">Email:</span>
                    <span className="contact-value">{aboutContent.email}</span>
                  </div>
                  <div className="contact-item">
                    <span className="contact-label">Phone:</span>
                    <span className="contact-value">{aboutContent.phone}</span>
                  </div>
                  <div className="contact-item">
                    <span className="contact-label">Address:</span>
                    <span className="contact-value">{aboutContent.address}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default About;