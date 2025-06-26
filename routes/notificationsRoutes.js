const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const { protect } = require('../middlewares/auth');
const Notification = require('../models/Notification');

const router = express.Router();
const notificationTypes = {
  SESSION_REQUEST: 'session_request',
  SESSION_APPROVED: 'session_approved',
  SESSION_REMINDER: 'session_reminder',
  DOCUMENT_APPROVED: 'document_approved',
  REVIEW_RECEIVED: 'review_received',
  MESSAGE_RECEIVED: 'message_received'
};

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [session_request, session_approved, session_reminder, document_approved, review_received, message_received]
 *         description: Filter by notification type
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           title:
 *                             type: string
 *                           message:
 *                             type: string
 *                           isRead:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 */
router.get('/', protect, [
  query('type').optional().isIn(Object.values(notificationTypes)),
  query('read').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { type, read, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      recipient: req.user._id
    };

    if (type) query.type = type;
    if (read !== undefined) query.isRead = read === 'true';

    const notifications = await Notification.find(query)
      .populate('sender', 'firstName lastName username profilePicture')
      .populate('relatedId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: {
        notifications: notifications.map(notif => ({
          _id: notif._id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          isRead: notif.isRead,
          sender: notif.sender,
          relatedId: notif.relatedId,
          relatedModel: notif.relatedModel,
          metadata: notif.metadata,
          createdAt: notif.createdAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.put('/:id/read', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const Message = require('../models/Message');
    
    const notification = await Message.findOne({
      _id: req.params.id,
      receiver: req.user._id,
      messageType: { $exists: true }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted
 *       404:
 *         description: Notification not found
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const Message = require('../models/Message');
    
    const notification = await Message.findOne({
      _id: req.params.id,
      receiver: req.user._id,
      messageType: { $exists: true }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.deleteOne();

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount:
 *                       type: integer
 */
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Get unread notification count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Helper function to get notification titles
function getNotificationTitle(type) {
  const titles = {
    session_request: 'New Session Request',
    session_approved: 'Session Approved',
    session_reminder: 'Session Reminder',
    document_approved: 'Document Approved',
    review_received: 'New Review',
    message_received: 'New Message',
    session_notification: 'New Session Available'
  };
  return titles[type] || 'Notification';
}

// Create notification helper function
async function createNotification(data) {
  try {
    return await Notification.createNotification(data);
  } catch (error) {
    console.error('Error in createNotification helper:', error);
    return null;
  }
}

// Create notification endpoint
router.post('/', protect, [
  body('type').isIn(['session_request', 'session_approved', 'session_rejected', 'session_reminder', 'session_notification', 'document_approved', 'document_rejected', 'review_received', 'message_received', 'account_approved', 'account_rejected']),
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('message').trim().isLength({ min: 1, max: 500 }),
  body('relatedId').optional().isMongoId(),
  body('relatedModel').optional().isIn(['Session', 'SessionRequest', 'Document', 'Review', 'Message', 'User'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { type, title, message, relatedId, relatedModel, metadata } = req.body;

    const notification = await Notification.createNotification({
      recipient: req.user._id,
      sender: req.user._id,
      type,
      title,
      message,
      relatedId,
      relatedModel,
      metadata: metadata || {}
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification }
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Bulk mark as read endpoint
router.put('/mark-all-read', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Export both router and helper function
module.exports = { router, createNotification };