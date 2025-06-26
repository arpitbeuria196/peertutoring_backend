const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Session = require('../models/Session');
const { protect } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /search/mentors:
 *   get:
 *     summary: Search for mentors with advanced filtering
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for name, skills, or specializations
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *         description: Comma-separated list of skills
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Minimum rating filter
 *       - in: query
 *         name: maxRate
 *         schema:
 *           type: number
 *         description: Maximum hourly rate
 *       - in: query
 *         name: minRate
 *         schema:
 *           type: number
 *         description: Minimum hourly rate
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Location filter (city, state, or country)
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *         description: Timezone preference
 *       - in: query
 *         name: experience
 *         schema:
 *           type: number
 *         description: Minimum years of experience
 *       - in: query
 *         name: availability
 *         schema:
 *           type: string
 *         description: Day of week for availability (monday, tuesday, etc.)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [rating, rate, experience, sessions]
 *           default: rating
 *         description: Sort criteria
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Results per page
 *     responses:
 *       200:
 *         description: List of matching mentors
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
 *                     mentors:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 */
router.get('/mentors', protect, [
  query('minRating').optional().isFloat({ min: 0, max: 5 }),
  query('maxRate').optional().isFloat({ min: 0 }),
  query('minRate').optional().isFloat({ min: 0 }),
  query('experience').optional().isInt({ min: 0 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('sortBy').optional().isIn(['rating', 'rate', 'experience', 'sessions']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
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
      q,
      skills,
      minRating = 0,
      maxRate,
      minRate,
      location,
      timezone,
      experience,
      availability,
      sortBy = 'rating',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build search filter
    const filter = {
      role: 'mentor',
      isApproved: true,
      isActive: true
    };

    // Text search across multiple fields
    if (q) {
      filter.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } },
        { company: { $regex: q, $options: 'i' } },
        { about: { $regex: q, $options: 'i' } },
        { 'skills.name': { $regex: q, $options: 'i' } },
        { specializations: { $regex: q, $options: 'i' } }
      ];
    }

    // Skills filter
    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      filter['skills.name'] = { $in: skillsArray.map(skill => new RegExp(skill, 'i')) };
    }

    // Rating filter
    if (minRating > 0) {
      filter.rating = { $gte: parseFloat(minRating) };
    }

    // Rate filters
    if (minRate || maxRate) {
      filter.hourlyRate = {};
      if (minRate) filter.hourlyRate.$gte = parseFloat(minRate);
      if (maxRate) filter.hourlyRate.$lte = parseFloat(maxRate);
    }

    // Location filter
    if (location) {
      filter.$or = filter.$or || [];
      filter.$or.push(
        { 'location.city': { $regex: location, $options: 'i' } },
        { 'location.state': { $regex: location, $options: 'i' } },
        { 'location.country': { $regex: location, $options: 'i' } }
      );
    }

    // Timezone filter
    if (timezone) {
      filter['location.timezone'] = timezone;
    }

    // Experience filter
    if (experience) {
      filter['experience.years'] = { $gte: parseInt(experience) };
    }

    // Availability filter
    if (availability) {
      filter[`availability.${availability.toLowerCase()}`] = { $exists: true, $ne: [] };
    }

    // Build sort criteria
    const sortCriteria = {};
    switch (sortBy) {
      case 'rating':
        sortCriteria.rating = sortOrder === 'asc' ? 1 : -1;
        sortCriteria.totalReviews = -1; // Secondary sort by review count
        break;
      case 'rate':
        sortCriteria.hourlyRate = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'experience':
        sortCriteria['experience.years'] = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'sessions':
        sortCriteria.totalSessions = sortOrder === 'asc' ? 1 : -1;
        break;
      default:
        sortCriteria.rating = -1;
    }

    // Execute search with pagination
    const skip = (page - 1) * limit;
    const mentors = await User.find(filter)
      .select('-password -documents -approvedBy -rejectionReason')
      .sort(sortCriteria)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await User.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        mentors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages
        }
      }
    });

  } catch (error) {
    console.error('Search mentors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during search'
    });
  }
});

/**
 * @swagger
 * /search/students:
 *   get:
 *     summary: Search for students (mentor access only)
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for name or skills
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *         description: Comma-separated list of skills they want to learn
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Location filter
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
 *         description: List of matching students
 */
router.get('/students', protect, async (req, res) => {
  try {
    // Only mentors and admins can search students
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Mentors only.'
      });
    }

    const { q, skills, location, page = 1, limit = 20 } = req.query;

    const filter = {
      role: 'student',
      isApproved: true,
      isActive: true
    };

    if (q) {
      filter.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { about: { $regex: q, $options: 'i' } }
      ];
    }

    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      filter['skills.name'] = { $in: skillsArray.map(skill => new RegExp(skill, 'i')) };
    }

    if (location) {
      filter.$or = filter.$or || [];
      filter.$or.push(
        { 'location.city': { $regex: location, $options: 'i' } },
        { 'location.state': { $regex: location, $options: 'i' } },
        { 'location.country': { $regex: location, $options: 'i' } }
      );
    }

    const skip = (page - 1) * limit;
    const students = await User.find(filter)
      .select('-password -documents -approvedBy -rejectionReason')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        students,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages
        }
      }
    });

  } catch (error) {
    console.error('Search students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during search'
    });
  }
});

/**
 * @swagger
 * /search/sessions:
 *   get:
 *     summary: Search user's sessions with filters
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *         description: Session status filter
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Subject or topic filter
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions until this date
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
 *         description: List of matching sessions
 */
router.get('/sessions', protect, async (req, res) => {
  try {
    const { status, subject, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

    const filter = {
      $or: [
        { student: req.user._id },
        { mentor: req.user._id }
      ]
    };

    if (status) {
      filter.status = status;
    }

    if (subject) {
      filter.$or = [
        { subject: { $regex: subject, $options: 'i' } },
        { description: { $regex: subject, $options: 'i' } }
      ];
    }

    if (dateFrom || dateTo) {
      filter.scheduledDate = {};
      if (dateFrom) filter.scheduledDate.$gte = new Date(dateFrom);
      if (dateTo) filter.scheduledDate.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const sessions = await Session.find(filter)
      .populate('student', 'firstName lastName profilePicture')
      .populate('mentor', 'firstName lastName profilePicture title')
      .sort({ scheduledDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Session.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages
        }
      }
    });

  } catch (error) {
    console.error('Search sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during search'
    });
  }
});

module.exports = router;