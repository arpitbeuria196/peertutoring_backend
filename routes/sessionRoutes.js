const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const Session = require('../models/Session');
const SessionRequest = require('../models/SessionRequest');
const Review = require('../models/Review');
const User = require('../models/User');
const { protect, authorizeStudent, authorizeMentor, authorizeAdmin, authorizeMentorOrAdmin, authorizeStudentOrMentor } = require('../middlewares/auth');

const router = express.Router();

// @route   GET /api/sessions/analytics/dashboard
// @desc    Get analytics data for dashboard
// @access  Private
router.get('/analytics/dashboard', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let analytics = {};

    if (userRole === 'mentor') {
      // Mentor analytics
      const totalSessions = await Session.countDocuments({ mentorId: userId });
      const completedSessions = await Session.countDocuments({ 
        mentorId: userId, 
        status: 'completed' 
      });
      const upcomingSessions = await Session.countDocuments({ 
        mentorId: userId, 
        status: { $in: ['scheduled', 'confirmed'] }
      });

      analytics = {
        totalSessions,
        completedSessions,
        upcomingSessions,
        successRate: totalSessions > 0 ? (completedSessions / totalSessions * 100).toFixed(1) : 0,
        role: 'student'
      };
    } else if (userRole === 'student') {
      // Student analytics
      const totalSessions = await Session.countDocuments({ studentId: userId });
      const completedSessions = await Session.countDocuments({ 
        studentId: userId, 
        status: 'completed' 
      });
      const upcomingSessions = await Session.countDocuments({ 
        studentId: userId, 
        status: { $in: ['scheduled', 'confirmed'] }
      });

      analytics = {
        totalSessions,
        completedSessions,
        upcomingSessions,
        learningProgress: completedSessions
      };
    } else {
      // Admin analytics
      const totalSessions = await Session.countDocuments();
      const completedSessions = await Session.countDocuments({ status: 'completed' });
      const pendingSessions = await Session.countDocuments({ status: 'pending' });

      analytics = {
        totalSessions,
        completedSessions,
        pendingSessions,
        platformUsage: totalSessions
      };
    }

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error loading analytics'
    });
  }
});

// @route   GET /api/sessions/upcoming
// @desc    Get upcoming sessions for current user
// @access  Private
router.get('/upcoming', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = {};
    if (userRole === 'mentor') {
      query.mentorId = userId;
    } else if (userRole === 'student') {
      query.studentId = userId;
    } else {
      // Admin can see all
    }

    query.status = { $in: ['scheduled', 'confirmed'] };
    query.scheduledDate = { $gte: new Date() };

    const sessions = await Session.find(query)
      .populate('mentorId', 'firstName lastName username')
      .populate('studentId', 'firstName lastName username')
      .sort({ scheduledDate: 1 })
      .limit(10);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Upcoming sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error loading upcoming sessions'
    });
  }
});

