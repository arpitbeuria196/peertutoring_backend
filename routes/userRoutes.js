const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const User = require('../models/User');

// @route   GET /api/users/all
// @desc    Get all users for messaging
// @access  Private
router.get('/all', protect, async (req, res) => {
  try {
    const users = await User.find({ 
      status: 'approved',
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('firstName lastName email role')
    .sort({ firstName: 1, lastName: 1 });

    res.json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        totalSessions: user.totalSessions || 0,
        totalReviews: user.totalReviews || 0,
        rating: user.rating || 0,
        documentsVerified: user.documentsVerified || false,
        isApproved: user.isApproved || false
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;