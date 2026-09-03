// routes/notifications.js
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Get all notifications for a user
router.get('/', auth, async (req, res) => {
  try {
    const uid = req.user._id;
    const notifications = await Notification.find({
      $or: [
        { userId: uid },
        { userId: uid.toString() }
      ]
    }).sort({ createdAt: -1 });
    
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new notification route removed (C4-8) - notifications must be generated server-side.

// Mark all notifications as read (supports both PATCH and PUT)
const markAllReadHandler = async (req, res) => {
  try {
    const uid = req.user._id;
    await Notification.updateMany(
      {
        $or: [
          { userId: uid },
          { userId: uid.toString() }
        ],
        isRead: false
      },
      { $set: { isRead: true } }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error updating notifications:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
router.patch('/read-all', auth, markAllReadHandler);
router.put('/read-all', auth, markAllReadHandler);

// Mark a notification as read (supports both PATCH and PUT)
const markSingleReadHandler = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if this notification belongs to the authenticated user
    const userUid = req.user._id ? req.user._id.toString() : '';
    const notifUid = notification.userId ? notification.userId.toString() : '';
    
    if (notifUid && userUid && notifUid !== userUid && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    notification.isRead = true;
    await notification.save();
    
    res.json(notification);
  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
router.patch('/:id/read', auth, markSingleReadHandler);
router.put('/:id/read', auth, markSingleReadHandler);

// Delete a notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if this notification belongs to the authenticated user
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notification removed' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// HEAD request to check if the API exists
router.head('/', auth, (req, res) => {
  res.status(200).end();
});

module.exports = router;