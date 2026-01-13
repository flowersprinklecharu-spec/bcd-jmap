import React, { useState, useEffect, useContext } from 'react';
// Navbar moved to App.js (top-level)
import { saveAnnouncement, deleteAnnouncement, normalizeDocData } from '../firebase';
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

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

// Announcements are loaded live from Firestore (collection: 'announcements')

const Announcements = ({ onNavigate, onRequestLogin, onAdminEditingChange }) => {
  const { isAdmin } = useContext(AdminContext);
  const [announcements, setAnnouncements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState('add');
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    try {
      const col = collection(db, 'announcements');
      const q = query(col);
      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...normalizeDocData(doc)
        }));
        // Parse dates properly for consistent sorting (handles both ISO and formatted dates)
        setAnnouncements(data.sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA; // Newest first
        }));
      }, (err) => {
        console.error('Announcements listener error', err);
      });

      return () => unsub && unsub();
    } catch (err) {
      console.warn('Firestore not available for announcements', err);
    }
  }, []);

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
    setHasUnsavedChanges(false);
  };

  const handleEditAnnouncement = (announcement) => {
    setEditMode('edit');
    setEditingAnnouncement(announcement);
    setShowModal(true);
    setHasUnsavedChanges(false);
  };

  const handleInputChange = (field, value) => {
    setEditingAnnouncement({ ...editingAnnouncement, [field]: value });
    setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(false);
      setShowModal(false);
      setEditingAnnouncement(null);
    } catch (err) {
      console.error(err);
      alert('❌ Failed to save announcement: ' + err.message);
    }
  };

  const closeModal = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        setShowModal(false);
        setEditingAnnouncement(null);
        setHasUnsavedChanges(false);
      }
    } else {
      setShowModal(false);
      setEditingAnnouncement(null);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteAnnouncement(id);
        setAnnouncements(announcements.filter(a => a.id !== id));
        alert('✅ Announcement deleted successfully!');
      } catch (err) {
        console.error(err);
        alert('❌ Failed to delete announcement: ' + err.message);
      }
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
                  {isAdmin && (
                    <div className="announcement-actions">
                      <button
                        className="announcement-action-btn edit-btn"
                        onClick={() => handleEditAnnouncement(announcement)}
                        title="Edit announcement"
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="announcement-action-btn delete-btn"
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        title="Delete announcement"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && editingAnnouncement && (
        <div className="announcement-modal-overlay" onClick={closeModal}>
          <div className="announcement-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="announcement-modal-header">
              <h2 className="announcement-modal-title">
                {editMode === 'add' ? 'Add New Announcement' : 'Edit Announcement'}
              </h2>
              <button className="announcement-modal-close" onClick={closeModal}>
                <CloseIcon />
              </button>
            </div>

            <div className="announcement-form">
              <div className="announcement-form-group">
                <label className="announcement-form-label">Title</label>
                <input
                  type="text"
                  value={editingAnnouncement.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="announcement-form-input"
                  placeholder="Enter announcement title"
                />
              </div>

              <div className="announcement-form-group">
                <label className="announcement-form-label">Description</label>
                <textarea
                  value={editingAnnouncement.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="announcement-form-textarea"
                  placeholder="Enter announcement details"
                  rows="3"
                />
              </div>

              <div className="announcement-form-row">
                <div className="announcement-form-group">
                  <label className="announcement-form-label">Date</label>
                  <input
                    type="text"
                    value={editingAnnouncement.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="announcement-form-input"
                    placeholder="e.g., January 13, 2026"
                  />
                </div>
              </div>

              <div className="announcement-form-group announcement-checkbox-group">
                <label className="announcement-checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingAnnouncement.isImportant}
                    onChange={(e) => handleInputChange('isImportant', e.target.checked)}
                    className="announcement-form-checkbox"
                  />
                  <span>Mark as Important Notice</span>
                </label>
              </div>

              <div className="announcement-form-actions">
                <button
                  type="button"
                  className="announcement-cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="announcement-save-btn"
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