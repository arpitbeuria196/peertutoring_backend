const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');

describe('User Model', () => {
  
  describe('Schema Validation', () => {
    test('should create a valid user with required fields', async () => {
      const userData = testUtils.createValidUser();
      const user = new User(userData);
      await expect(user.save()).resolves.toEqual(expect.objectContaining({
        _id: expect.any(mongoose.Types.ObjectId),
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      }));
    });

    test('should require email field', async () => {
      const userData = testUtils.createValidUser({ email: undefined });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/email.*required/i);
    });

    test('should require username field', async () => {
      const userData = testUtils.createValidUser({ username: undefined });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/username.*required/i);
    });

    test('should require password field', async () => {
      const userData = testUtils.createValidUser({ password: undefined });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/password.*required/i);
    });

    test('should require firstName field', async () => {
      const userData = testUtils.createValidUser({ firstName: undefined });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/firstName.*required/i);
    });

    test('should require lastName field', async () => {
      const userData = testUtils.createValidUser({ lastName: undefined });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/lastName.*required/i);
    });

    test('should require role field', async () => {
      const userData = testUtils.createValidUser({ role: undefined });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/role.*required/i);
    });

    test('should enforce minimum password length', async () => {
      const userData = testUtils.createValidUser({ password: '123' });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/password.*shorter/i);
    });

    test('should enforce maximum bio length', async () => {
      const longBio = 'a'.repeat(1001);
      const userData = testUtils.createValidUser({ bio: longBio });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/bio.*Path.*longer/i);
    });

    test('should validate role enum values', async () => {
      const userData = testUtils.createValidUser({ role: 'invalid_role' });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/role.*not a valid enum value/i);
    });

    test('should accept valid role values', async () => {
      const roles = ['student', 'mentor', 'admin'];
      for (const role of roles) {
        const userData = testUtils.createValidUser({ 
          email: `${role}@test.com`,
          username: `${role}user`,
          role 
        });
        const user = new User(userData);
        await expect(user.save()).resolves.toBeTruthy();
      }
    });

    test('should enforce email uniqueness', async () => {
      const userData1 = testUtils.createValidUser();
      const user1 = new User(userData1);
      await user1.save();

      const userData2 = testUtils.createValidUser({ username: 'different' });
      const user2 = new User(userData2);
      await expect(user2.save()).rejects.toThrow(/duplicate key/i);
    });

    test('should enforce username uniqueness', async () => {
      const userData1 = testUtils.createValidUser();
      const user1 = new User(userData1);
      await user1.save();

      const userData2 = testUtils.createValidUser({ email: 'different@test.com' });
      const user2 = new User(userData2);
      await expect(user2.save()).rejects.toThrow(/duplicate key/i);
    });
  });

  describe('Field Validation', () => {
    test('should validate email format is lowercase', async () => {
      const userData = testUtils.createValidUser({ email: 'TEST@EXAMPLE.COM' });
      const user = new User(userData);
      await user.save();
      expect(user.email).toBe('test@example.com');
    });

    test('should trim whitespace from string fields', async () => {
      const userData = testUtils.createValidUser({
        firstName: '  John  ',
        lastName: '  Doe  ',
        username: '  testuser  ',
        bio: '  This is a bio  '
      });
      const user = new User(userData);
      await user.save();
      
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.username).toBe('testuser');
      expect(user.bio).toBe('This is a bio');
    });

    test('should validate hourlyRate range for mentors', async () => {
      const userData = testUtils.createValidUser({ 
        role: 'mentor',
        hourlyRate: -10 
      });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/hourlyRate.*Path.*less than minimum/i);

      const userData2 = testUtils.createValidUser({ 
        email: 'mentor2@test.com',
        username: 'mentor2',
        role: 'mentor',
        hourlyRate: 1001 
      });
      const user2 = new User(userData2);
      await expect(user2.save()).rejects.toThrow(/hourlyRate.*more than maximum/i);
    });

    test('should validate rating range', async () => {
      const userData = testUtils.createValidUser({ rating: -1 });
      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/rating.*Path.*less than minimum/i);

      const userData2 = testUtils.createValidUser({ 
        email: 'user2@test.com',
        username: 'user2',
        rating: 6 
      });
      const user2 = new User(userData2);
      await expect(user2.save()).rejects.toThrow(/rating.*more than maximum/i);
    });
  });

  describe('Default Values', () => {
    test('should set default values correctly', async () => {
      const userData = testUtils.createValidUser();
      const user = new User(userData);
      await user.save();

      expect(user.isActive).toBe(true);
      expect(user.isVerified).toBe(false);
      expect(user.isApproved).toBe(false);
      expect(user.rating).toBe(0);
      expect(user.totalSessions).toBe(0);
      expect(user.totalReviews).toBe(0);
      expect(user.timezone).toBe('UTC');
      expect(user.documentsUploaded).toBe(false);
      expect(user.documentsVerified).toBe(false);
      expect(user.profilePicture).toBeNull();
      expect(user.resetPasswordToken).toBeNull();
      expect(user.resetPasswordExpires).toBeNull();
    });

    test('should initialize skills as empty array', async () => {
      const userData = testUtils.createValidUser();
      const user = new User(userData);
      await user.save();
      expect(user.skills).toEqual([]);
    });

    test('should initialize availability with default structure', async () => {
      const userData = testUtils.createValidUser({ role: 'mentor' });
      const user = new User(userData);
      await user.save();

      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.forEach(day => {
        expect(user.availability[day]).toEqual({
          available: false,
          startTime: null,
          endTime: null
        });
      });
    });

    test('should set lastActive timestamp', async () => {
      const userData = testUtils.createValidUser();
      const user = new User(userData);
      await user.save();
      expect(user.lastActive).toBeInstanceOf(Date);
      expect(user.lastActive.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Methods', () => {
    test('comparePassword should work correctly', async () => {
      const password = 'testpassword123';
      const hashedPassword = await bcrypt.hash(password, 12);
      const userData = testUtils.createValidUser({ password: hashedPassword });
      const user = new User(userData);
      await user.save();

      expect(await user.comparePassword(password)).toBe(true);
      expect(await user.comparePassword('wrongpassword')).toBe(false);
    });

    test('getPublicProfile should return public fields only', async () => {
      const userData = testUtils.createValidUser({
        role: 'mentor',
        bio: 'Test bio',
        skills: ['JavaScript', 'Python'],
        rating: 4.5,
        totalSessions: 10,
        totalReviews: 8,
        hourlyRate: 50,
        location: 'New York',
        timezone: 'EST'
      });
      const user = new User(userData);
      await user.save();

      const publicProfile = user.getPublicProfile();
      
      expect(publicProfile).toEqual({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        profilePicture: user.profilePicture,
        bio: user.bio,
        role: user.role,
        skills: user.skills,
        rating: user.rating,
        totalSessions: user.totalSessions,
        totalReviews: user.totalReviews,
        hourlyRate: user.hourlyRate,
        location: user.location,
        timezone: user.timezone,
        isActive: user.isActive,
        lastActive: user.lastActive
      });

      // Should not include sensitive fields
      expect(publicProfile).not.toHaveProperty('email');
      expect(publicProfile).not.toHaveProperty('password');
      expect(publicProfile).not.toHaveProperty('resetPasswordToken');
    });

    test('getFullProfile should return all user data for authenticated user', async () => {
      const userData = testUtils.createValidUser({
        phone: '123-456-7890',
        isVerified: true,
        isApproved: true,
        documentsUploaded: true,
        documentsVerified: true
      });
      const user = new User(userData);
      await user.save();

      const fullProfile = user.getFullProfile();
      
      expect(fullProfile).toHaveProperty('email', user.email);
      expect(fullProfile).toHaveProperty('phone', user.phone);
      expect(fullProfile).toHaveProperty('isVerified', user.isVerified);
      expect(fullProfile).toHaveProperty('isApproved', user.isApproved);
      expect(fullProfile).toHaveProperty('documentsUploaded', user.documentsUploaded);
      expect(fullProfile).toHaveProperty('documentsVerified', user.documentsVerified);
      expect(fullProfile).toHaveProperty('createdAt', user.createdAt);
      expect(fullProfile).toHaveProperty('updatedAt', user.updatedAt);

      // Should not include password
      expect(fullProfile).not.toHaveProperty('password');
      expect(fullProfile).not.toHaveProperty('resetPasswordToken');
      expect(fullProfile).not.toHaveProperty('resetPasswordExpires');
    });
  });

  describe('Document Storage', () => {
    test('should initialize document storage structure', async () => {
      const userData = testUtils.createValidUser();
      const user = new User(userData);
      await user.save();

      expect(user.documents).toHaveProperty('resumeDocument');
      expect(user.documents).toHaveProperty('offerDocument');
      
      expect(user.documents.resumeDocument).toEqual({
        filename: null,
        originalName: null,
        path: null,
        uploadedAt: null,
        verified: false,
        id: null
      });

      expect(user.documents.offerDocument).toEqual({
        filename: null,
        originalName: null,
        path: null,
        uploadedAt: null,
        verified: false,
        id: null
      });
    });

    test('should allow updating document information', async () => {
      const userData = testUtils.createValidUser();
      const user = new User(userData);
      await user.save();

      user.documents.resumeDocument = {
        filename: 'resume_123.pdf',
        originalName: 'my-resume.pdf',
        path: '/uploads/user123/resumes/resume_123.pdf',
        uploadedAt: new Date(),
        verified: true,
        id: 'doc_123'
      };

      await user.save();
      
      const savedUser = await User.findById(user._id);
      expect(savedUser.documents.resumeDocument.filename).toBe('resume_123.pdf');
      expect(savedUser.documents.resumeDocument.verified).toBe(true);
    });
  });

  describe('Skills Management', () => {
    test('should handle skills as string array', async () => {
      const userData = testUtils.createValidUser({
        skills: ['JavaScript', 'Python', 'React', 'Node.js']
      });
      const user = new User(userData);
      await user.save();

      expect(user.skills).toEqual(['JavaScript', 'Python', 'React', 'Node.js']);
    });

    test('should trim skill names', async () => {
      const userData = testUtils.createValidUser({
        skills: ['  JavaScript  ', '  Python  ', '  React  ']
      });
      const user = new User(userData);
      await user.save();

      expect(user.skills).toEqual(['JavaScript', 'Python', 'React']);
    });
  });

  describe('Availability Management', () => {
    test('should allow setting mentor availability', async () => {
      const userData = testUtils.createValidUser({ role: 'mentor' });
      const user = new User(userData);
      
      user.availability.monday = {
        available: true,
        startTime: '09:00',
        endTime: '17:00'
      };
      
      user.availability.wednesday = {
        available: true,
        startTime: '10:00',
        endTime: '16:00'
      };

      await user.save();

      const savedUser = await User.findById(user._id);
      expect(savedUser.availability.monday.available).toBe(true);
      expect(savedUser.availability.monday.startTime).toBe('09:00');
      expect(savedUser.availability.monday.endTime).toBe('17:00');
      expect(savedUser.availability.tuesday.available).toBe(false);
      expect(savedUser.availability.wednesday.available).toBe(true);
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt timestamps', async () => {
      const userData = testUtils.createValidUser();
      const user = new User(userData);
      await user.save();

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(user.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should update updatedAt on modification', async () => {
      const userData = testUtils.createValidUser();
      const user = new User(userData);
      await user.save();

      const originalUpdatedAt = user.updatedAt;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      user.bio = 'Updated bio';
      await user.save();

      expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});