const mongoose = require('mongoose');
const Session = require('../../models/Session');
const User = require('../../models/User');

describe('Session Model', () => {

  let mentor, student;

  beforeEach(async () => {
    const mentorData = testUtils.createValidUser({
      email: 'mentor@test.com',
      username: 'mentor',
      role: 'mentor'
    });
    mentor = new User(mentorData);
    await mentor.save();

    const studentData = testUtils.createValidUser({
      email: 'student@test.com',
      username: 'student',
      role: 'student'
    });
    student = new User(studentData);
    await student.save();
  });

  describe('Schema Validation', () => {
    test('should create a valid session with required fields', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      await expect(session.save()).resolves.toEqual(expect.objectContaining({
        _id: expect.any(mongoose.Types.ObjectId),
        title: sessionData.title,
        description: sessionData.description,
        mentorId: sessionData.mentorId,
        studentId: sessionData.studentId,
        scheduledAt: sessionData.scheduledAt,
        duration: sessionData.duration,
        meetLink: sessionData.meetLink,
        status: 'scheduled'
      }));
    });

    test('should require title field', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id, { title: undefined });
      const session = new Session(sessionData);
      await expect(session.save()).rejects.toThrow(/title.*required/i);
    });

    test('should require description field', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id, { description: undefined });
      const session = new Session(sessionData);
      await expect(session.save()).rejects.toThrow(/description.*required/i);
    });

    test('should require mentorId field', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id, { mentorId: undefined });
      const session = new Session(sessionData);
      await expect(session.save()).rejects.toThrow(/mentorId.*required/i);
    });

    test('should require scheduledAt field', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id, { scheduledAt: undefined });
      const session = new Session(sessionData);
      await expect(session.save()).rejects.toThrow(/scheduledAt.*required/i);
    });

    test('should require meetLink field', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id, { meetLink: undefined });
      const session = new Session(sessionData);
      await expect(session.save()).rejects.toThrow(/meetLink.*required/i);
    });

    test('should validate status enum values', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id, { status: 'invalid_status' });
      const session = new Session(sessionData);
      await expect(session.save()).rejects.toThrow(/status.*not a valid enum value/i);
    });

    test('should accept valid status values', async () => {
      const statuses = ['scheduled', 'active', 'completed', 'cancelled'];
      for (let i = 0; i < statuses.length; i++) {
        const sessionData = testUtils.createValidSession(mentor._id, student._id, { 
          status: statuses[i],
          title: `Session ${i}`,
          meetLink: `https://meet.google.com/test-${i}`
        });
        const session = new Session(sessionData);
        await expect(session.save()).resolves.toBeTruthy();
      }
    });

    test('should trim whitespace from string fields', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id, {
        title: '  Test Session  ',
        description: '  Session description  ',
        notes: '  Session notes  '
      });
      const session = new Session(sessionData);
      await session.save();

      expect(session.title).toBe('Test Session');
      expect(session.description).toBe('Session description');
      expect(session.notes).toBe('Session notes');
    });
  });

  describe('Default Values', () => {
    test('should set default values correctly', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      await session.save();

      expect(session.status).toBe('scheduled');
      expect(session.notes).toBe('');
      expect(session.materials).toEqual([]);
      expect(session.reviews).toEqual([]);
      expect(session.duration).toBe(60);
    });

    test('should allow null studentId for open sessions', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, null);
      const session = new Session(sessionData);
      await session.save();

      expect(session.studentId).toBeNull();
      expect(session.mentorId).toEqual(mentor._id);
    });
  });

  describe('References', () => {
    test('should populate mentor reference', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      await session.save();

      const populatedSession = await Session.findById(session._id).populate('mentorId');
      expect(populatedSession.mentorId.email).toBe(mentor.email);
      expect(populatedSession.mentorId.role).toBe('mentor');
    });

    test('should populate student reference when not null', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      await session.save();

      const populatedSession = await Session.findById(session._id).populate('studentId');
      expect(populatedSession.studentId.email).toBe(student.email);
      expect(populatedSession.studentId.role).toBe('student');
    });

    test('should handle invalid ObjectId references', async () => {
      const invalidId = new mongoose.Types.ObjectId();
      const sessionData = testUtils.createValidSession(invalidId, student._id);
      const session = new Session(sessionData);
      await session.save();

      // Should save but not populate invalid reference
      const populatedSession = await Session.findById(session._id).populate('mentorId');
      expect(populatedSession.mentorId).toBeNull();
    });
  });

  describe('Materials Array', () => {
    test('should handle materials array correctly', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      
      session.materials = [
        {
          name: 'Lecture Notes',
          url: 'https://example.com/notes.pdf'
        },
        {
          name: 'Practice Problems',
          url: 'https://example.com/problems.pdf'
        }
      ];

      await session.save();

      expect(session.materials).toHaveLength(2);
      expect(session.materials[0].name).toBe('Lecture Notes');
      expect(session.materials[0].url).toBe('https://example.com/notes.pdf');
      expect(session.materials[0].uploadedAt).toBeInstanceOf(Date);
      expect(session.materials[1].name).toBe('Practice Problems');
    });

    test('should set uploadedAt timestamp for materials', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      
      session.materials.push({
        name: 'Test Material',
        url: 'https://example.com/test.pdf'
      });

      await session.save();

      expect(session.materials[0].uploadedAt).toBeInstanceOf(Date);
      expect(session.materials[0].uploadedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Reviews Array', () => {
    test('should handle reviews array correctly', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      await session.save();

      session.reviews = [
        {
          reviewerId: student._id,
          rating: 5,
          comment: 'Excellent session!'
        },
        {
          reviewerId: mentor._id,
          rating: 4,
          comment: 'Good student, well prepared.'
        }
      ];

      await session.save();

      expect(session.reviews).toHaveLength(2);
      expect(session.reviews[0].reviewerId).toEqual(student._id);
      expect(session.reviews[0].rating).toBe(5);
      expect(session.reviews[0].comment).toBe('Excellent session!');
      expect(session.reviews[0].createdAt).toBeInstanceOf(Date);
    });

    test('should validate review rating range', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      
      session.reviews.push({
        reviewerId: student._id,
        rating: 0, // Invalid: less than minimum
        comment: 'Test review'
      });

      await expect(session.save()).rejects.toThrow(/rating.*Path.*less than minimum/i);

      session.reviews = [{
        reviewerId: student._id,
        rating: 6, // Invalid: greater than maximum
        comment: 'Test review'
      }];

      await expect(session.save()).rejects.toThrow(/rating.*more than maximum/i);
    });

    test('should populate review references', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      
      session.reviews.push({
        reviewerId: student._id,
        rating: 5,
        comment: 'Great session!'
      });

      await session.save();

      const populatedSession = await Session.findById(session._id).populate('reviews.reviewerId');
      expect(populatedSession.reviews[0].reviewerId.email).toBe(student.email);
    });
  });

  describe('Indexes', () => {
    test('should have proper indexes for performance', async () => {
      const indexes = await Session.collection.getIndexes();
      
      // Check for compound index on mentorId and scheduledAt
      const mentorScheduleIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'mentorId' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'scheduledAt' && field[1] === 1)
      );
      expect(mentorScheduleIndex).toBeTruthy();

      // Check for compound index on studentId and scheduledAt
      const studentScheduleIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'studentId' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'scheduledAt' && field[1] === 1)
      );
      expect(studentScheduleIndex).toBeTruthy();

      // Check for status index
      const statusIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'status' && field[1] === 1)
      );
      expect(statusIndex).toBeTruthy();
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt timestamps', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      await session.save();

      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(session.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should update updatedAt on modification', async () => {
      const sessionData = testUtils.createValidSession(mentor._id, student._id);
      const session = new Session(sessionData);
      await session.save();

      const originalUpdatedAt = session.updatedAt;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      session.status = 'completed';
      await session.save();

      expect(session.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Date Validation', () => {
    test('should accept valid future dates for scheduling', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
      const sessionData = testUtils.createValidSession(mentor._id, student._id, {
        scheduledAt: futureDate
      });
      const session = new Session(sessionData);
      await expect(session.save()).resolves.toBeTruthy();
      expect(session.scheduledAt).toEqual(futureDate);
    });

    test('should accept past dates for completed sessions', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const sessionData = testUtils.createValidSession(mentor._id, student._id, {
        scheduledAt: pastDate,
        status: 'completed'
      });
      const session = new Session(sessionData);
      await expect(session.save()).resolves.toBeTruthy();
      expect(session.scheduledAt).toEqual(pastDate);
    });
  });

  describe('Query Performance', () => {
    test('should efficiently query sessions by mentor and date range', async () => {
      // Create multiple sessions for testing
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const sessionData = testUtils.createValidSession(mentor._id, student._id, {
          title: `Session ${i}`,
          scheduledAt: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
          meetLink: `https://meet.google.com/test-${i}`
        });
        const session = new Session(sessionData);
        await session.save();
        sessions.push(session);
      }

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const foundSessions = await Session.find({
        mentorId: mentor._id,
        scheduledAt: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ scheduledAt: 1 });

      expect(foundSessions.length).toBeGreaterThan(0);
      expect(foundSessions.length).toBeLessThanOrEqual(4); // Should exclude sessions beyond the date range
    });

    test('should efficiently query sessions by status', async () => {
      // Create sessions with different statuses
      const statuses = ['scheduled', 'active', 'completed', 'cancelled'];
      for (let i = 0; i < statuses.length; i++) {
        const sessionData = testUtils.createValidSession(mentor._id, student._id, {
          title: `Session ${i}`,
          status: statuses[i],
          meetLink: `https://meet.google.com/test-${i}`
        });
        const session = new Session(sessionData);
        await session.save();
      }

      const activeSessions = await Session.find({ status: 'active' });
      const completedSessions = await Session.find({ status: 'completed' });

      expect(activeSessions).toHaveLength(1);
      expect(completedSessions).toHaveLength(1);
      expect(activeSessions[0].status).toBe('active');
      expect(completedSessions[0].status).toBe('completed');
    });
  });
});