const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

/**
 * Admin User Seeder
 * Creates a default admin user with proper password hashing
 */

const ADMIN_CREDENTIALS = {
  firstName: 'Admin',
  lastName: 'User',
  username: 'admin',
  email: 'admin@mentorhub.com',
  password: 'admin123456',
  role: 'admin'
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/peertutoring');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: ADMIN_CREDENTIALS.email },
        { username: ADMIN_CREDENTIALS.username }
      ]
    });
    
    if (existingAdmin) {
      console.log('Admin user already exists with email:', existingAdmin.email);
      return existingAdmin;
    }
    
    // Create admin user (password will be auto-hashed by pre-save middleware)
    const adminUser = new User({
      ...ADMIN_CREDENTIALS,
      isApproved: true,
      documentsUploaded: true,
      documentsVerified: true,
      bio: 'Default administrator account for MentorHub platform',
      // Admin documents should be automatically verified
      documents: {
        resumeDocument: {
          filename: 'admin_resume_auto_verified.pdf',
          originalName: 'Admin Resume - Auto Verified',
          path: '/auto-verified/admin_resume.pdf',
          uploadedAt: new Date(),
          verified: true,
          id: 'admin_resume_verified'
        },
        offerDocument: {
          filename: 'admin_offer_auto_verified.pdf',
          originalName: 'Admin Offer - Auto Verified',
          path: '/auto-verified/admin_offer.pdf',
          uploadedAt: new Date(),
          verified: true,
          id: 'admin_offer_verified'
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await adminUser.save();
    
    console.log('Admin user created successfully');
    console.log('Email:', ADMIN_CREDENTIALS.email);
    console.log('Password:', ADMIN_CREDENTIALS.password);
    console.log('Username:', ADMIN_CREDENTIALS.username);
    
    return adminUser;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
}

async function createSampleUsers() {
  try {
    console.log('Creating sample users...');
    
    const sampleUsers = [
      {
        firstName: 'John',
        lastName: 'Mentor',
        username: 'johnmentor',
        email: 'mentor@example.com',
        password: 'password123',
        role: 'mentor',
        bio: 'Experienced JavaScript and React mentor',
        skills: ['JavaScript', 'React', 'Node.js'],
        hourlyRate: 50,
        isApproved: true,
        documentsUploaded: true,
        documentsVerified: true
      },
      {
        firstName: 'Jane',
        lastName: 'Student',
        username: 'janestudent',
        email: 'student@example.com',
        password: 'password123',
        role: 'student',
        bio: 'Aspiring web developer',
        skills: ['HTML', 'CSS'],
        isApproved: true,
        documentsUploaded: true,
        documentsVerified: true
      }
    ];
    
    for (const userData of sampleUsers) {
      const existingUser = await User.findOne({ 
        $or: [
          { email: userData.email },
          { username: userData.username }
        ]
      });
      
      if (!existingUser) {
        // Create user (password will be auto-hashed by pre-save middleware)
        const user = new User({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await user.save();
        console.log(`Created ${userData.role}: ${userData.email}`);
      } else {
        console.log(`User already exists: ${userData.email}`);
      }
    }
    
    console.log('Sample users created successfully');
  } catch (error) {
    console.error('Error creating sample users:', error);
    throw error;
  }
}

async function cleanDatabase() {
  try {
    console.log('Cleaning database...');
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      await mongoose.connection.db.collection(collection.name).drop();
      console.log(`Dropped collection: ${collection.name}`);
    }
    
    console.log('Database cleaned successfully');
  } catch (error) {
    if (error.message.includes('ns not found')) {
      console.log('Database was already empty');
    } else {
      console.error('Error cleaning database:', error);
      throw error;
    }
  }
}

async function runSeeder() {
  try {
    await connectDB();
    
    const args = process.argv.slice(2);
    const options = {
      clean: args.includes('--clean') || args.includes('-c'),
      samples: args.includes('--samples') || args.includes('-s')
    };
    
    console.log('MentorHub Database Seeder');
    console.log('============================');
    
    if (options.clean) {
      console.log('Clean mode: Will clear all existing data');
      await cleanDatabase();
    }
    
    if (options.samples) {
      console.log('Sample mode: Will create sample mentor and student users');
    }
    
    console.log('');
    
    await createAdminUser();
    
    if (options.samples) {
      await createSampleUsers();
    }
    
    console.log('\nSeeder completed successfully!');
    console.log('\nLogin Credentials:');
    console.log('Admin - Email: admin@mentorhub.com, Password: admin123456');
    if (options.samples) {
      console.log('Mentor - Email: mentor@example.com, Password: password123');
      console.log('Student - Email: student@example.com, Password: password123');
    }
    
  } catch (error) {
    console.error('Seeder failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run seeder if called directly
if (require.main === module) {
  runSeeder();
}

module.exports = { runSeeder, createAdminUser, cleanDatabase };