// @route   GET /api/sessions/analytics/dashboard
// @desc    Get dashboard analytics for current user
// @access  Private
router.get('/analytics/dashboard', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    
    let analytics = {};
    
    if (userRole === 'mentor') {
      // Mentor analytics
      const totalSessions = await Session.countDocuments({ 
        mentor: userId, 
        status: 'completed' 
      });
      
      const upcomingSessions = await Session.countDocuments({ 
        mentor: userId, 
        status: { $in: ['confirmed', 'pending'] },
        scheduledDate: { $gte: new Date() }
      });
      
      const pendingRequests = await SessionRequest.countDocuments({
        mentor: userId,
        status: 'pending'
      });
      
      // Calculate monthly earnings
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const monthlyEarnings = await Session.aggregate([
        {
          $match: {
            mentor: new mongoose.Types.ObjectId(userId),
            status: 'completed',
            completedAt: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$finalPrice' }
          }
        }
      ]);
      
      analytics = {
        totalSessions,
        upcomingSessions,
        pendingRequests,
        monthlyEarnings: monthlyEarnings[0]?.total || 0,
        userType: 'mentor'
      };
      
    } else if (userRole === 'student') {
      // Student analytics
      const totalSessions = await Session.countDocuments({ 
        student: userId, 
        status: 'completed' 
      });
      
      const upcomingSessions = await Session.countDocuments({ 
        student: userId, 
        status: { $in: ['confirmed', 'pending'] },
        scheduledDate: { $gte: new Date() }
      });
      
      const activeMentors = await Session.distinct('mentor', {
        student: userId,
        status: { $in: ['completed', 'confirmed'] }
      });
      
      analytics = {
        totalSessions,
        upcomingSessions,
        activeMentors: activeMentors.length,
        userType: 'student'
      };
      
    } else if (userRole === 'admin') {
      // Admin analytics
      const totalUsers = await User.countDocuments({ isActive: true });
      const totalMentors = await User.countDocuments({ 
        role: 'mentor', 
        isActive: true, 
        isApproved: true 
      });
      const pendingApprovals = await User.countDocuments({ 
        isApproved: false, 
        isActive: true 
      });
      const completedSessions = await Session.countDocuments({ 
        status: 'completed' 
      });
      
      analytics = {
        totalUsers,
        totalMentors,
        pendingApprovals,
        completedSessions,
        userType: 'admin'
      };
    }
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sessions/requests/pending
// @desc    Get pending session requests for mentor
// @access  Private (Mentor only)
router.get('/requests/pending', protect, async (req, res) => {
  try {
    if (req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Mentors only.'
      });
    }
    
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const requests = await SessionRequest.find({
      mentor: req.user._id,
      status: 'pending'
    })
    .populate('student', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();
    
    const total = await SessionRequest.countDocuments({
      mentor: req.user._id,
      status: 'pending'
    });
    
    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/sessions/requests/:requestId/respond
// @desc    Accept or reject a session request
// @access  Private (Mentor only)
router.put('/requests/:requestId/respond', protect, [
  body('action').isIn(['accept', 'reject']),
  body('scheduledDate').if(body('action').equals('accept')).isISO8601(),
  body('message').optional().isLength({ max: 500 })
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
    
    const { action, scheduledDate, message } = req.body;
    
    const sessionRequest = await SessionRequest.findById(req.params.requestId)
      .populate('student', 'firstName lastName email');
    
    if (!sessionRequest) {
      return res.status(404).json({
        success: false,
        message: 'Session request not found'
      });
    }
    
    if (sessionRequest.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to respond to this request'
      });
    }
    
    if (sessionRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been responded to'
      });
    }
    
    if (action === 'accept') {
      // Create confirmed session
      const session = new Session({
        student: sessionRequest.student._id,
        mentor: req.user._id,
        subject: sessionRequest.subject,
        description: sessionRequest.description,
        duration: sessionRequest.duration,
        scheduledDate: new Date(scheduledDate),
        price: sessionRequest.proposedPrice || req.user.hourlyRate,
        status: 'confirmed'
      });
      
      await session.save();
      
      sessionRequest.status = 'accepted';
      sessionRequest.respondedAt = new Date();
      sessionRequest.response = message;
      sessionRequest.sessionId = session._id;
      
    } else {
      sessionRequest.status = 'rejected';
      sessionRequest.respondedAt = new Date();
      sessionRequest.response = message;
    }
    
    await sessionRequest.save();
    
    res.json({
      success: true,
      message: `Session request ${action}ed successfully`,
      data: sessionRequest
    });
    
  } catch (error) {
    console.error('Respond to request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sessions/upcoming
// @desc    Get upcoming sessions for current user
// @access  Private
router.get('/upcoming', protect, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const query = {
      $or: [
        { student: req.user._id },
        { mentor: req.user._id }
      ],
      status: { $in: ['confirmed', 'pending'] },
      scheduledDate: { $gte: new Date() }
    };
    
    const sessions = await Session.find(query)
      .populate('student', 'firstName lastName profilePicture')
      .populate('mentor', 'firstName lastName profilePicture title')
      .sort({ scheduledDate: 1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json({
      success: true,
      data: sessions
    });
    
  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/sessions/request
// @desc    Create a session request
// @access  Private
router.post('/request', protect, [
  body('mentorId').isMongoId(),
  body('subject').trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isLength({ max: 1000 }),
  body('duration').isInt({ min: 15, max: 480 }),
  body('preferredTimes').isArray({ min: 1 }),
  body('proposedPrice').optional().isFloat({ min: 0 })
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

    const { mentorId, subject, description, duration, preferredTimes, proposedPrice } = req.body;

    // Check if mentor exists and is active
    const mentor = await User.findOne({ _id: mentorId, role: 'mentor', isActive: true });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found or inactive'
      });
    }

    // Prevent requesting session with yourself
    if (req.user._id.toString() === mentorId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request session with yourself'
      });
    }

    const sessionRequest = new SessionRequest({
      studentId: req.user._id,
      mentorId,
      subject,
      description,
      duration,
      preferredTimes,
      proposedPrice
    });

    await sessionRequest.save();

    const populatedRequest = await SessionRequest.findById(sessionRequest._id)
      .populate('mentorId', 'firstName lastName username profilePicture')
      .populate('studentId', 'firstName lastName username profilePicture');

    res.status(201).json({
      success: true,
      message: 'Session request created successfully',
      data: populatedRequest
    });
  } catch (error) {
    console.error('Create session request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during session request creation'
    });
  }
});

