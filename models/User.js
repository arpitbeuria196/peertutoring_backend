const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const userSchema = new mongoose.Schema({
  // Basic Authentication
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Basic Profile
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  
  // Password Reset
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  
  // Role & Status
  role: {
    type: String,
    enum: ['student', 'mentor', 'admin'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  
  // Contact Information
  phone: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Skills
  skills: [{
    type: String,
    trim: true
  }],
  
  // Mentor-specific fields
  hourlyRate: {
    type: Number,
    min: 0,
    max: 1000
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalSessions: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  
  // Document Storage
  documents: {
    resumeDocument: {
      filename: { type: String, default: null },
      originalName: { type: String, default: null },
      path: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
      verified: { type: Boolean, default: false },
      id: { type: String, default: null }
    },
    offerDocument: {
      filename: { type: String, default: null },
      originalName: { type: String, default: null },
      path: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
      verified: { type: Boolean, default: false },
      id: { type: String, default: null }
    }
  },
  
  // Document Status (simplified)
  documentsUploaded: {
    type: Boolean,
    default: false
  },
  documentsVerified: {
    type: Boolean,
    default: false
  },
  
  // Availability (for mentors)
  availability: {
    monday: {
      available: { type: Boolean, default: false },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null }
    },
    tuesday: {
      available: { type: Boolean, default: false },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null }
    },
    wednesday: {
      available: { type: Boolean, default: false },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null }
    },
    thursday: {
      available: { type: Boolean, default: false },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null }
    },
    friday: {
      available: { type: Boolean, default: false },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null }
    },
    saturday: {
      available: { type: Boolean, default: false },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null }
    },
    sunday: {
      available: { type: Boolean, default: false },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null }
    }
  },
  
  // Timestamps
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  // Only hash password if it has been modified and is not already hashed
  if (!this.isModified('password')) return next();
  
  // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (this.password.match(/^\$2[abyxy]?\$/)) {
    return next();
  }
  
  try {
    // Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get public profile
userSchema.methods.getPublicProfile = function() {
  return {
    _id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    username: this.username,
    profilePicture: this.profilePicture,
    bio: this.bio,
    role: this.role,
    skills: this.skills,
    rating: this.rating,
    totalSessions: this.totalSessions,
    totalReviews: this.totalReviews,
    hourlyRate: this.hourlyRate,
    location: this.location,
    timezone: this.timezone,
    isActive: this.isActive,
    lastActive: this.lastActive
  };
};

// Get full profile (for authenticated user)
userSchema.methods.getFullProfile = function() {
  return {
    _id: this._id,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    username: this.username,
    profilePicture: this.profilePicture,
    bio: this.bio,
    role: this.role,
    skills: this.skills,
    rating: this.rating,
    totalSessions: this.totalSessions,
    totalReviews: this.totalReviews,
    hourlyRate: this.hourlyRate,
    location: this.location,
    timezone: this.timezone,
    phone: this.phone,
    isActive: this.isActive,
    isVerified: this.isVerified,
    isApproved: this.isApproved,
    documentsUploaded: this.documentsUploaded,
    documentsVerified: this.documentsVerified,
    lastActive: this.lastActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);