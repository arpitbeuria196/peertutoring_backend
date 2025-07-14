const mongoose = require('mongoose');
const Review = require('../../models/Review');
const User = require('../../models/User');
const Session = require('../../models/Session');

describe('Review Model', () => {

  let mentor, student, session;

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

    const sessionData = testUtils.createValidSession(mentor._id, student._id);
    session = new Session(sessionData);
    await session.save();
  });

  describe('Schema Validation', () => {
    test('should create a valid review with required fields', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id);
      const review = new Review(reviewData);
      await expect(review.save()).resolves.toEqual(expect.objectContaining({
        _id: expect.any(mongoose.Types.ObjectId),
        sessionId: reviewData.sessionId,
        reviewerId: reviewData.reviewerId,
        revieweeId: reviewData.revieweeId,
        rating: reviewData.rating,
        comment: reviewData.comment,
        isPublic: true
      }));
    });

    test('should require sessionId field', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { sessionId: undefined });
      const review = new Review(reviewData);
      await expect(review.save()).rejects.toThrow(/sessionId.*required/i);
    });

    test('should require reviewerId field', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { reviewerId: undefined });
      const review = new Review(reviewData);
      await expect(review.save()).rejects.toThrow(/reviewerId.*required/i);
    });

    test('should require revieweeId field', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { revieweeId: undefined });
      const review = new Review(reviewData);
      await expect(review.save()).rejects.toThrow(/revieweeId.*required/i);
    });

    test('should require rating field', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { rating: undefined });
      const review = new Review(reviewData);
      await expect(review.save()).rejects.toThrow(/rating.*required/i);
    });

    test('should validate rating minimum value', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { rating: 0 });
      const review = new Review(reviewData);
      await expect(review.save()).rejects.toThrow(/rating.*Path.*less than minimum/i);
    });

    test('should validate rating maximum value', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { rating: 6 });
      const review = new Review(reviewData);
      await expect(review.save()).rejects.toThrow(/rating.*more than maximum/i);
    });

    test('should accept valid rating values', async () => {
      for (let rating = 1; rating <= 5; rating++) {
        const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { 
          rating,
          comment: `${rating} star review`
        });
        const review = new Review(reviewData);
        await expect(review.save()).resolves.toBeTruthy();
        expect(review.rating).toBe(rating);
      }
    });

    test('should enforce maximum comment length', async () => {
      const longComment = 'a'.repeat(1001);
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { comment: longComment });
      const review = new Review(reviewData);
      await expect(review.save()).rejects.toThrow(/comment.*Path.*longer/i);
    });

    test('should allow empty comment', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { comment: '' });
      const review = new Review(reviewData);
      await expect(review.save()).resolves.toBeTruthy();
      expect(review.comment).toBe('');
    });

    test('should allow null comment', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { comment: null });
      const review = new Review(reviewData);
      await expect(review.save()).resolves.toBeTruthy();
      expect(review.comment).toBeNull();
    });
  });

  describe('Default Values', () => {
    test('should set default values correctly', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id);
      const review = new Review(reviewData);
      await review.save();

      expect(review.isPublic).toBe(true);
    });

    test('should allow overriding default values', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, {
        isPublic: false
      });
      const review = new Review(reviewData);
      await review.save();

      expect(review.isPublic).toBe(false);
    });
  });

  describe('References', () => {
    test('should populate session reference', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id);
      const review = new Review(reviewData);
      await review.save();

      const populatedReview = await Review.findById(review._id).populate('sessionId');
      expect(populatedReview.sessionId.title).toBe(session.title);
      expect(populatedReview.sessionId.mentorId).toEqual(mentor._id);
      expect(populatedReview.sessionId.studentId).toEqual(student._id);
    });

    test('should populate reviewer reference', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id);
      const review = new Review(reviewData);
      await review.save();

      const populatedReview = await Review.findById(review._id).populate('reviewerId');
      expect(populatedReview.reviewerId.email).toBe(student.email);
      expect(populatedReview.reviewerId.role).toBe('student');
    });

    test('should populate reviewee reference', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id);
      const review = new Review(reviewData);
      await review.save();

      const populatedReview = await Review.findById(review._id).populate('revieweeId');
      expect(populatedReview.revieweeId.email).toBe(mentor.email);
      expect(populatedReview.revieweeId.role).toBe('mentor');
    });

    test('should populate all references simultaneously', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id);
      const review = new Review(reviewData);
      await review.save();

      const populatedReview = await Review.findById(review._id)
        .populate('sessionId')
        .populate('reviewerId')
        .populate('revieweeId');

      expect(populatedReview.sessionId.title).toBe(session.title);
      expect(populatedReview.reviewerId.email).toBe(student.email);
      expect(populatedReview.revieweeId.email).toBe(mentor.email);
    });

    test('should handle invalid ObjectId references', async () => {
      const invalidId = new mongoose.Types.ObjectId();
      const reviewData = testUtils.createValidReview(invalidId, student._id, mentor._id);
      const review = new Review(reviewData);
      await review.save();

      // Should save but not populate invalid reference
      const populatedReview = await Review.findById(review._id).populate('sessionId');
      expect(populatedReview.sessionId).toBeNull();
    });
  });

  describe('Bidirectional Reviews', () => {
    test('should support student reviewing mentor', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, {
        rating: 5,
        comment: 'Excellent mentor, very helpful!'
      });
      const review = new Review(reviewData);
      await review.save();

      expect(review.reviewerId).toEqual(student._id);
      expect(review.revieweeId).toEqual(mentor._id);
    });

    test('should support mentor reviewing student', async () => {
      const reviewData = testUtils.createValidReview(session._id, mentor._id, student._id, {
        rating: 4,
        comment: 'Good student, came prepared and engaged'
      });
      const review = new Review(reviewData);
      await review.save();

      expect(review.reviewerId).toEqual(mentor._id);
      expect(review.revieweeId).toEqual(student._id);
    });

    test('should allow both parties to review each other for same session', async () => {
      // Student reviews mentor
      const studentReviewData = testUtils.createValidReview(session._id, student._id, mentor._id, {
        rating: 5,
        comment: 'Great mentor!'
      });
      const studentReview = new Review(studentReviewData);
      await studentReview.save();

      // Mentor reviews student  
      const mentorReviewData = testUtils.createValidReview(session._id, mentor._id, student._id, {
        rating: 4,
        comment: 'Good student!'
      });
      const mentorReview = new Review(mentorReviewData);
      await mentorReview.save();

      const allReviews = await Review.find({ sessionId: session._id });
      expect(allReviews).toHaveLength(2);

      const studentReviewFound = allReviews.find(r => r.reviewerId.equals(student._id));
      const mentorReviewFound = allReviews.find(r => r.reviewerId.equals(mentor._id));

      expect(studentReviewFound).toBeTruthy();
      expect(mentorReviewFound).toBeTruthy();
      expect(studentReviewFound.revieweeId).toEqual(mentor._id);
      expect(mentorReviewFound.revieweeId).toEqual(student._id);
    });
  });

  describe('Privacy Controls', () => {
    test('should support private reviews', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, {
        isPublic: false,
        comment: 'Private feedback for improvement'
      });
      const review = new Review(reviewData);
      await review.save();

      expect(review.isPublic).toBe(false);
    });

    test('should filter public reviews correctly', async () => {
      // Create public review
      const publicReviewData = testUtils.createValidReview(session._id, student._id, mentor._id, {
        isPublic: true,
        comment: 'Public review'
      });
      const publicReview = new Review(publicReviewData);
      await publicReview.save();

      // Create private review for different session
      const session2Data = testUtils.createValidSession(mentor._id, student._id, {
        title: 'Session 2',
        meetLink: 'https://meet.google.com/test-2'
      });
      const session2 = new Session(session2Data);
      await session2.save();

      const privateReviewData = testUtils.createValidReview(session2._id, student._id, mentor._id, {
        isPublic: false,
        comment: 'Private review'
      });
      const privateReview = new Review(privateReviewData);
      await privateReview.save();

      const publicReviews = await Review.find({ revieweeId: mentor._id, isPublic: true });
      expect(publicReviews).toHaveLength(1);
      expect(publicReviews[0].comment).toBe('Public review');

      const allReviews = await Review.find({ revieweeId: mentor._id });
      expect(allReviews).toHaveLength(2);
    });
  });

  describe('Indexes', () => {
    test('should have proper indexes for performance', async () => {
      const indexes = await Review.collection.getIndexes();
      
      // Check for compound index on revieweeId and isPublic
      const revieweePublicIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'revieweeId' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'isPublic' && field[1] === 1)
      );
      expect(revieweePublicIndex).toBeTruthy();

      // Check for sessionId index
      const sessionIndex = indexes['sessionId_1'];
      expect(sessionIndex).toBeTruthy();

      // Check for reviewerId index
      const reviewerIndex = indexes['reviewerId_1'];
      expect(reviewerIndex).toBeTruthy();
    });
  });

  describe('Query Performance', () => {
    test('should efficiently query reviews by reviewee', async () => {
      // Create multiple sessions and reviews
      for (let i = 0; i < 3; i++) {
        const sessionData = testUtils.createValidSession(mentor._id, student._id, {
          title: `Session ${i}`,
          meetLink: `https://meet.google.com/test-${i}`
        });
        const newSession = new Session(sessionData);
        await newSession.save();

        const reviewData = testUtils.createValidReview(newSession._id, student._id, mentor._id, {
          rating: 4 + (i % 2), // Ratings 4 or 5
          comment: `Review for session ${i}`
        });
        const review = new Review(reviewData);
        await review.save();
      }

      const mentorReviews = await Review.find({ revieweeId: mentor._id })
        .populate('sessionId reviewerId')
        .sort({ createdAt: -1 });

      expect(mentorReviews).toHaveLength(3);
      mentorReviews.forEach(review => {
        expect(review.revieweeId).toEqual(mentor._id);
        expect(review.reviewerId._id).toEqual(student._id);
        expect(review.rating).toBeGreaterThanOrEqual(4);
      });
    });

    test('should efficiently query public reviews only', async () => {
      // Create mix of public and private reviews
      for (let i = 0; i < 4; i++) {
        const sessionData = testUtils.createValidSession(mentor._id, student._id, {
          title: `Session ${i}`,
          meetLink: `https://meet.google.com/test-${i}`
        });
        const newSession = new Session(sessionData);
        await newSession.save();

        const reviewData = testUtils.createValidReview(newSession._id, student._id, mentor._id, {
          rating: 5,
          comment: `Review ${i}`,
          isPublic: i % 2 === 0 // Even indexes are public
        });
        const review = new Review(reviewData);
        await review.save();
      }

      const publicReviews = await Review.find({ 
        revieweeId: mentor._id, 
        isPublic: true 
      });

      expect(publicReviews).toHaveLength(2);
      publicReviews.forEach(review => {
        expect(review.isPublic).toBe(true);
      });
    });

    test('should efficiently query reviews by session', async () => {
      // Create reviews for the session
      const studentReviewData = testUtils.createValidReview(session._id, student._id, mentor._id, {
        rating: 5,
        comment: 'Student review'
      });
      const studentReview = new Review(studentReviewData);
      await studentReview.save();

      const mentorReviewData = testUtils.createValidReview(session._id, mentor._id, student._id, {
        rating: 4,
        comment: 'Mentor review'
      });
      const mentorReview = new Review(mentorReviewData);
      await mentorReview.save();

      const sessionReviews = await Review.find({ sessionId: session._id })
        .populate('reviewerId revieweeId');

      expect(sessionReviews).toHaveLength(2);
      
      const studentReviewFound = sessionReviews.find(r => r.comment === 'Student review');
      const mentorReviewFound = sessionReviews.find(r => r.comment === 'Mentor review');

      expect(studentReviewFound.reviewerId.role).toBe('student');
      expect(mentorReviewFound.reviewerId.role).toBe('mentor');
    });
  });

  describe('Rating Statistics', () => {
    test('should support rating aggregation queries', async () => {
      // Create multiple reviews with different ratings
      const ratings = [5, 4, 5, 3, 4];
      
      for (let i = 0; i < ratings.length; i++) {
        const sessionData = testUtils.createValidSession(mentor._id, student._id, {
          title: `Session ${i}`,
          meetLink: `https://meet.google.com/test-${i}`
        });
        const newSession = new Session(sessionData);
        await newSession.save();

        const reviewData = testUtils.createValidReview(newSession._id, student._id, mentor._id, {
          rating: ratings[i],
          comment: `Review ${i} with ${ratings[i]} stars`
        });
        const review = new Review(reviewData);
        await review.save();
      }

      // Calculate average rating
      const mentorReviews = await Review.find({ revieweeId: mentor._id, isPublic: true });
      const totalRating = mentorReviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / mentorReviews.length;

      expect(mentorReviews).toHaveLength(5);
      expect(averageRating).toBe(4.2); // (5+4+5+3+4)/5 = 4.2
    });

    test('should support rating distribution queries', async () => {
      const ratings = [5, 5, 4, 4, 4, 3, 2, 1];
      
      for (let i = 0; i < ratings.length; i++) {
        const sessionData = testUtils.createValidSession(mentor._id, student._id, {
          title: `Session ${i}`,
          meetLink: `https://meet.google.com/test-${i}`
        });
        const newSession = new Session(sessionData);
        await newSession.save();

        const reviewData = testUtils.createValidReview(newSession._id, student._id, mentor._id, {
          rating: ratings[i]
        });
        const review = new Review(reviewData);
        await review.save();
      }

      // Count reviews by rating
      const ratingCounts = {};
      for (let rating = 1; rating <= 5; rating++) {
        const count = await Review.countDocuments({ 
          revieweeId: mentor._id, 
          rating: rating 
        });
        ratingCounts[rating] = count;
      }

      expect(ratingCounts[5]).toBe(2);
      expect(ratingCounts[4]).toBe(3);
      expect(ratingCounts[3]).toBe(1);
      expect(ratingCounts[2]).toBe(1);
      expect(ratingCounts[1]).toBe(1);
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt timestamps', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id);
      const review = new Review(reviewData);
      await review.save();

      expect(review.createdAt).toBeInstanceOf(Date);
      expect(review.updatedAt).toBeInstanceOf(Date);
      expect(review.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(review.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should update updatedAt on modification', async () => {
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id);
      const review = new Review(reviewData);
      await review.save();

      const originalUpdatedAt = review.updatedAt;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      review.comment = 'Updated review comment';
      await review.save();

      expect(review.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Edge Cases', () => {
    test('should handle self-review scenario gracefully', async () => {
      // Create a review where reviewer and reviewee are the same
      const reviewData = testUtils.createValidReview(session._id, mentor._id, mentor._id, {
        rating: 5,
        comment: 'Self assessment'
      });
      const review = new Review(reviewData);
      await review.save();

      expect(review.reviewerId).toEqual(mentor._id);
      expect(review.revieweeId).toEqual(mentor._id);
    });

    test('should handle very long valid comments', async () => {
      const longButValidComment = 'a'.repeat(1000); // Max length
      const reviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { 
        comment: longButValidComment 
      });
      const review = new Review(reviewData);
      await expect(review.save()).resolves.toBeTruthy();
      expect(review.comment).toBe(longButValidComment);
    });

    test('should handle boundary rating values', async () => {
      // Test minimum rating (1)
      const minReviewData = testUtils.createValidReview(session._id, student._id, mentor._id, { 
        rating: 1 
      });
      const minReview = new Review(minReviewData);
      await expect(minReview.save()).resolves.toBeTruthy();

      // Test maximum rating (5)
      const session2Data = testUtils.createValidSession(mentor._id, student._id, {
        title: 'Session 2',
        meetLink: 'https://meet.google.com/test-2'
      });
      const session2 = new Session(session2Data);
      await session2.save();

      const maxReviewData = testUtils.createValidReview(session2._id, student._id, mentor._id, { 
        rating: 5 
      });
      const maxReview = new Review(maxReviewData);
      await expect(maxReview.save()).resolves.toBeTruthy();
    });
  });
});