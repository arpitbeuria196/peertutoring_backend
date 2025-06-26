const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Session = require('../models/Session');
const Review = require('../models/Review');
const { protect, authorize, authorizeStudent, authorizeMentor, authorizeAdmin, authorizeMentorOrAdmin, authorizeStudentOrMentor } = require('../middlewares/auth');

const router = express.Router();

// @route   GET /api/mentors
// @desc    Get all mentors with filtering
// @access  Public
router.get('/', [
  query('skills').optional(),
  query('location').optional().trim(),
  query('minRating').optional().isFloat({ min: 0, max: 5 }),
  query('maxRate').optional().isFloat({ min: 0 }),
  query('availability').optional(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('sortBy').optional().isIn(['rating', 'price', 'reviews', 'recent'])
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
      skills,
      location,
      minRating = 0,
      maxRate,
      availability,
      page = 1,
      limit = 12,
      sortBy = 'rating'
    } = req.query;

    // Build query for mentors
    const query = {
      role: 'mentor',
      isApproved: true
    };

    // Skills filter
    if (skills) {
      const skillsArray = Array.isArray(skills) ? skills : skills.split(',');
      query.skills = { $in: skillsArray.map(skill => new RegExp(skill, 'i')) };
    }

    // Location filter
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Rating filter
    if (minRating > 0) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    // Rate filter
    if (maxRate) {
      query.hourlyRate = { $lte: parseFloat(maxRate) };
    }

    // Availability filter (simplified for now)
    if (availability) {
      query.availability = { $exists: true };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Set sorting
    let sortOptions = {};
    switch (sortBy) {
      case 'price':
        sortOptions = { hourlyRate: 1 };
        break;
      case 'reviews':
        sortOptions = { totalReviews: -1 };
        break;
      case 'recent':
        sortOptions = { lastActive: -1 };
        break;
      default:
        sortOptions = { rating: -1, totalReviews: -1 };
    }

    const mentors = await User.find(query)
      .select('-password -email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    // Get mentor statistics
    const stats = await User.aggregate([
      { $match: { role: 'mentor', isActive: true } },
      {
        $group: {
          _id: null,
          totalMentors: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          avgRate: { $avg: '$hourlyRate' },
          topSkills: { $push: '$skills' }
        }
      }
    ]);

    const topSkills = stats.length > 0 ? 
      stats[0].topSkills.flat().reduce((acc, skill) => {
        acc[skill] = (acc[skill] || 0) + 1;
        return acc;
      }, {}) : {};

    res.json({
      success: true,
      data: {
        mentors: mentors.map(mentor => mentor.getPublicProfile()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        stats: {
          totalMentors: stats.length > 0 ? stats[0].totalMentors : 0,
          avgRating: stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0,
          avgRate: stats.length > 0 ? Math.round(stats[0].avgRate * 100) / 100 : 0,
          topSkills: Object.entries(topSkills)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([skill, count]) => ({ skill, count }))
        }
      }
    });
  } catch (error) {
    console.error('Get mentors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/mentors/stats
// @desc    Get mentor statistics (mentor-only)
// @access  Private (Mentor only)
router.get('/stats', protect, authorizeMentor, async (req, res) => {
  try {
    const mentorId = req.user._id;
    
    // Get mentor statistics
    const totalSessions = await Session.countDocuments({ mentorId });
    const completedSessions = await Session.countDocuments({ 
      mentorId, 
      status: 'completed' 
    });
    const avgRating = await Review.aggregate([
      { $match: { mentorId } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    
    const stats = {
      totalSessions,
      completedSessions,
      averageRating: avgRating.length > 0 ? avgRating[0].avgRating : 0,
      totalEarnings: completedSessions * (req.user.hourlyRate || 0)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get mentor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/mentors/students
// @desc    Get mentor's students list
// @access  Private (Mentor only)
router.get('/students', protect, authorizeMentor, async (req, res) => {
  try {
    const mentorId = req.user._id;
    
    // Find all sessions where this mentor worked with students
    const sessions = await Session.find({ 
      mentor: mentorId,
      status: { $in: ['completed', 'scheduled'] }
    })
    .populate('students', 'firstName lastName email profilePicture')
    .sort({ createdAt: -1 });
    
    // Get unique students
    const studentsMap = new Map();
    sessions.forEach(session => {
      if (session.students && session.students.length > 0) {
        session.students.forEach(student => {
          if (!studentsMap.has(student._id.toString())) {
            studentsMap.set(student._id.toString(), {
              _id: student._id,
              firstName: student.firstName,
              lastName: student.lastName,
              email: student.email,
              profilePicture: student.profilePicture,
              totalSessions: 1,
              lastSessionDate: session.date || session.createdAt
            });
          } else {
            const existing = studentsMap.get(student._id.toString());
            existing.totalSessions++;
            if (session.date > existing.lastSessionDate) {
              existing.lastSessionDate = session.date;
            }
          }
        });
      }
    });
    
    const students = Array.from(studentsMap.values()).sort((a, b) => 
      new Date(b.lastSessionDate) - new Date(a.lastSessionDate)
    );

    res.json({
      success: true,
      data: {
        students,
        totalStudents: students.length,
        totalSessions: sessions.length
      }
    });
  } catch (error) {
    console.error('Get mentor students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/mentors/recommended
// @desc    Get recommended mentors for student
// @access  Private
router.get('/recommended', protect, async (req, res) => {
  try {
    const mentors = await User.find({
      role: 'mentor',
      isApproved: true
    })
    .select('firstName lastName skills rating totalReviews hourlyRate location profilePicture bio')
    .limit(6)
    .sort({ rating: -1, totalReviews: -1 });

    res.json({
      success: true,
      data: {
        mentors: mentors || []
      }
    });
  } catch (error) {
    console.error('Get recommended mentors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/mentors/:id
// @desc    Get mentor profile and details
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    // Skip ObjectId validation for 'recommended' path
    if (req.params.id === 'recommended') {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mentor ID'
      });
    }

    const mentor = await User.findOne({ 
      _id: req.params.id, 
      role: 'mentor', 
      isActive: true 
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    // Get mentor's recent reviews
    const reviews = await Review.find({
      revieweeId: mentor._id,
      isPublic: true
    })
    .populate('reviewerId', 'firstName lastName username profilePicture')
    .populate('sessionId', 'title subject scheduledAt')
    .sort({ createdAt: -1 })
    .limit(5);

    // Get mentor's session stats
    const sessionStats = await Session.aggregate([
      { $match: { mentorId: new mongoose.Types.ObjectId(mentor._id), status: 'completed' } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          subjects: { $push: '$subject' },
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    const subjects = sessionStats.length > 0 ?
      sessionStats[0].subjects.reduce((acc, subject) => {
        acc[subject] = (acc[subject] || 0) + 1;
        return acc;
      }, {}) : {};

    const mentorData = {
      ...mentor.getPublicProfile(),
      reviews,
      sessionStats: {
        totalSessions: sessionStats.length > 0 ? sessionStats[0].totalSessions : 0,
        avgDuration: sessionStats.length > 0 ? Math.round(sessionStats[0].avgDuration) : 0,
        topSubjects: Object.entries(subjects)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([subject, count]) => ({ subject, count }))
      }
    };

    res.json({
      success: true,
      data: mentorData
    });
  } catch (error) {
    console.error('Get mentor profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/mentors/:id/availability
// @desc    Get mentor's availability schedule
// @access  Public
router.get('/:id/availability', async (req, res) => {
  try {
    const mentor = await User.findOne({ 
      _id: req.params.id, 
      role: 'mentor', 
      isActive: true 
    }).select('availability timezone');

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    // Get upcoming booked sessions for this mentor
    const bookedSessions = await Session.find({
      mentorId: mentor._id,
      status: { $in: ['confirmed', 'pending'] },
      scheduledAt: { $gte: new Date() }
    }).select('scheduledAt duration');

    res.json({
      success: true,
      data: {
        availability: mentor.availability || {},
        timezone: mentor.timezone || 'UTC',
        bookedSessions: bookedSessions.map(session => ({
          start: session.scheduledAt,
          end: new Date(session.scheduledAt.getTime() + session.duration * 60000)
        }))
      }
    });
  } catch (error) {
    console.error('Get mentor availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/mentors/profile
// @desc    Update mentor profile (mentor only)
// @access  Private
router.put('/profile', protect, authorize('mentor'), [
  body('bio').optional().isLength({ max: 1000 }),
  body('skills').optional().isArray(),
  body('experience').optional().isLength({ max: 2000 }),
  body('education').optional().isLength({ max: 1000 }),
  body('hourlyRate').optional().isFloat({ min: 0 }),
  body('availability').optional().isObject(),
  body('timezone').optional().isString()
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

    const allowedUpdates = [
      'bio', 'skills', 'experience', 'education', 
      'hourlyRate', 'availability', 'timezone'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const mentor = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Mentor profile updated successfully',
      data: mentor.getFullProfile()
    });
  } catch (error) {
    console.error('Update mentor profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/mentors/dashboard/stats
// @desc    Get mentor dashboard statistics
// @access  Private (Mentor only)
router.get('/dashboard/stats', protect, authorize('mentor'), async (req, res) => {
  try {
    const mentorId = req.user._id;

    // Get session statistics
    const sessionStats = await Session.aggregate([
      { $match: { mentorId: new mongoose.Types.ObjectId(mentorId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalEarnings: { $sum: '$price' }
        }
      }
    ]);

    // Get monthly session counts
    const monthlyStats = await Session.aggregate([
      { 
        $match: { 
          mentorId: new mongoose.Types.ObjectId(mentorId),
          scheduledAt: { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$scheduledAt' },
            month: { $month: '$scheduledAt' }
          },
          sessions: { $sum: 1 },
          earnings: { $sum: '$price' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get recent reviews
    const recentReviews = await Review.find({
      revieweeId: mentorId
    })
    .populate('reviewerId', 'firstName lastName username')
    .populate('sessionId', 'title subject')
    .sort({ createdAt: -1 })
    .limit(5);

    // Get pending session requests
    const pendingRequests = await mongoose.model('SessionRequest').countDocuments({
      mentorId,
      status: 'pending'
    });

    const stats = {
      sessions: sessionStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        acc.totalEarnings = (acc.totalEarnings || 0) + (stat.totalEarnings || 0);
        return acc;
      }, {}),
      monthlyStats,
      recentReviews,
      pendingRequests,
      rating: req.user.rating,
      totalReviews: req.user.totalReviews
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get mentor dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/mentors/verify
// @desc    Request mentor verification
// @access  Private (Mentor only)
router.post('/verify', protect, authorize('mentor'), [
  body('linkedinProfile').optional().isURL(),
  body('credentials').optional().isArray(),
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

    // For now, just update the profile with verification request info
    const { linkedinProfile, credentials, message } = req.body;

    const updates = {};
    if (linkedinProfile) updates.linkedinProfile = linkedinProfile;

    await User.findByIdAndUpdate(req.user._id, updates);

    // In a real application, this would trigger an admin review process
    res.json({
      success: true,
      message: 'Verification request submitted successfully. You will be notified once reviewed.'
    });
  } catch (error) {
    console.error('Mentor verification request error:', error);
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
    message: 'Mentor routes working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;