const express = require('express');
const { protect, authorizeStudent, authorizeMentor, authorizeAdmin } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/roleBasedAccess');

const router = express.Router();

// @route   GET /api/dashboard/redirect
// @desc    Redirect user to appropriate dashboard based on role
// @access  Private
router.get('/redirect', protect, (req, res) => {
  const { role } = req.user;
  
  let redirectPath;
  switch (role) {
    case 'admin':
      redirectPath = '/frontend/admin-dashboard.html';
      break;
    case 'mentor':
      redirectPath = '/frontend/mentor-dashboard.html';
      break;
    case 'student':
      redirectPath = '/frontend/student-dashboard.html';
      break;
    default:
      redirectPath = '/frontend/login.html';
  }

  res.json({
    success: true,
    data: {
      role,
      redirectPath,
      dashboardType: role
    }
  });
});

// @route   GET /api/dashboard/permissions
// @desc    Get user's role-based permissions
// @access  Private
router.get('/permissions', protect, (req, res) => {
  const { ROLE_PERMISSIONS } = require('../middlewares/roleBasedAccess');
  const userPermissions = ROLE_PERMISSIONS[req.user.role] || {};

  res.json({
    success: true,
    data: {
      role: req.user.role,
      permissions: userPermissions,
      userId: req.user._id,
      username: req.user.username
    }
  });
});

// @route   GET /api/dashboard/student
// @desc    Get student dashboard data
// @access  Private (Student only)
router.get('/student', protect, authorizeStudent, requirePermission('canViewProfile'), async (req, res) => {
  try {
    const User = require('../models/User');
    const Session = require('../models/Session');
    const SessionRequest = require('../models/SessionRequest');

    // Get student statistics
    const totalSessions = await Session.countDocuments({ studentId: req.user._id });
    const upcomingSessions = await Session.countDocuments({ 
      studentId: req.user._id, 
      status: { $in: ['scheduled', 'confirmed'] }
    });
    const pendingRequests = await SessionRequest.countDocuments({
      studentId: req.user._id,
      status: 'pending'
    });

    // Get recommended mentors (top rated)
    const recommendedMentors = await User.find({
      role: 'mentor',
      isActive: true,
      documentsVerified: true
    })
    .select('firstName lastName username profilePicture rating skills hourlyRate')
    .sort({ rating: -1 })
    .limit(3);

    const dashboardData = {
      stats: {
        totalSessions,
        upcomingSessions,
        pendingRequests,
        completedSessions: await Session.countDocuments({ 
          studentId: req.user._id, 
          status: 'completed' 
        })
      },
      recommendedMentors,
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
        role: req.user.role
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error loading dashboard'
    });
  }
});

// @route   GET /api/dashboard/mentor
// @desc    Get mentor dashboard data
// @access  Private (Mentor only)
router.get('/mentor', protect, authorizeMentor, requirePermission('canViewStats'), async (req, res) => {
  try {
    const Session = require('../models/Session');
    const SessionRequest = require('../models/SessionRequest');
    const Review = require('../models/Review');

    // Get mentor statistics
    const totalSessions = await Session.countDocuments({ mentorId: req.user._id });
    const pendingRequests = await SessionRequest.countDocuments({
      mentorId: req.user._id,
      status: 'pending'
    });
    const todaysSessions = await Session.countDocuments({
      mentorId: req.user._id,
      scheduledDate: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999)
      }
    });

    // Get average rating
    const avgRating = await Review.aggregate([
      { $match: { mentorId: req.user._id } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    const dashboardData = {
      stats: {
        totalSessions,
        pendingRequests,
        todaysSessions,
        averageRating: avgRating.length > 0 ? avgRating[0].avgRating : 0,
        totalEarnings: await Session.countDocuments({ 
          mentorId: req.user._id, 
          status: 'completed' 
        }) * (req.user.hourlyRate || 0)
      },
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
        role: req.user.role,
        hourlyRate: req.user.hourlyRate
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Mentor dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error loading dashboard'
    });
  }
});

// @route   GET /api/dashboard/admin
// @desc    Get admin dashboard data
// @access  Private (Admin only)
router.get('/admin', protect, authorizeAdmin, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const User = require('../models/User');
    const Session = require('../models/Session');
    const Document = require('../models/Document');

    // Get platform statistics
    const totalUsers = await User.countDocuments();
    const pendingApprovals = await User.countDocuments({ documentsVerified: false });
    const totalSessions = await Session.countDocuments();
    const pendingDocuments = await Document.countDocuments({ status: 'pending' });

    // Get user breakdown by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const dashboardData = {
      stats: {
        totalUsers,
        pendingApprovals,
        totalSessions,
        pendingDocuments,
        activeMentors: await User.countDocuments({ 
          role: 'mentor', 
          isActive: true, 
          documentsVerified: true 
        }),
        activeStudents: await User.countDocuments({ 
          role: 'student', 
          isActive: true, 
          documentsVerified: true 
        })
      },
      usersByRole: usersByRole.reduce((obj, item) => {
        obj[item._id] = item.count;
        return obj;
      }, {}),
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
        role: req.user.role
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error loading dashboard'
    });
  }
});

module.exports = router;