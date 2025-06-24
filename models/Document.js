const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  uploaderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  originalName: {
    type: String,
    required: true,
    maxlength: 255
  },
  fileName: {
    type: String,
    required: true,
    unique: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['profile_picture', 'session_material', 'message_attachment', 'verification_document', 'other'],
    default: 'other'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  accessLevel: {
    type: String,
    enum: ['public', 'authenticated', 'participants_only', 'private'],
    default: 'private'
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
documentSchema.index({ uploaderId: 1, createdAt: -1 });
documentSchema.index({ sessionId: 1 });
documentSchema.index({ category: 1, isActive: 1 });
documentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for file URL
documentSchema.virtual('url').get(function() {
  return `/api/documents/${this._id}/download`;
});

// Method to check if user can access document
documentSchema.methods.canAccess = function(user) {
  // Handle null user first
  if (!user) {
    return this.accessLevel === 'public';
  }

  // Document owner can always access
  if (this.uploaderId.toString() === user._id.toString()) {
    return true;
  }

  // Admin can access all documents
  if (user.role === 'admin') {
    return true;
  }

  // Check access level
  switch (this.accessLevel) {
    case 'public':
      return true;
    case 'authenticated':
      return true; // Any authenticated user
    case 'participants_only':
      // For session documents, check if user is participant
      if (this.sessionId) {
        return user.sessions && user.sessions.includes(this.sessionId);
      }
      return false;
    case 'private':
    default:
      return false;
  }
};

// Method to increment download count
documentSchema.methods.incrementDownload = async function() {
  this.downloadCount += 1;
  await this.save();
};

module.exports = mongoose.model('Document', documentSchema);