// @route   GET /api/sessions/requests
// @desc    Get session requests (mentor: incoming, student: outgoing)
// @access  Private
router.get('/requests', protect, [
  query('type').optional().isIn(['incoming', 'outgoing']),
  query('status').optional().isIn(['pending', 'accepted', 'rejected']),
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

    const { type = 'incoming', status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    
    // Set query based on user role and type
    if (type === 'incoming' && req.user.role === 'mentor') {
      query.mentorId = req.user._id;
    } else if (type === 'outgoing' || req.user.role === 'student') {
      query.studentId = req.user._id;
    } else {
      query.mentorId = req.user._id;
    }

    if (status) {
      query.status = status;
    }

    const requests = await SessionRequest.find(query)
      .populate('mentorId', 'firstName lastName username profilePicture rating')
      .populate('studentId', 'firstName lastName username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SessionRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get session requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/sessions/requests/:id/respond
// @desc    Respond to a session request (accept/reject)
// @access  Private (Mentor only)
router.put('/requests/:id/respond', protect, [
  body('status').isIn(['accepted', 'rejected']),
  body('responseMessage').optional().isLength({ max: 500 }),
  body('scheduledAt').optional().isISO8601(),
  body('meetingLink').optional().isURL(),
  body('price').optional().isFloat({ min: 0 })
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

    const { status, responseMessage, scheduledAt, meetingLink, price } = req.body;

    const sessionRequest = await SessionRequest.findById(req.params.id);
    if (!sessionRequest) {
      return res.status(404).json({
        success: false,
        message: 'Session request not found'
      });
    }

    // Check if user is the mentor for this request
    if (sessionRequest.mentorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to respond to this request'
      });
    }

    // Check if request is still pending
    if (sessionRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been responded to'
      });
    }

    // Update session request
    sessionRequest.status = status;
    sessionRequest.responseMessage = responseMessage;
    await sessionRequest.save();

    // If accepted, create a session
    if (status === 'accepted') {
      if (!scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'Scheduled time is required when accepting a request'
        });
      }

      const session = new Session({
        mentorId: sessionRequest.mentorId,
        studentId: sessionRequest.studentId,
        title: sessionRequest.subject,
        description: sessionRequest.description,
        subject: sessionRequest.subject,
        scheduledAt: new Date(scheduledAt),
        duration: sessionRequest.duration,
        status: 'confirmed',
        meetingLink,
        price: price || sessionRequest.proposedPrice || req.user.hourlyRate
      });

      await session.save();

      const populatedSession = await Session.findById(session._id)
        .populate('mentorId', 'firstName lastName username profilePicture')
        .populate('studentId', 'firstName lastName username profilePicture');

      res.json({
        success: true,
        message: 'Session request accepted and session created',
        data: {
          request: sessionRequest,
          session: populatedSession
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Session request rejected',
        data: sessionRequest
      });
    }
  } catch (error) {
    console.error('Respond to session request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sessions
// @desc    Get user's sessions
// @access  Private
router.get('/', protect, [
  query('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled']),
  query('role').optional().isIn(['mentor', 'student']),
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

    const { status, role, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    
    // Filter by role
    if (role === 'mentor' || (!role && req.user.role === 'mentor')) {
      query.mentorId = req.user._id;
    } else if (role === 'student' || (!role && req.user.role === 'student')) {
      query.studentId = req.user._id;
    } else {
      // Show both for admin or if no role specified
      query.$or = [
        { mentorId: req.user._id },
        { studentId: req.user._id }
      ];
    }

    if (status) {
      query.status = status;
    }

    const sessions = await Session.find(query)
      .populate('mentorId', 'firstName lastName username profilePicture rating')
      .populate('studentId', 'firstName lastName username profilePicture')
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
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sessions/today
// @desc    Get today's sessions for current user
// @access  Private (Mentor only)
router.get('/today', protect, authorizeMentor, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const sessions = await Session.find({
      mentorId: req.user._id,
      scheduledDate: {
        $gte: today,
        $lt: tomorrow
      }
    })
    .populate('studentId', 'firstName lastName username profilePicture email')
    .sort({ scheduledDate: 1 });

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Get today sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sessions/requests
// @desc    Get session requests for current user
// @access  Private (Mentor only)
router.get('/requests', protect, authorizeMentor, async (req, res) => {
  try {
    const requests = await SessionRequest.find({
      mentorId: req.user._id,
      status: 'pending'
    })
    .populate('studentId', 'firstName lastName username profilePicture email')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Get session requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sessions/:id
// @desc    Get session details
// @access  Private
router.get('/:id', protect, authorizeStudentOrMentor, async (req, res) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID'
      });
    }

    const session = await Session.findById(req.params.id)
      .populate('mentorId', 'firstName lastName username profilePicture rating email')
      .populate('studentId', 'firstName lastName username profilePicture email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user is participant
    const isParticipant = session.mentorId._id.toString() === req.user._id.toString() ||
                         session.studentId._id.toString() === req.user._id.toString();

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this session'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/sessions/:id/complete
// @desc    Mark session as completed
// @access  Private (Mentor only)
router.put('/:id/complete', protect, [
  body('notes').optional().isLength({ max: 2000 }),
  body('materials').optional().isArray()
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

    const { notes, materials } = req.body;

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user is the mentor
    if (session.mentorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the mentor can complete the session'
      });
    }

    // Check if session can be completed
    if (!session.canBeCompleted()) {
      return res.status(400).json({
        success: false,
        message: 'Session cannot be completed yet'
      });
    }

    session.status = 'completed';
    session.notes = notes;
    session.materials = materials || [];
    await session.save();

    // Update mentor's total sessions
    await User.findByIdAndUpdate(session.mentorId, {
      $inc: { totalSessions: 1 }
    });

    res.json({
      success: true,
      message: 'Session marked as completed',
      data: session
    });
  } catch (error) {
    console.error('Complete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/sessions/:id/cancel
// @desc    Cancel a session
// @access  Private
router.put('/:id/cancel', protect, [
  body('cancellationReason').optional().isLength({ max: 500 })
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

    const { cancellationReason } = req.body;

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user is participant
    const isParticipant = session.mentorId.toString() === req.user._id.toString() ||
                         session.studentId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this session'
      });
    }

    // Check if session can be cancelled
    if (!session.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Session cannot be cancelled'
      });
    }

    session.status = 'cancelled';
    session.cancelledBy = req.user._id;
    session.cancellationReason = cancellationReason;
    await session.save();

    res.json({
      success: true,
      message: 'Session cancelled successfully',
      data: session
    });
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/sessions/:id/review
// @desc    Create a review for a session
// @access  Private
router.post('/:id/review', protect, [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isLength({ max: 1000 }),
  body('isPublic').optional().isBoolean()
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

    const { rating, comment, isPublic = true } = req.body;

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user is participant
    const isStudent = session.studentId.toString() === req.user._id.toString();
    const isMentor = session.mentorId.toString() === req.user._id.toString();

    if (!isStudent && !isMentor) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to review this session'
      });
    }

    // Check if session is completed
    if (session.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only review completed sessions'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      sessionId: session._id,
      reviewerId: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Review already exists for this session'
      });
    }

    const revieweeId = isStudent ? session.mentorId : session.studentId;

    const review = new Review({
      sessionId: session._id,
      reviewerId: req.user._id,
      revieweeId,
      rating,
      comment,
      isPublic
    });

    await review.save();

    // Update reviewee's rating
    const reviewee = await User.findById(revieweeId);
    await reviewee.updateRating();

    const populatedReview = await Review.findById(review._id)
      .populate('reviewerId', 'firstName lastName username profilePicture')
      .populate('revieweeId', 'firstName lastName username profilePicture')
      .populate('sessionId', 'title subject scheduledAt');

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: populatedReview
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'Session routes working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;