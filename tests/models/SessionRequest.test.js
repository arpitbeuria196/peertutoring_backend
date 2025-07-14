const mongoose = require('mongoose');
const SessionRequest = require('../../models/SessionRequest');
const User = require('../../models/User');

describe('SessionRequest Model', () => {

  let student, mentor;

  beforeEach(async () => {
    const studentData = testUtils.createValidUser({
      email: 'student@test.com',
      username: 'student',
      role: 'student'
    });
    student = new User(studentData);
    await student.save();

    const mentorData = testUtils.createValidUser({
      email: 'mentor@test.com',
      username: 'mentor',
      role: 'mentor'
    });
    mentor = new User(mentorData);
    await mentor.save();
  });

  describe('Schema Validation', () => {
    test('should create a valid session request with required fields', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).resolves.toEqual(expect.objectContaining({
        _id: expect.any(mongoose.Types.ObjectId),
        studentId: requestData.studentId,
        mentorId: requestData.mentorId,
        subject: requestData.subject,
        description: requestData.description,
        duration: requestData.duration,
        preferredTimes: expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(Date),
            timeSlots: expect.arrayContaining([
              expect.objectContaining({
                start: expect.any(String),
                end: expect.any(String)
              })
            ])
          })
        ]),
        status: 'pending'
      }));
    });

    test('should require studentId field', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { studentId: undefined });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/studentId.*required/i);
    });

    test('should require mentorId field', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { mentorId: undefined });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/mentorId.*required/i);
    });

    test('should require subject field', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { subject: undefined });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/subject.*required/i);
    });

    test('should require duration field', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { duration: undefined });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/duration.*required/i);
    });

    test('should enforce maximum subject length', async () => {
      const longSubject = 'a'.repeat(201);
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { subject: longSubject });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/subject.*Path.*longer/i);
    });

    test('should enforce maximum description length', async () => {
      const longDescription = 'a'.repeat(1001);
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { description: longDescription });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/description.*Path.*longer/i);
    });

    test('should enforce minimum duration', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { duration: 10 });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/duration.*Path.*less than minimum/i);
    });

    test('should enforce maximum duration', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { duration: 500 });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/duration.*more than maximum/i);
    });

    test('should accept valid duration values', async () => {
      const validDurations = [15, 30, 60, 90, 120, 240, 480];
      
      for (let i = 0; i < validDurations.length; i++) {
        const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
          duration: validDurations[i],
          subject: `Session ${i} - ${validDurations[i]} minutes`
        });
        const sessionRequest = new SessionRequest(requestData);
        await expect(sessionRequest.save()).resolves.toBeTruthy();
        expect(sessionRequest.duration).toBe(validDurations[i]);
      }
    });

    test('should validate status enum values', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { status: 'invalid_status' });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/status.*not a valid enum value/i);
    });

    test('should accept valid status values', async () => {
      const statuses = ['pending', 'accepted', 'rejected'];
      
      for (let i = 0; i < statuses.length; i++) {
        const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
          status: statuses[i],
          subject: `Session request ${i} - ${statuses[i]}`
        });
        const sessionRequest = new SessionRequest(requestData);
        await expect(sessionRequest.save()).resolves.toBeTruthy();
        expect(sessionRequest.status).toBe(statuses[i]);
      }
    });

    test('should enforce maximum responseMessage length', async () => {
      const longResponseMessage = 'a'.repeat(501);
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { 
        responseMessage: longResponseMessage 
      });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/responseMessage.*Path.*longer/i);
    });

    test('should validate proposedPrice minimum value', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { proposedPrice: -10 });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/proposedPrice.*Path.*less than minimum/i);
    });
  });

  describe('Default Values', () => {
    test('should set default values correctly', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.status).toBe('pending');
      expect(sessionRequest.responseMessage).toBeUndefined();
      expect(sessionRequest.proposedPrice).toBeUndefined();
    });

    test('should allow optional fields to be set', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
        responseMessage: 'I can help you with calculus',
        proposedPrice: 50
      });
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.responseMessage).toBe('I can help you with calculus');
      expect(sessionRequest.proposedPrice).toBe(50);
    });
  });

  describe('References', () => {
    test('should populate student reference', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      const populatedRequest = await SessionRequest.findById(sessionRequest._id).populate('studentId');
      expect(populatedRequest.studentId.email).toBe(student.email);
      expect(populatedRequest.studentId.role).toBe('student');
    });

    test('should populate mentor reference', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      const populatedRequest = await SessionRequest.findById(sessionRequest._id).populate('mentorId');
      expect(populatedRequest.mentorId.email).toBe(mentor.email);
      expect(populatedRequest.mentorId.role).toBe('mentor');
    });

    test('should populate both references simultaneously', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      const populatedRequest = await SessionRequest.findById(sessionRequest._id)
        .populate('studentId mentorId');

      expect(populatedRequest.studentId.email).toBe(student.email);
      expect(populatedRequest.mentorId.email).toBe(mentor.email);
    });

    test('should handle invalid ObjectId references', async () => {
      const invalidId = new mongoose.Types.ObjectId();
      const requestData = testUtils.createValidSessionRequest(invalidId, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      // Should save but not populate invalid reference
      const populatedRequest = await SessionRequest.findById(sessionRequest._id).populate('studentId');
      expect(populatedRequest.studentId).toBeNull();
    });
  });

  describe('Preferred Times Structure', () => {
    test('should handle preferred times array correctly', async () => {
      const preferredTimes = [
        {
          date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          timeSlots: [
            { start: '09:00', end: '10:00' },
            { start: '14:00', end: '15:00' }
          ]
        },
        {
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
          timeSlots: [
            { start: '10:00', end: '11:00' }
          ]
        }
      ];

      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
        preferredTimes
      });
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.preferredTimes).toHaveLength(2);
      expect(sessionRequest.preferredTimes[0].timeSlots).toHaveLength(2);
      expect(sessionRequest.preferredTimes[1].timeSlots).toHaveLength(1);
      expect(sessionRequest.preferredTimes[0].timeSlots[0].start).toBe('09:00');
      expect(sessionRequest.preferredTimes[0].timeSlots[0].end).toBe('10:00');
    });

    test('should require date in preferred times', async () => {
      const preferredTimes = [
        {
          // Missing date
          timeSlots: [{ start: '09:00', end: '10:00' }]
        }
      ];

      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
        preferredTimes
      });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).rejects.toThrow(/date.*required/i);
    });

    test('should handle empty time slots array', async () => {
      const preferredTimes = [
        {
          date: new Date(Date.now() + 24 * 60 * 60 * 1000),
          timeSlots: [] // Empty array
        }
      ];

      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
        preferredTimes
      });
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.preferredTimes[0].timeSlots).toEqual([]);
    });

    test('should handle multiple dates with different time slots', async () => {
      const preferredTimes = [];
      for (let i = 1; i <= 3; i++) {
        preferredTimes.push({
          date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
          timeSlots: [
            { start: `${8 + i}:00`, end: `${9 + i}:00` },
            { start: `${13 + i}:00`, end: `${14 + i}:00` }
          ]
        });
      }

      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
        preferredTimes
      });
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.preferredTimes).toHaveLength(3);
      expect(sessionRequest.preferredTimes[0].timeSlots[0].start).toBe('9:00');
      expect(sessionRequest.preferredTimes[1].timeSlots[0].start).toBe('10:00');
      expect(sessionRequest.preferredTimes[2].timeSlots[0].start).toBe('11:00');
    });
  });

  describe('Request Lifecycle', () => {
    test('should support pending to accepted status change', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.status).toBe('pending');

      sessionRequest.status = 'accepted';
      sessionRequest.responseMessage = 'I would be happy to help you with calculus!';
      sessionRequest.proposedPrice = 45;
      await sessionRequest.save();

      expect(sessionRequest.status).toBe('accepted');
      expect(sessionRequest.responseMessage).toBe('I would be happy to help you with calculus!');
      expect(sessionRequest.proposedPrice).toBe(45);
    });

    test('should support pending to rejected status change', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      sessionRequest.status = 'rejected';
      sessionRequest.responseMessage = 'Sorry, I am not available at those times.';
      await sessionRequest.save();

      expect(sessionRequest.status).toBe('rejected');
      expect(sessionRequest.responseMessage).toBe('Sorry, I am not available at those times.');
    });

    test('should handle response message for different statuses', async () => {
      const responses = [
        { status: 'accepted', message: 'Looking forward to helping you!' },
        { status: 'rejected', message: 'Unfortunately, I cannot help with this topic.' }
      ];

      for (let i = 0; i < responses.length; i++) {
        const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
          subject: `Request ${i}`,
          status: responses[i].status,
          responseMessage: responses[i].message
        });
        const sessionRequest = new SessionRequest(requestData);
        await sessionRequest.save();

        expect(sessionRequest.status).toBe(responses[i].status);
        expect(sessionRequest.responseMessage).toBe(responses[i].message);
      }
    });
  });

  describe('Indexes', () => {
    test('should have proper indexes for performance', async () => {
      const indexes = await SessionRequest.collection.getIndexes();
      
      // Check for compound index on studentId and createdAt
      const studentIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'studentId' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'createdAt' && field[1] === -1)
      );
      expect(studentIndex).toBeTruthy();

      // Check for compound index on mentorId and status
      const mentorStatusIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'mentorId' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'status' && field[1] === 1)
      );
      expect(mentorStatusIndex).toBeTruthy();

      // Check for compound index on status and createdAt
      const statusIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'status' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'createdAt' && field[1] === -1)
      );
      expect(statusIndex).toBeTruthy();
    });
  });

  describe('Query Performance', () => {
    test('should efficiently query requests by student', async () => {
      // Create multiple requests from the same student
      for (let i = 0; i < 3; i++) {
        const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
          subject: `Math Help ${i}`,
          description: `Need help with topic ${i}`
        });
        const sessionRequest = new SessionRequest(requestData);
        await sessionRequest.save();
      }

      const studentRequests = await SessionRequest.find({ studentId: student._id })
        .populate('mentorId')
        .sort({ createdAt: -1 });

      expect(studentRequests).toHaveLength(3);
      studentRequests.forEach(request => {
        expect(request.studentId).toEqual(student._id);
        expect(request.mentorId.email).toBe(mentor.email);
      });
    });

    test('should efficiently query requests by mentor and status', async () => {
      const statuses = ['pending', 'accepted', 'rejected'];
      
      // Create requests with different statuses
      for (let i = 0; i < statuses.length; i++) {
        for (let j = 0; j < 2; j++) {
          const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
            subject: `Request ${i}-${j}`,
            status: statuses[i]
          });
          const sessionRequest = new SessionRequest(requestData);
          await sessionRequest.save();
        }
      }

      const pendingRequests = await SessionRequest.find({ 
        mentorId: mentor._id, 
        status: 'pending' 
      });

      const acceptedRequests = await SessionRequest.find({ 
        mentorId: mentor._id, 
        status: 'accepted' 
      });

      expect(pendingRequests).toHaveLength(2);
      expect(acceptedRequests).toHaveLength(2);
      
      pendingRequests.forEach(request => {
        expect(request.status).toBe('pending');
      });
    });

    test('should efficiently query recent requests', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Create old request
      const oldRequest = new SessionRequest(testUtils.createValidSessionRequest(student._id, mentor._id, {
        subject: 'Old request'
      }));
      oldRequest.createdAt = yesterday;
      await oldRequest.save();

      // Create recent requests
      for (let i = 0; i < 2; i++) {
        const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
          subject: `Recent request ${i}`
        });
        const sessionRequest = new SessionRequest(requestData);
        await sessionRequest.save();
      }

      const recentRequests = await SessionRequest.find({
        mentorId: mentor._id,
        createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } // Last hour
      }).sort({ createdAt: -1 });

      expect(recentRequests.length).toBeGreaterThanOrEqual(2);
      recentRequests.forEach(request => {
        expect(request.createdAt.getTime()).toBeGreaterThan(now.getTime() - 60 * 60 * 1000);
      });
    });
  });

  describe('Pricing and Negotiation', () => {
    test('should handle proposed price correctly', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
        proposedPrice: 75.50
      });
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.proposedPrice).toBe(75.50);
    });

    test('should support price negotiation in response', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
        proposedPrice: 30
      });
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      // Mentor accepts but proposes different price
      sessionRequest.status = 'accepted';
      sessionRequest.responseMessage = 'I can help, but my rate is $50/hour for calculus.';
      sessionRequest.proposedPrice = 50;
      await sessionRequest.save();

      expect(sessionRequest.proposedPrice).toBe(50);
      expect(sessionRequest.responseMessage).toContain('$50/hour');
    });

    test('should handle zero price for free sessions', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
        proposedPrice: 0
      });
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.proposedPrice).toBe(0);
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt timestamps', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.createdAt).toBeInstanceOf(Date);
      expect(sessionRequest.updatedAt).toBeInstanceOf(Date);
      expect(sessionRequest.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(sessionRequest.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should update updatedAt on status change', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id);
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      const originalUpdatedAt = sessionRequest.updatedAt;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      sessionRequest.status = 'accepted';
      await sessionRequest.save();

      expect(sessionRequest.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long valid descriptions', async () => {
      const longButValidDescription = 'a'.repeat(1000); // Max length
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { 
        description: longButValidDescription 
      });
      const sessionRequest = new SessionRequest(requestData);
      await expect(sessionRequest.save()).resolves.toBeTruthy();
      expect(sessionRequest.description).toBe(longButValidDescription);
    });

    test('should handle requests with no description', async () => {
      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, { 
        description: undefined 
      });
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();
      expect(sessionRequest.description).toBeUndefined();
    });

    test('should handle multiple time slots for same date', async () => {
      const preferredTimes = [{
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timeSlots: [
          { start: '09:00', end: '10:00' },
          { start: '11:00', end: '12:00' },
          { start: '14:00', end: '15:00' },
          { start: '16:00', end: '17:00' }
        ]
      }];

      const requestData = testUtils.createValidSessionRequest(student._id, mentor._id, {
        preferredTimes
      });
      const sessionRequest = new SessionRequest(requestData);
      await sessionRequest.save();

      expect(sessionRequest.preferredTimes[0].timeSlots).toHaveLength(4);
    });

    test('should handle boundary duration values', async () => {
      // Test minimum duration (15)
      const minRequestData = testUtils.createValidSessionRequest(student._id, mentor._id, { 
        duration: 15,
        subject: 'Quick help'
      });
      const minRequest = new SessionRequest(minRequestData);
      await expect(minRequest.save()).resolves.toBeTruthy();

      // Test maximum duration (480 = 8 hours)
      const maxRequestData = testUtils.createValidSessionRequest(student._id, mentor._id, { 
        duration: 480,
        subject: 'Intensive session'
      });
      const maxRequest = new SessionRequest(maxRequestData);
      await expect(maxRequest.save()).resolves.toBeTruthy();
    });
  });
});