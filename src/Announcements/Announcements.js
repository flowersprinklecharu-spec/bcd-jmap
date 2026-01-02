import React, { useState, useEffect, useContext } from 'react';
// Navbar moved to App.js (top-level)
import { saveAnnouncement, normalizeDocData } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminContext } from '../contexts/AdminContext';

// SVG Icons
const AddIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
  </svg>
);

// Announcements are loaded live from Firestore (collection: 'announcements')

const Announcements = ({ onNavigate, onRequestLogin }) => {
  const { isAdmin } = useContext(AdminContext);
  const [announcements, setAnnouncements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState('add');
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track unsaved changes

  useEffect(() => {
    try {
      const col = collection(db, 'announcements');
      const q = query(col);
      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => normalizeDocData(doc));
        setAnnouncements(data.sort((a,b) => (b.date || '').localeCompare(a.date || '')));
      }, (err) => {
        console.error('Announcements listener error', err);
      });

      return () => unsub && unsub();
    } catch (err) {
      console.warn('Firestore not available for announcements', err);
    }
  }, []);

  // Auto-save draft to localStorage whenever editingAnnouncement changes
  useEffect(() => {
    if (editingAnnouncement && showModal) {
      setHasUnsavedChanges(true);
      // Save to localStorage with a debounce (save after 1 second of no changes)
      const timer = setTimeout(() => {
        localStorage.setItem('announcementDraft', JSON.stringify(editingAnnouncement));
        console.log('💾 Announcement draft auto-saved');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [editingAnnouncement, showModal]);

  // Warn before closing/refreshing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && editingAnnouncement && showModal) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, editingAnnouncement, showModal]);

  const handleAddAnnouncement = () => {
    setEditMode('add');
    setEditingAnnouncement({
      id: Date.now(),
      title: '',
      description: '',
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      category: 'General',
      type: 'service-update',
      isImportant: false
    });
    setShowModal(true);
  };

  const handleSaveAnnouncement = async () => {
    try {
      if (editMode === 'add') {
        await saveAnnouncement(editingAnnouncement);
        setAnnouncements([editingAnnouncement, ...announcements]);
        alert('✅ Announcement posted successfully!');
      } else {
        await saveAnnouncement(editingAnnouncement);
        setAnnouncements(announcements.map(a => a.id === editingAnnouncement.id ? editingAnnouncement : a));
        alert('✅ Announcement updated successfully!');
      }
      // Clear draft and unsaved changes on successful save
      localStorage.removeItem('announcementDraft');
      setHasUnsavedChanges(false);
      setShowModal(false);
      setEditingAnnouncement(null);
    } catch (err) {
      console.error(err);
      alert('❌ Failed to save announcement: ' + err.message);
    }
  };

  const handleInputChange = (field, value) => {
    setEditingAnnouncement({ ...editingAnnouncement, [field]: value });
  };

  // Clear unsaved changes flag when modal closes
  useEffect(() => {
    if (!showModal) {
      setHasUnsavedChanges(false);
    }
  }, [showModal]);

  // Safe close that warns about unsaved changes
  const safeCloseModal = () => {
    if (hasUnsavedChanges && editingAnnouncement && showModal) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        setShowModal(false);
        setEditingAnnouncement(null);
      }
    } else {
      setShowModal(false);
      setEditingAnnouncement(null);
    }
  };

  return (
    <div className="announcements-page">
      {/* Navbar is rendered by App.js */}
      <div className="announcements-container">
        <div className="announcements-header">
          <div className="announcements-header-row">
            <h1 className="announcements-title">Announcements & Updates</h1>
            {isAdmin && (
              <button className="admin-add-btn" onClick={handleAddAnnouncement}>
                <AddIcon />
                Add Announcement
              </button>
            )}
          </div>
        </div>

        <div className="announcements-list">
          {announcements.map((announcement) => (
            <div 
              key={announcement.id} 
              className={`announcement-item ${announcement.isImportant ? 'important' : 'general'}`}
            >
              <div className="announcement-content">
                <div className="announcement-main">
                  <h2 className="announcement-item-title">{announcement.title}</h2>
                  <p className="announcement-description">{announcement.description}</p>
                  {announcement.isImportant && (
                    <span className="announcement-badge">Important Notice</span>
                  )}
                </div>
                <div className="announcement-meta">
                  <div className="announcement-date">{announcement.date}</div>
                  {/* Admin edit/delete removed from public UI */}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {showModal && editingAnnouncement && (
        <div className="modal-overlay" onClick={safeCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={safeCloseModal}>
              <CloseIcon />
            </button>

            <h2 className="modal-title">
              {editMode === 'add' ? 'Add New Announcement' : 'Edit Announcement'}
            </h2>

            <div className="edit-form">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  value={editingAnnouncement.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  value={editingAnnouncement.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="form-textarea"
                  rows="4"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    value={editingAnnouncement.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="form-input"
                  >
                    <option value="General">General</option>
                    <option value="Important Notice">Important Notice</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="text"
                    value={editingAnnouncement.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingAnnouncement.isImportant}
                    onChange={(e) => handleInputChange('isImportant', e.target.checked)}
                    className="form-checkbox"
                  />
                  <span>Mark as Important Notice</span>
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={safeCloseModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="save-btn"
                  onClick={handleSaveAnnouncement}
                >
                  {editMode === 'add' ? 'Add Announcement' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;