const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// @route   GET /api/experience
// @desc    Get current user's experience
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('experience');
    res.json({
      success: true,
      data: user.experience || { years: 0, description: '', workHistory: [] }
    });
  } catch (error) {
    console.error('Get experience error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/experience
// @desc    Update experience summary
// @access  Private
router.put('/', [
  protect,
  body('years').optional().isInt({ min: 0, max: 50 }).withMessage('Years must be between 0 and 50'),
  body('description').optional().trim().isLength({ max: 2000 }).withMessage('Description must be less than 2000 characters')
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

    const user = await User.findById(req.user._id);
    
    if (!user.experience) {
      user.experience = { years: 0, description: '', workHistory: [] };
    }

    if (req.body.years !== undefined) user.experience.years = req.body.years;
    if (req.body.description !== undefined) user.experience.description = req.body.description;

    await user.save();

    res.json({
      success: true,
      message: 'Experience updated successfully',
      data: user.experience
    });
  } catch (error) {
    console.error('Update experience error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/experience/work
// @desc    Add work experience entry
// @access  Private
router.post('/work', [
  protect,
  body('company').trim().isLength({ min: 1, max: 200 }).withMessage('Company name is required and must be less than 200 characters'),
  body('position').trim().isLength({ min: 1, max: 100 }).withMessage('Position is required and must be less than 100 characters'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('current').optional().isBoolean().withMessage('Current must be boolean'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters')
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

    const user = await User.findById(req.user._id);
    
    if (!user.experience) {
      user.experience = { years: 0, description: '', workHistory: [] };
    }
    if (!user.experience.workHistory) {
      user.experience.workHistory = [];
    }

    const workEntry = {
      company: req.body.company,
      position: req.body.position,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      current: req.body.current || false,
      description: req.body.description
    };

    user.experience.workHistory.push(workEntry);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Work experience added successfully',
      data: user.experience.workHistory
    });
  } catch (error) {
    console.error('Add work experience error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/experience/work/:workId
// @desc    Update work experience entry
// @access  Private
router.put('/work/:workId', [
  protect,
  body('company').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Company name must be less than 200 characters'),
  body('position').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Position must be less than 100 characters'),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('current').optional().isBoolean().withMessage('Current must be boolean'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters')
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

    const user = await User.findById(req.user._id);
    
    if (!user.experience || !user.experience.workHistory) {
      return res.status(404).json({
        success: false,
        message: 'Work experience not found'
      });
    }

    const work = user.experience.workHistory.id(req.params.workId);
    if (!work) {
      return res.status(404).json({
        success: false,
        message: 'Work experience entry not found'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        if (key === 'startDate' || key === 'endDate') {
          work[key] = req.body[key] ? new Date(req.body[key]) : undefined;
        } else {
          work[key] = req.body[key];
        }
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'Work experience updated successfully',
      data: user.experience.workHistory
    });
  } catch (error) {
    console.error('Update work experience error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/experience/work/:workId
// @desc    Delete work experience entry
// @access  Private
router.delete('/work/:workId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.experience || !user.experience.workHistory) {
      return res.status(404).json({
        success: false,
        message: 'Work experience not found'
      });
    }

    const work = user.experience.workHistory.id(req.params.workId);
    if (!work) {
      return res.status(404).json({
        success: false,
        message: 'Work experience entry not found'
      });
    }

    work.remove();
    await user.save();

    res.json({
      success: true,
      message: 'Work experience deleted successfully',
      data: user.experience.workHistory
    });
  } catch (error) {
    console.error('Delete work experience error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/experience/work/:workId
// @desc    Get specific work experience entry
// @access  Private
router.get('/work/:workId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.experience || !user.experience.workHistory) {
      return res.status(404).json({
        success: false,
        message: 'Work experience not found'
      });
    }

    const work = user.experience.workHistory.id(req.params.workId);
    if (!work) {
      return res.status(404).json({
        success: false,
        message: 'Work experience entry not found'
      });
    }

    res.json({
      success: true,
      data: work
    });
  } catch (error) {
    console.error('Get work experience error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/experience/work
// @desc    Get all work experience entries
// @access  Private
router.get('/work', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('experience.workHistory');
    res.json({
      success: true,
      data: user.experience?.workHistory || []
    });
  } catch (error) {
    console.error('Get work history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;