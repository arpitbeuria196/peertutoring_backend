const mongoose = require('mongoose');
const Document = require('../../models/Document');
const User = require('../../models/User');
const Session = require('../../models/Session');
const Message = require('../../models/Message');

describe('Document Model', () => {

  let uploader, mentor, session, message;

  beforeEach(async () => {
    const uploaderData = testUtils.createValidUser({
      email: 'uploader@test.com',
      username: 'uploader',
      role: 'student'
    });
    uploader = new User(uploaderData);
    await uploader.save();

    const mentorData = testUtils.createValidUser({
      email: 'mentor@test.com',
      username: 'mentor',
      role: 'mentor'
    });
    mentor = new User(mentorData);
    await mentor.save();

    const sessionData = testUtils.createValidSession(mentor._id, uploader._id);
    session = new Session(sessionData);
    await session.save();

    const messageData = testUtils.createValidMessage(uploader._id, mentor._id);
    message = new Message(messageData);
    await message.save();
  });

  describe('Schema Validation', () => {
    test('should create a valid document with required fields', async () => {
      const documentData = testUtils.createValidDocument(uploader._id);
      const document = new Document(documentData);
      await expect(document.save()).resolves.toEqual(expect.objectContaining({
        _id: expect.any(mongoose.Types.ObjectId),
        uploaderId: documentData.uploaderId,
        originalName: documentData.originalName,
        fileName: documentData.fileName,
        mimeType: documentData.mimeType,
        size: documentData.size,
        path: documentData.path,
        category: 'other',
        isPublic: false,
        accessLevel: 'private',
        downloadCount: 0,
        isActive: true
      }));
    });

    test('should require uploaderId field', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { uploaderId: undefined });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/uploaderId.*required/i);
    });

    test('should require originalName field', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { originalName: undefined });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/originalName.*required/i);
    });

    test('should require fileName field', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { fileName: undefined });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/fileName.*required/i);
    });

    test('should require mimeType field', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { mimeType: undefined });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/mimeType.*required/i);
    });

    test('should require size field', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { size: undefined });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/size.*required/i);
    });

    test('should require path field', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { path: undefined });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/path.*required/i);
    });

    test('should enforce unique fileName', async () => {
      const documentData1 = testUtils.createValidDocument(uploader._id);
      const document1 = new Document(documentData1);
      await document1.save();

      const documentData2 = testUtils.createValidDocument(uploader._id, {
        originalName: 'different-file.pdf'
      });
      const document2 = new Document(documentData2);
      await expect(document2.save()).rejects.toThrow(/duplicate key/i);
    });

    test('should enforce maximum originalName length', async () => {
      const longName = 'a'.repeat(256);
      const documentData = testUtils.createValidDocument(uploader._id, { originalName: longName });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/originalName.*Path.*longer/i);
    });

    test('should validate category enum values', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { category: 'invalid_category' });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/category.*not a valid enum value/i);
    });

    test('should accept valid category values', async () => {
      const categories = ['profile_picture', 'session_material', 'message_attachment', 'verification_document', 'other'];
      
      for (let i = 0; i < categories.length; i++) {
        const documentData = testUtils.createValidDocument(uploader._id, {
          category: categories[i],
          fileName: `test-document-${i}.pdf`,
          originalName: `test-${i}.pdf`
        });
        const document = new Document(documentData);
        await expect(document.save()).resolves.toBeTruthy();
        expect(document.category).toBe(categories[i]);
      }
    });

    test('should validate accessLevel enum values', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { accessLevel: 'invalid_access' });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/accessLevel.*not a valid enum value/i);
    });

    test('should accept valid accessLevel values', async () => {
      const accessLevels = ['public', 'authenticated', 'participants_only', 'private'];
      
      for (let i = 0; i < accessLevels.length; i++) {
        const documentData = testUtils.createValidDocument(uploader._id, {
          accessLevel: accessLevels[i],
          fileName: `access-test-${i}.pdf`,
          originalName: `access-${i}.pdf`
        });
        const document = new Document(documentData);
        await expect(document.save()).resolves.toBeTruthy();
        expect(document.accessLevel).toBe(accessLevels[i]);
      }
    });

    test('should enforce maximum description length', async () => {
      const longDescription = 'a'.repeat(501);
      const documentData = testUtils.createValidDocument(uploader._id, { description: longDescription });
      const document = new Document(documentData);
      await expect(document.save()).rejects.toThrow(/description.*Path.*longer/i);
    });

    test('should trim tags array elements', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, {
        tags: ['  important  ', '  urgent  ', '  tutorial  ']
      });
      const document = new Document(documentData);
      await document.save();

      expect(document.tags).toEqual(['important', 'urgent', 'tutorial']);
    });
  });

  describe('Default Values', () => {
    test('should set default values correctly', async () => {
      const documentData = testUtils.createValidDocument(uploader._id);
      const document = new Document(documentData);
      await document.save();

      expect(document.category).toBe('other');
      expect(document.isPublic).toBe(false);
      expect(document.accessLevel).toBe('private');
      expect(document.downloadCount).toBe(0);
      expect(document.isActive).toBe(true);
      expect(document.tags).toEqual([]);
      expect(document.sessionId).toBeUndefined();
      expect(document.messageId).toBeUndefined();
      expect(document.description).toBeUndefined();
      expect(document.expiresAt).toBeUndefined();
    });

    test('should allow overriding default values', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, {
        category: 'session_material',
        isPublic: true,
        accessLevel: 'authenticated',
        downloadCount: 5,
        isActive: false,
        tags: ['math', 'calculus'],
        description: 'Calculus practice problems'
      });
      const document = new Document(documentData);
      await document.save();

      expect(document.category).toBe('session_material');
      expect(document.isPublic).toBe(true);
      expect(document.accessLevel).toBe('authenticated');
      expect(document.downloadCount).toBe(5);
      expect(document.isActive).toBe(false);
      expect(document.tags).toEqual(['math', 'calculus']);
      expect(document.description).toBe('Calculus practice problems');
    });
  });

  describe('References', () => {
    test('should populate uploader reference', async () => {
      const documentData = testUtils.createValidDocument(uploader._id);
      const document = new Document(documentData);
      await document.save();

      const populatedDocument = await Document.findById(document._id).populate('uploaderId');
      expect(populatedDocument.uploaderId.email).toBe(uploader.email);
      expect(populatedDocument.uploaderId.role).toBe('student');
    });

    test('should populate session reference when provided', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, {
        sessionId: session._id,
        category: 'session_material'
      });
      const document = new Document(documentData);
      await document.save();

      const populatedDocument = await Document.findById(document._id).populate('sessionId');
      expect(populatedDocument.sessionId.title).toBe(session.title);
      expect(populatedDocument.sessionId.mentorId).toEqual(mentor._id);
    });

    test('should populate message reference when provided', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, {
        messageId: message._id,
        category: 'message_attachment'
      });
      const document = new Document(documentData);
      await document.save();

      const populatedDocument = await Document.findById(document._id).populate('messageId');
      expect(populatedDocument.messageId.content).toBe(message.content);
      expect(populatedDocument.messageId.senderId).toEqual(uploader._id);
    });

    test('should populate all references simultaneously', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, {
        sessionId: session._id,
        messageId: message._id
      });
      const document = new Document(documentData);
      await document.save();

      const populatedDocument = await Document.findById(document._id)
        .populate('uploaderId sessionId messageId');

      expect(populatedDocument.uploaderId.email).toBe(uploader.email);
      expect(populatedDocument.sessionId.title).toBe(session.title);
      expect(populatedDocument.messageId.content).toBe(message.content);
    });
  });

  describe('Virtual Properties', () => {
    test('should provide url virtual property', async () => {
      const documentData = testUtils.createValidDocument(uploader._id);
      const document = new Document(documentData);
      await document.save();

      expect(document.url).toBe(`/api/documents/${document._id}/download`);
    });
  });

  describe('Access Control Methods', () => {
    test('canAccess should allow document owner', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, {
        accessLevel: 'private'
      });
      const document = new Document(documentData);
      await document.save();

      expect(document.canAccess(uploader)).toBe(true);
    });

    test('canAccess should allow admin access to all documents', async () => {
      const adminData = testUtils.createValidUser({
        email: 'admin@test.com',
        username: 'admin',
        role: 'admin'
      });
      const admin = new User(adminData);
      await admin.save();

      const documentData = testUtils.createValidDocument(uploader._id, {
        accessLevel: 'private'
      });
      const document = new Document(documentData);
      await document.save();

      expect(document.canAccess(admin)).toBe(true);
    });

    test('canAccess should handle public access level', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, {
        accessLevel: 'public'
      });
      const document = new Document(documentData);
      await document.save();

      expect(document.canAccess(mentor)).toBe(true);
      expect(document.canAccess(null)).toBe(true);
    });

    test('canAccess should handle authenticated access level', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, {
        accessLevel: 'authenticated'
      });
      const document = new Document(documentData);
      await document.save();

      expect(document.canAccess(mentor)).toBe(true);
      expect(document.canAccess(null)).toBe(false);
    });

    test('canAccess should handle participants_only access level', async () => {
      // Mock user with sessions array including the session
      const participantUser = { ...mentor.toObject(), sessions: [session._id] };
      const nonParticipantUser = { ...mentor.toObject(), sessions: [] };

      const documentData = testUtils.createValidDocument(uploader._id, {
        sessionId: session._id,
        accessLevel: 'participants_only'
      });
      const document = new Document(documentData);
      await document.save();

      expect(document.canAccess(participantUser)).toBe(true);
      expect(document.canAccess(nonParticipantUser)).toBe(false);
    });

    test('canAccess should deny private access to non-owners', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, {
        accessLevel: 'private'
      });
      const document = new Document(documentData);
      await document.save();

      expect(document.canAccess(mentor)).toBe(false);
    });
  });

  describe('Document Methods', () => {
    test('incrementDownload should increase download count', async () => {
      const documentData = testUtils.createValidDocument(uploader._id);
      const document = new Document(documentData);
      await document.save();

      expect(document.downloadCount).toBe(0);

      await document.incrementDownload();
      expect(document.downloadCount).toBe(1);

      await document.incrementDownload();
      expect(document.downloadCount).toBe(2);

      // Verify it was saved to database
      const updatedDocument = await Document.findById(document._id);
      expect(updatedDocument.downloadCount).toBe(2);
    });
  });

  describe('File Type Support', () => {
    test('should handle different MIME types', async () => {
      const mimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      for (let i = 0; i < mimeTypes.length; i++) {
        const documentData = testUtils.createValidDocument(uploader._id, {
          mimeType: mimeTypes[i],
          fileName: `test-${i}.ext`,
          originalName: `file-${i}.ext`
        });
        const document = new Document(documentData);
        await expect(document.save()).resolves.toBeTruthy();
        expect(document.mimeType).toBe(mimeTypes[i]);
      }
    });

    test('should handle different file sizes', async () => {
      const sizes = [1024, 1048576, 10485760, 104857600]; // 1KB, 1MB, 10MB, 100MB

      for (let i = 0; i < sizes.length; i++) {
        const documentData = testUtils.createValidDocument(uploader._id, {
          size: sizes[i],
          fileName: `size-test-${i}.pdf`,
          originalName: `size-${i}.pdf`
        });
        const document = new Document(documentData);
        await document.save();
        expect(document.size).toBe(sizes[i]);
      }
    });
  });

  describe('Expiration Support', () => {
    test('should handle document expiration', async () => {
      const expirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
      
      const documentData = testUtils.createValidDocument(uploader._id, {
        expiresAt: expirationDate
      });
      const document = new Document(documentData);
      await document.save();

      expect(document.expiresAt).toEqual(expirationDate);
    });

    test('should support TTL index for automatic expiration', async () => {
      const indexes = await Document.collection.getIndexes();
      
      // Check for TTL index on expiresAt
      const ttlIndex = Object.keys(indexes).find(key => {
        const index = indexes[key];
        return Array.isArray(index) && 
               index.some(field => Array.isArray(field) && field[0] === 'expiresAt' && field[1] === 1);
      });
      
      // Alternative check for TTL index structure
      const hasTTLIndex = Object.values(indexes).some(index => 
        index.expireAfterSeconds === 0 || 
        (Array.isArray(index) && index.some(field => 
          Array.isArray(field) && field[0] === 'expiresAt'
        ))
      );
      
      expect(hasTTLIndex || ttlIndex).toBeTruthy();
    });
  });

  describe('Indexes', () => {
    test('should have proper indexes for performance', async () => {
      const indexes = await Document.collection.getIndexes();
      
      // Check for compound index on uploaderId and createdAt
      const uploaderIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'uploaderId' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'createdAt' && field[1] === -1)
      );
      expect(uploaderIndex).toBeTruthy();

      // Check for sessionId index
      const sessionIndex = indexes['sessionId_1'];
      expect(sessionIndex).toBeTruthy();

      // Check for compound index on category and isActive
      const categoryIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'category' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'isActive' && field[1] === 1)
      );
      expect(categoryIndex).toBeTruthy();
    });
  });

  describe('Query Performance', () => {
    test('should efficiently query documents by uploader', async () => {
      // Create multiple documents for the uploader
      const categories = ['session_material', 'verification_document', 'other'];
      
      for (let i = 0; i < categories.length; i++) {
        const documentData = testUtils.createValidDocument(uploader._id, {
          category: categories[i],
          fileName: `uploader-test-${i}.pdf`,
          originalName: `test-${i}.pdf`
        });
        const document = new Document(documentData);
        await document.save();
      }

      const uploaderDocs = await Document.find({ uploaderId: uploader._id })
        .sort({ createdAt: -1 });

      expect(uploaderDocs).toHaveLength(3);
      uploaderDocs.forEach(doc => {
        expect(doc.uploaderId).toEqual(uploader._id);
      });
    });

    test('should efficiently query documents by category', async () => {
      const categories = ['session_material', 'verification_document'];
      
      // Create documents in different categories
      for (let i = 0; i < categories.length; i++) {
        for (let j = 0; j < 2; j++) {
          const documentData = testUtils.createValidDocument(uploader._id, {
            category: categories[i],
            fileName: `category-${i}-${j}.pdf`,
            originalName: `cat-${i}-${j}.pdf`
          });
          const document = new Document(documentData);
          await document.save();
        }
      }

      const sessionMaterials = await Document.find({ 
        category: 'session_material',
        isActive: true 
      });

      expect(sessionMaterials).toHaveLength(2);
      sessionMaterials.forEach(doc => {
        expect(doc.category).toBe('session_material');
        expect(doc.isActive).toBe(true);
      });
    });

    test('should efficiently query public documents', async () => {
      // Create mix of public and private documents
      for (let i = 0; i < 4; i++) {
        const documentData = testUtils.createValidDocument(uploader._id, {
          isPublic: i % 2 === 0, // Even indexes are public
          accessLevel: i % 2 === 0 ? 'public' : 'private',
          fileName: `public-test-${i}.pdf`,
          originalName: `public-${i}.pdf`
        });
        const document = new Document(documentData);
        await document.save();
      }

      const publicDocuments = await Document.find({ 
        isPublic: true,
        isActive: true 
      });

      expect(publicDocuments).toHaveLength(2);
      publicDocuments.forEach(doc => {
        expect(doc.isPublic).toBe(true);
        expect(doc.accessLevel).toBe('public');
      });
    });

    test('should efficiently query documents by session', async () => {
      // Create session materials
      for (let i = 0; i < 3; i++) {
        const documentData = testUtils.createValidDocument(uploader._id, {
          sessionId: session._id,
          category: 'session_material',
          fileName: `session-material-${i}.pdf`,
          originalName: `material-${i}.pdf`
        });
        const document = new Document(documentData);
        await document.save();
      }

      const sessionDocuments = await Document.find({ sessionId: session._id })
        .populate('uploaderId');

      expect(sessionDocuments).toHaveLength(3);
      sessionDocuments.forEach(doc => {
        expect(doc.sessionId).toEqual(session._id);
        expect(doc.uploaderId.email).toBe(uploader.email);
      });
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt timestamps', async () => {
      const documentData = testUtils.createValidDocument(uploader._id);
      const document = new Document(documentData);
      await document.save();

      expect(document.createdAt).toBeInstanceOf(Date);
      expect(document.updatedAt).toBeInstanceOf(Date);
      expect(document.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(document.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should update updatedAt on modification', async () => {
      const documentData = testUtils.createValidDocument(uploader._id);
      const document = new Document(documentData);
      await document.save();

      const originalUpdatedAt = document.updatedAt;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await document.incrementDownload();

      expect(document.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Edge Cases', () => {
    test('should handle documents with no description', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { 
        description: undefined 
      });
      const document = new Document(documentData);
      await document.save();
      expect(document.description).toBeUndefined();
    });

    test('should handle documents with empty tags array', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { 
        tags: [] 
      });
      const document = new Document(documentData);
      await document.save();
      expect(document.tags).toEqual([]);
    });

    test('should handle very long valid descriptions', async () => {
      const longButValidDescription = 'a'.repeat(500); // Max length
      const documentData = testUtils.createValidDocument(uploader._id, { 
        description: longButValidDescription 
      });
      const document = new Document(documentData);
      await expect(document.save()).resolves.toBeTruthy();
      expect(document.description).toBe(longButValidDescription);
    });

    test('should handle maximum originalName length', async () => {
      const longButValidName = 'a'.repeat(255); // Max length
      const documentData = testUtils.createValidDocument(uploader._id, { 
        originalName: longButValidName 
      });
      const document = new Document(documentData);
      await expect(document.save()).resolves.toBeTruthy();
      expect(document.originalName).toBe(longButValidName);
    });

    test('should handle zero file size', async () => {
      const documentData = testUtils.createValidDocument(uploader._id, { 
        size: 0 
      });
      const document = new Document(documentData);
      await document.save();
      expect(document.size).toBe(0);
    });
  });
});