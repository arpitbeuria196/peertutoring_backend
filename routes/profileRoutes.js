const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 */
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /profile/basic:
 *   put:
 *     summary: Update basic profile information
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 maxLength: 50
 *               lastName:
 *                 type: string
 *                 maxLength: 50
 *               about:
 *                 type: string
 *                 maxLength: 2000
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               company:
 *                 type: string
 *                 maxLength: 200
 *               bio:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 */
router.put('/basic', protect, [
  body('firstName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('lastName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('about').optional().isLength({ max: 2000 }).trim(),
  body('title').optional().isLength({ max: 200 }).trim(),
  body('company').optional().isLength({ max: 200 }).trim(),
  body('bio').optional().isLength({ max: 1000 }).trim()
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

    const allowedFields = ['firstName', 'lastName', 'about', 'title', 'company', 'bio'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update basic profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /profile/contact:
 *   put:
 *     summary: Update contact information
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               linkedin:
 *                 type: string
 *               github:
 *                 type: string
 *               portfolio:
 *                 type: string
 *               website:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   country:
 *                     type: string
 *                   timezone:
 *                     type: string
 *     responses:
 *       200:
 *         description: Contact information updated successfully
 */
router.put('/contact', protect, [
  body('phone').optional().isLength({ max: 20 }),
  body('linkedin').optional().isURL(),
  body('github').optional().isURL(),
  body('portfolio').optional().isURL(),
  body('website').optional().isURL(),
  body('location.city').optional().isLength({ max: 100 }),
  body('location.state').optional().isLength({ max: 100 }),
  body('location.country').optional().isLength({ max: 100 }),
  body('location.timezone').optional().isLength({ max: 50 })
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

    const updates = {};
    
    // Handle contact info
    if (req.body.phone !== undefined) updates['contactInfo.phone'] = req.body.phone;
    if (req.body.linkedin !== undefined) updates['contactInfo.linkedin'] = req.body.linkedin;
    if (req.body.github !== undefined) updates['contactInfo.github'] = req.body.github;
    if (req.body.portfolio !== undefined) updates['contactInfo.portfolio'] = req.body.portfolio;
    if (req.body.website !== undefined) updates['contactInfo.website'] = req.body.website;

    // Handle location
    if (req.body.location) {
      if (req.body.location.city !== undefined) updates['location.city'] = req.body.location.city;
      if (req.body.location.state !== undefined) updates['location.state'] = req.body.location.state;
      if (req.body.location.country !== undefined) updates['location.country'] = req.body.location.country;
      if (req.body.location.timezone !== undefined) updates['location.timezone'] = req.body.location.timezone;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Contact information updated successfully',
      user
    });
  } catch (error) {
    console.error('Update contact info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /profile/skills:
 *   put:
 *     summary: Update skills and specializations
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               skills:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     level:
 *                       type: string
 *                       enum: [beginner, intermediate, advanced, expert]
 *               specializations:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Skills updated successfully
 */
router.put('/skills', protect, [
  body('skills').optional().isArray(),
  body('skills.*.name').notEmpty().isLength({ max: 100 }),
  body('skills.*.level').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
  body('specializations').optional().isArray(),
  body('specializations.*').isLength({ max: 100 })
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

    const updates = {};
    
    if (req.body.skills !== undefined) {
      updates.skills = req.body.skills.map(skill => ({
        name: skill.name,
        level: skill.level || 'intermediate',
        verified: skill.verified || false
      }));
    }
    
    if (req.body.specializations !== undefined) {
      updates.specializations = req.body.specializations;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Skills updated successfully',
      user
    });
  } catch (error) {
    console.error('Update skills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /profile/experience:
 *   put:
 *     summary: Update experience and work history
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               experience:
 *                 type: object
 *                 properties:
 *                   years:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 50
 *                   description:
 *                     type: string
 *                     maxLength: 2000
 *                   workHistory:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         company:
 *                           type: string
 *                         position:
 *                           type: string
 *                         startDate:
 *                           type: string
 *                           format: date
 *                         endDate:
 *                           type: string
 *                           format: date
 *                         description:
 *                           type: string
 *                         current:
 *                           type: boolean
 *     responses:
 *       200:
 *         description: Experience updated successfully
 */
router.put('/experience', protect, [
  body('experience.years').optional().isInt({ min: 0, max: 50 }),
  body('experience.description').optional().isLength({ max: 2000 }),
  body('experience.workHistory').optional().isArray(),
  body('experience.workHistory.*.company').optional().isLength({ max: 200 }),
  body('experience.workHistory.*.position').optional().isLength({ max: 200 }),
  body('experience.workHistory.*.description').optional().isLength({ max: 1000 }),
  body('experience.workHistory.*.current').optional().isBoolean()
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

    const updates = {};
    
    if (req.body.experience) {
      updates.experience = req.body.experience;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Experience updated successfully',
      user
    });
  } catch (error) {
    console.error('Update experience error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /profile/education:
 *   put:
 *     summary: Update education information
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               education:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [institution]
 *                   properties:
 *                     institution:
 *                       type: string
 *                     degree:
 *                       type: string
 *                     field:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                       format: date
 *                     endDate:
 *                       type: string
 *                       format: date
 *                     gpa:
 *                       type: number
 *                     current:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Education updated successfully
 */
router.put('/education', protect, [
  body('education').isArray(),
  body('education.*.institution').notEmpty().isLength({ max: 200 }),
  body('education.*.degree').optional().isLength({ max: 200 }),
  body('education.*.field').optional().isLength({ max: 200 }),
  body('education.*.gpa').optional().isFloat({ min: 0, max: 4.0 }),
  body('education.*.current').optional().isBoolean()
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

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { education: req.body.education },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Education updated successfully',
      user
    });
  } catch (error) {
    console.error('Update education error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /profile/pricing:
 *   put:
 *     summary: Update pricing information (mentors only)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hourlyRate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1000
 *               currency:
 *                 type: string
 *                 enum: [USD, EUR, GBP, CAD, AUD]
 *     responses:
 *       200:
 *         description: Pricing updated successfully
 *       403:
 *         description: Access denied - mentors only
 */
router.put('/pricing', protect, [
  body('hourlyRate').isFloat({ min: 0, max: 1000 }),
  body('currency').optional().isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD'])
], async (req, res) => {
  try {
    // Only mentors can set pricing
    if (req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only mentors can set pricing.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const updates = {
      hourlyRate: req.body.hourlyRate
    };

    if (req.body.currency) {
      updates.currency = req.body.currency;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Pricing updated successfully',
      user
    });
  } catch (error) {
    console.error('Update pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /profile/availability:
 *   put:
 *     summary: Update availability schedule
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               availability:
 *                 type: object
 *                 additionalProperties:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       start:
 *                         type: string
 *                         pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                       end:
 *                         type: string
 *                         pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *     responses:
 *       200:
 *         description: Availability updated successfully
 */
router.put('/availability', protect, async (req, res) => {
  try {
    const { availability } = req.body;

    // Validate availability format
    if (availability && typeof availability === 'object') {
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

      for (const day in availability) {
        if (!validDays.includes(day.toLowerCase())) {
          return res.status(400).json({
            success: false,
            message: `Invalid day: ${day}`
          });
        }

        if (Array.isArray(availability[day])) {
          for (const slot of availability[day]) {
            if (!slot.start || !slot.end || !timeRegex.test(slot.start) || !timeRegex.test(slot.end)) {
              return res.status(400).json({
                success: false,
                message: 'Invalid time format. Use HH:MM format.'
              });
            }
          }
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { availability: availability || {} },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Availability updated successfully',
      user
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /profile/{userId}:
 *   get:
 *     summary: Get public profile of any user
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Public user profile
 *       404:
 *         description: User not found
 */
router.get('/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -documents -approvedBy -rejectionReason -email')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;