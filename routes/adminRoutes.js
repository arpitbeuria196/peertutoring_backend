const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Session = require('../models/Session');
const Review = require('../models/Review');
const SessionRequest = require('../models/SessionRequest');
const Message = require('../models/Message');
const { protect, authorize, authorizeAdmin } = require('../middlewares/auth');

const router = express.Router();

// All routes require admin authorization
router.use(protect);
router.use(authorizeAdmin);

// @route   GET /api/admin/dashboard
// @desc    Get comprehensive admin dashboard data
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    // User statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          verified: { $sum: { $cond: ['$isVerified', 1, 0] } }
        }
      }
    ]);

    // Session statistics
    const sessionStats = await Session.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$price' }
        }
      }
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recentActivity = await Promise.all([
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Session.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Review.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Message.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
    ]);

    // Platform growth metrics
    const growthMetrics = await User.aggregate([
      {
        $match: { createdAt: { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Top mentors by rating and sessions
    const topMentors = await User.find({ role: 'mentor', isActive: true })
      .select('firstName lastName username rating totalSessions totalReviews')
      .sort({ rating: -1, totalSessions: -1 })
      .limit(10);

    // System health metrics
    const systemHealth = {
      activeUsers: await User.countDocuments({ isActive: true, lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      pendingVerifications: await User.countDocuments({ role: 'mentor', isVerified: false }),
      pendingSessionRequests: await SessionRequest.countDocuments({ status: 'pending' }),
      unreadMessages: await Message.countDocuments({ isRead: false })
    };

    res.json({
      success: true,
      data: {
        userStats,
        sessionStats,
        recentActivity: {
          newUsers: recentActivity[0],
          newSessions: recentActivity[1],
          newReviews: recentActivity[2],
          newMessages: recentActivity[3]
        },
        growthMetrics,
        topMentors,
        systemHealth
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with advanced filtering and management options
// @access  Private (Admin only)
router.get('/users', [
  query('role').optional().isIn(['student', 'mentor', 'admin']),
  query('isActive').optional().isBoolean(),
  query('isVerified').optional().isBoolean(),
  query('search').optional().trim(),
  query('sortBy').optional().isIn(['createdAt', 'lastActive', 'rating', 'totalSessions']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
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

    const {
      role,
      isActive,
      isVerified,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 25
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Build query filters
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const users = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/users/:userId/approve
// @desc    Approve or reject user account
// @access  Private (Admin only)
router.put('/users/:userId/approve', [
  body('action').isIn(['approve', 'reject']),
  body('reason').optional().isLength({ max: 500 })
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

    const { action, reason } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (action === 'approve') {
      user.isApproved = true;
      user.approvedBy = req.user._id;
      user.approvedAt = new Date();
      user.rejectionReason = undefined;
    } else {
      user.isApproved = false;
      user.rejectionReason = reason || 'Account rejected by administrator';
    }

    await user.save();

    console.log(`Admin ${req.user.username} ${action}d user ${user.username}. Reason: ${reason || 'No reason provided'}`);

    res.json({
      success: true,
      message: `User account ${action}d successfully`,
      data: {
        userId: user._id,
        action,
        isApproved: user.isApproved,
        approvedAt: user.approvedAt,
        rejectionReason: user.rejectionReason
      }
    });
  } catch (error) {
    console.error('Admin approve user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /admin/users/pending:
 *   get:
 *     summary: Get users pending approval with document status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: List of pending users with document information
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/User'
 *                               - type: object
 *                                 properties:
 *                                   documents:
 *                                     type: object
 *                                     properties:
 *                                       legalDocument:
 *                                         $ref: '#/components/schemas/Document'
 *                                       resume:
 *                                         $ref: '#/components/schemas/Document'
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             page:
 *                               type: integer
 *                             limit:
 *                               type: integer
 *                             total:
 *                               type: integer
 *                             pages:
 *                               type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/users/pending', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pendingUsers = await User.find({
      isApproved: false,
      role: { $ne: 'admin' }
    })
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await User.countDocuments({
      isApproved: false,
      role: { $ne: 'admin' }
    });

    res.json({
      success: true,
      data: {
        users: pendingUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /admin/users/{userId}/verify-documents:
 *   put:
 *     summary: Verify or reject user documents
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 example: approve
 *               documentType:
 *                 type: string
 *                 enum: [legalDocument, resume, all]
 *                 default: all
 *                 example: all
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for rejection (required if action is reject)
 *                 example: Document quality is insufficient
 *     responses:
 *       200:
 *         description: Documents verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: string
 *                         action:
 *                           type: string
 *                         documentType:
 *                           type: string
 *                         documentsVerified:
 *                           type: boolean
 *                         documents:
 *                           type: object
 *       400:
 *         description: Validation error or no documents found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/users/:userId/verify-documents', [
  body('action').isIn(['approve', 'reject']),
  body('documentType').optional().isIn(['resumeDocument', 'offerDocument', 'all']),
  body('reason').optional().isLength({ max: 500 })
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

    const { action, documentType = 'all', reason } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.documents) {
      return res.status(400).json({
        success: false,
        message: 'No documents found for this user'
      });
    }

    // Verify specific document type or all documents
    const documentsToVerify = documentType === 'all' 
      ? ['resumeDocument', 'offerDocument'] 
      : [`${documentType}Document`];

    for (const docType of documentsToVerify) {
      if (user.documents[docType]) {
        if (action === 'approve') {
          user.documents[docType].verified = true;
          user.documents[docType].verifiedBy = req.user._id;
          user.documents[docType].verifiedAt = new Date();
        } else {
          user.documents[docType].verified = false;
          user.documents[docType].verifiedBy = undefined;
          user.documents[docType].verifiedAt = undefined;
        }
      }
    }

    // Check if all documents are verified
    const allDocsVerified = user.documents.resumeDocument?.verified && 
                           user.documents.offerDocument?.verified;
    user.documentsVerified = allDocsVerified;

    await user.save();

    console.log(`Admin ${req.user.username} ${action}d ${documentType} documents for user ${user.username}. Reason: ${reason || 'No reason provided'}`);

    res.json({
      success: true,
      message: `Documents ${action}d successfully`,
      data: {
        userId: user._id,
        action,
        documentType,
        documentsVerified: user.documentsVerified,
        documents: user.documents
      }
    });
  } catch (error) {
    console.error('Admin verify documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/users/:userId/status
// @desc    Update user status (activate/deactivate, verify/unverify)
// @access  Private (Admin only)
router.put('/users/:userId/status', [
  body('isActive').optional().isBoolean(),
  body('isVerified').optional().isBoolean(),
  body('reason').optional().isLength({ max: 500 })
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

    const { isActive, isVerified, reason } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user._id.toString() && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    const updates = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (isVerified !== undefined) updates.isVerified = isVerified;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      updates,
      { new: true, select: '-password' }
    );

    // Log admin action
    console.log(`Admin ${req.user.username} updated user ${user.username} status:`, updates, reason ? `Reason: ${reason}` : '');

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Admin update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/admin/users/:userId
// @desc    Delete user account and associated data
// @access  Private (Admin only)
router.delete('/users/:userId', [
  body('reason').isLength({ min: 10, max: 500 }),
  body('deleteAssociatedData').optional().isBoolean()
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

    const { reason, deleteAssociatedData = false } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Log deletion before removing data
    console.log(`Admin ${req.user.username} deleting user ${user.username}. Reason: ${reason}`);

    if (deleteAssociatedData) {
      // Delete associated data
      await Promise.all([
        Session.deleteMany({ $or: [{ mentorId: user._id }, { studentId: user._id }] }),
        Review.deleteMany({ $or: [{ reviewerId: user._id }, { revieweeId: user._id }] }),
        SessionRequest.deleteMany({ $or: [{ mentorId: user._id }, { studentId: user._id }] }),
        Message.deleteMany({ $or: [{ senderId: user._id }, { receiverId: user._id }] })
      ]);
    }

    await User.findByIdAndDelete(req.params.userId);

    res.json({
      success: true,
      message: 'User account deleted successfully'
    });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/sessions
// @desc    Get all sessions with management options
// @access  Private (Admin only)
router.get('/sessions', [
  query('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled']),
  query('mentorId').optional().isMongoId(),
  query('studentId').optional().isMongoId(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
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

    const { status, mentorId, studentId, dateFrom, dateTo, page = 1, limit = 25 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (status) query.status = status;
    if (mentorId) query.mentorId = mentorId;
    if (studentId) query.studentId = studentId;

    if (dateFrom || dateTo) {
      query.scheduledAt = {};
      if (dateFrom) query.scheduledAt.$gte = new Date(dateFrom);
      if (dateTo) query.scheduledAt.$lte = new Date(dateTo);
    }

    const sessions = await Session.find(query)
      .populate('mentorId', 'firstName lastName username email')
      .populate('studentId', 'firstName lastName username email')
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Session.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Admin get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/sessions/:sessionId/status
// @desc    Update session status (admin override)
// @access  Private (Admin only)
router.put('/sessions/:sessionId/status', [
  body('status').isIn(['pending', 'confirmed', 'completed', 'cancelled']),
  body('reason').isLength({ min: 5, max: 500 })
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

    const { status, reason } = req.body;
    const session = await Session.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const oldStatus = session.status;
    session.status = status;
    await session.save();

    console.log(`Admin ${req.user.username} changed session ${session._id} status from ${oldStatus} to ${status}. Reason: ${reason}`);

    res.json({
      success: true,
      message: 'Session status updated successfully',
      data: session
    });
  } catch (error) {
    console.error('Admin update session status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/reports/revenue
// @desc    Generate revenue reports
// @access  Private (Admin only)
router.get('/reports/revenue', [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    
    let matchCondition = { status: 'completed' };
    
    if (startDate && endDate) {
      matchCondition.scheduledAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const now = new Date();
      let start;
      
      switch (period) {
        case 'week':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default: // month
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      matchCondition.scheduledAt = { $gte: start };
    }

    const revenueData = await Session.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: {
            year: { $year: '$scheduledAt' },
            month: { $month: '$scheduledAt' },
            day: { $dayOfMonth: '$scheduledAt' }
          },
          totalRevenue: { $sum: '$price' },
          sessionCount: { $sum: 1 },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const totalStats = await Session.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$price' },
          totalSessions: { $sum: 1 },
          avgSessionPrice: { $avg: '$price' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period,
        dateRange: matchCondition.scheduledAt,
        revenueData,
        summary: totalStats[0] || { totalRevenue: 0, totalSessions: 0, avgSessionPrice: 0 }
      }
    });
  } catch (error) {
    console.error('Admin revenue report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/admin/broadcast
// @desc    Send broadcast message to users
// @access  Private (Admin only)
router.post('/broadcast', [
  body('subject').trim().isLength({ min: 1, max: 200 }),
  body('content').trim().isLength({ min: 1, max: 2000 }),
  body('userIds').optional().isArray(),
  body('userRole').optional().isIn(['student', 'mentor', 'admin']),
  body('isActive').optional().isBoolean()
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

    const { subject, content, userIds, userRole, isActive } = req.body;
    
    let targetUsers;
    
    if (userIds && userIds.length > 0) {
      targetUsers = await User.find({ _id: { $in: userIds } });
    } else {
      const query = {};
      if (userRole) query.role = userRole;
      if (isActive !== undefined) query.isActive = isActive;
      
      targetUsers = await User.find(query);
    }

    // Create system messages for each user
    const messages = targetUsers.map(user => ({
      senderId: req.user._id,
      receiverId: user._id,
      conversationId: Message.generateConversationId(req.user._id, user._id),
      content: `**${subject}**\n\n${content}`,
      messageType: 'system'
    }));

    await Message.insertMany(messages);

    console.log(`Admin ${req.user.username} sent broadcast message to ${targetUsers.length} users: ${subject}`);

    res.json({
      success: true,
      message: `Broadcast message sent to ${targetUsers.length} users`,
      data: {
        recipientCount: targetUsers.length,
        subject
      }
    });
  } catch (error) {
    console.error('Admin broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /admin/users/{userId}/reset-password:
 *   put:
 *     summary: Reset user password (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: newPassword123
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for password reset
 *                 example: User requested password reset via support
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Cannot reset admin password or forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/users/:userId/reset-password', [
  body('newPassword').isLength({ min: 6 }),
  body('reason').optional().isLength({ max: 500 })
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

    const { newPassword, reason } = req.body;
    const user = await User.findById(req.params.userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from resetting another admin's password unless they are super admin
    if (user.role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot reset admin password'
      });
    }

    // Prevent admin from resetting their own password
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot reset your own password. Use change password instead.'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log admin action
    console.log(`Admin ${req.user.username} reset password for user ${user.username}. Reason: ${reason || 'No reason provided'}`);

    res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        userId: user._id,
        username: user.username,
        resetAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Admin password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/documents/approve
// @desc    Approve individual documents (resume/offer)
// @access  Private (Admin only)
router.put('/documents/approve', [
  body('userId').isMongoId(),
  body('documentType').isIn(['resume', 'offer']),
  body('status').isIn(['approved', 'rejected'])
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

    const { userId, documentType, status } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update document verification status in the documents field
    if (user.documents) {
      const docField = `${documentType}Document`;
      if (user.documents[docField]) {
        user.documents[docField].verified = (status === 'approved');
        user.documents[docField].verifiedBy = req.user._id;
        user.documents[docField].verifiedAt = new Date();
      }
    }
    
    // Check if both documents are verified to approve user
    const resumeVerified = user.documents?.resumeDocument?.verified;
    const offerVerified = user.documents?.offerDocument?.verified;
    
    if (resumeVerified && offerVerified) {
      user.documentsVerified = true;
      user.isApproved = true;
      user.approvedBy = req.user._id;
      user.approvedAt = new Date();
    }

    await user.save();

    res.json({
      success: true,
      message: `${documentType} document ${status} successfully`,
      data: {
        userId: user._id,
        documentType,
        status,
        verified: user.documents?.[`${documentType}Document`]?.verified || false,
        verifiedAt: user.documents?.[`${documentType}Document`]?.verifiedAt || new Date()
      }
    });
  } catch (error) {
    console.error('Document approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing document approval'
    });
  }
});

// @route   DELETE /api/admin/users/:userId
// @desc    Delete a user permanently
// @access  Private (Admin only)
router.delete('/users/:userId', protect, authorizeAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Clean up user's uploaded files
    const fs = require('fs');
    const path = require('path');
    const userUploadDir = path.join(__dirname, '..', 'uploads', userId);
    
    if (fs.existsSync(userUploadDir)) {
      fs.rmSync(userUploadDir, { recursive: true, force: true });
    }

    // Delete user from database
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: {
        deletedUserId: userId
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;