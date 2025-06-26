const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const Message = require('../models/Message');
const User = require('../models/User');
const { protect, authorizeStudentOrMentor } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/roleBasedAccess');

const router = express.Router();

// @route   POST /api/messages
// @desc    Send a message
// @access  Private
router.post('/', [
  protect,
  authorizeStudentOrMentor,
  body('recipientId').isMongoId().withMessage('Valid recipient ID required'),
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Message content must be 1-1000 characters'),
  body('conversationId').optional().isMongoId().withMessage('Valid conversation ID required if provided')
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

    const { recipientId, content, conversationId } = req.body;

    // Verify recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Generate conversation ID if not provided
    const finalConversationId = conversationId || generateConversationId(req.user._id, recipientId);

    const message = new Message({
      senderId: req.user._id,
      recipientId,
      content,
      conversationId: finalConversationId,
      isRead: false
    });

    await message.save();

    // Populate for response
    await message.populate([
      { path: 'senderId', select: 'firstName lastName username profilePicture' },
      { path: 'recipientId', select: 'firstName lastName username profilePicture' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/messages/conversations
// @desc    Get user's conversations
// @access  Private
router.get('/conversations', protect, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get latest message for each conversation
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: req.user._id },
            { recipientId: req.user._id }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipientId', req.user._id] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);

    // Populate user details
    for (let conv of conversations) {
      await Message.populate(conv.lastMessage, [
        { path: 'senderId', select: 'firstName lastName username profilePicture' },
        { path: 'recipientId', select: 'firstName lastName username profilePicture' }
      ]);
    }

    const total = await Message.distinct('conversationId', {
      $or: [
        { senderId: req.user._id },
        { recipientId: req.user._id }
      ]
    }).then(ids => ids.length);

    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/messages/conversation/:conversationId
// @desc    Get messages in a conversation
// @access  Private
router.get('/conversation/:conversationId', protect, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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

    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verify user is part of conversation
    const conversationMessage = await Message.findOne({
      conversationId,
      $or: [
        { senderId: req.user._id },
        { recipientId: req.user._id }
      ]
    });

    if (!conversationMessage) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const messages = await Message.find({ conversationId })
      .populate('senderId', 'firstName lastName username profilePicture')
      .populate('recipientId', 'firstName lastName username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ conversationId });

    // Mark messages as read for current user
    await Message.updateMany(
      {
        conversationId,
        recipientId: req.user._id,
        isRead: false
      },
      { isRead: true }
    );

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/messages/:id/read
// @desc    Mark message as read
// @access  Private
router.put('/:id/read', protect, validateObjectId('id'), async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      recipientId: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    message.isRead = true;
    await message.save();

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get unread message count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      recipientId: req.user._id,
      isRead: false
    });

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/messages/:id
// @desc    Delete a message
// @access  Private (Sender only)
router.delete('/:id', protect, validateObjectId('id'), async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      senderId: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or you are not authorized to delete it'
      });
    }

    await message.deleteOne();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/messages/conversation/archive
// @desc    Archive a conversation
// @access  Private
router.post('/conversation/archive', [
  protect,
  body('conversationId').notEmpty().withMessage('Conversation ID required')
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

    const { conversationId } = req.body;

    // Verify user is part of conversation
    const conversationMessage = await Message.findOne({
      conversationId,
      $or: [
        { senderId: req.user._id },
        { recipientId: req.user._id }
      ]
    });

    if (!conversationMessage) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Archive messages for current user
    await Message.updateMany(
      {
        conversationId,
        $or: [
          { senderId: req.user._id },
          { recipientId: req.user._id }
        ]
      },
      { 
        $addToSet: { archivedBy: req.user._id }
      }
    );

    res.json({
      success: true,
      message: 'Conversation archived successfully'
    });
  } catch (error) {
    console.error('Archive conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Helper function to generate conversation ID
function generateConversationId(userId1, userId2) {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `${ids[0]}_${ids[1]}`;
}

module.exports = router;