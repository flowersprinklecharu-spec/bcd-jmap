import React, { useState, useEffect } from 'react';
import Navbar from '../Navbar/Navbar';
import { saveAnnouncement, deleteAnnouncement, normalizeDocData } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// SVG Icons
const EditIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
  </svg>
);

const DeleteIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
  </svg>
);

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

const Announcements = ({ onNavigate, isAdmin, onAdminToggle, onRequestLogin }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState('add');
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);

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

  const handleEditAnnouncement = (announcement) => {
    setEditMode('edit');
    setEditingAnnouncement({ ...announcement });
    setShowModal(true);
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteAnnouncement(announcementId);
        setAnnouncements(announcements.filter(a => a.id !== announcementId));
        alert('✅ Announcement deleted successfully!');
      } catch (err) {
        console.error(err);
        alert('❌ Failed to delete announcement: ' + err.message);
      }
    }
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

  return (
    <div className="announcements-page">
      <Navbar 
        isAdmin={isAdmin} 
        onAdminToggle={onAdminToggle}
        onNavigate={onNavigate}
        onRequestLogin={onRequestLogin}
        currentPage="announcements"
      />

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
                        className="admin-edit-btn"
                        onClick={() => handleEditAnnouncement(announcement)}
                      >
                        <EditIcon />
                      </button>
                      <button 
                        className="admin-delete-btn"
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
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
                  onClick={() => setShowModal(false)}
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