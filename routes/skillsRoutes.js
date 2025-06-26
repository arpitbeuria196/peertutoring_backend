const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// @route   GET /api/skills
// @desc    Get current user's skills
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('skills');
    res.json({
      success: true,
      data: user.skills || []
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/skills
// @desc    Add a skill
// @access  Private
router.post('/', [
  protect,
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Skill name must be 1-100 characters'),
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid skill level')
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

    const { name, level = 'intermediate' } = req.body;

    const user = await User.findById(req.user._id);
    
    // Check if skill already exists
    const existingSkill = user.skills.find(skill => 
      skill.name.toLowerCase() === name.toLowerCase()
    );

    if (existingSkill) {
      return res.status(400).json({
        success: false,
        message: 'Skill already exists'
      });
    }

    // Add new skill
    user.skills.push({
      name: name,
      level: level,
      verified: false
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Skill added successfully',
      data: user.skills
    });
  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/skills/:skillId
// @desc    Update a skill
// @access  Private
router.put('/:skillId', [
  protect,
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Skill name must be 1-100 characters'),
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid skill level')
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
    const skill = user.skills.id(req.params.skillId);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    // Update skill fields
    if (req.body.name) skill.name = req.body.name;
    if (req.body.level) skill.level = req.body.level;

    await user.save();

    res.json({
      success: true,
      message: 'Skill updated successfully',
      data: user.skills
    });
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/skills/:skillId
// @desc    Delete a skill
// @access  Private
router.delete('/:skillId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const skill = user.skills.id(req.params.skillId);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    skill.remove();
    await user.save();

    res.json({
      success: true,
      message: 'Skill deleted successfully',
      data: user.skills
    });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/skills/bulk
// @desc    Add multiple skills from comma-separated string
// @access  Private
router.post('/bulk', [
  protect,
  body('skills').isString().withMessage('Skills must be a string')
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

    const skillNames = req.body.skills.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    if (skillNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid skills provided'
      });
    }

    const user = await User.findById(req.user._id);
    
    const newSkills = [];
    skillNames.forEach(name => {
      const existingSkill = user.skills.find(skill => 
        skill.name.toLowerCase() === name.toLowerCase()
      );
      
      if (!existingSkill && name.length <= 100) {
        newSkills.push({
          name: name,
          level: 'intermediate',
          verified: false
        });
      }
    });

    if (newSkills.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All skills already exist or are invalid'
      });
    }

    user.skills.push(...newSkills);
    await user.save();

    res.json({
      success: true,
      message: `${newSkills.length} skills added successfully`,
      data: user.skills
    });
  } catch (error) {
    console.error('Bulk add skills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;