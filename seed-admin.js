const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding...');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    console.log('Database cleared successfully');

    // Create admin user
    const adminUser = new User({
      email: 'admin@peertutoring.com',
      username: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      password: 'AdminPass123!',
      role: 'admin',
      bio: 'System administrator for the peer tutoring platform',
      isVerified: true,
      isApproved: true,
      isActive: true
    });

    await adminUser.save();
    console.log('Admin user created successfully');
    console.log(`Admin Email: ${adminUser.email}`);
    console.log(`Admin Username: ${adminUser.username}`);
    console.log(`Admin ID: ${adminUser._id}`);

    // Create a sample mentor
    const mentorUser = new User({
      email: 'mentor@example.com',
      username: 'samplementor',
      firstName: 'Sample',
      lastName: 'Mentor',
      password: 'MentorPass123!',
      role: 'mentor',
      bio: 'Experienced software developer with 5+ years in full-stack development',
      skills: [
        { name: 'JavaScript', level: 'expert', verified: true },
        { name: 'React', level: 'expert', verified: true },
        { name: 'Node.js', level: 'advanced', verified: true },
        { name: 'Python', level: 'advanced', verified: true },
        { name: 'MongoDB', level: 'intermediate', verified: true }
      ],
      experience: {
        workHistory: [{
          title: 'Senior Software Engineer',
          company: 'Tech Company',
          description: 'Specialized in web development and mentoring junior developers.',
          startDate: new Date('2020-01-01'),
          endDate: new Date('2025-01-01'),
          current: true
        }]
      },
      education: [{
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        institution: 'University',
        graduationYear: 2020
      }],
      location: 'San Francisco, CA',
      timezone: 'PST',
      hourlyRate: 50,
      rating: 4.8,
      totalSessions: 25,
      totalReviews: 20,
      isVerified: true,
      isApproved: true,
      isActive: true,
      availability: {
        'Monday': [{ start: '09:00', end: '17:00' }],
        'Tuesday': [{ start: '09:00', end: '17:00' }],
        'Wednesday': [{ start: '09:00', end: '17:00' }],
        'Thursday': [{ start: '09:00', end: '17:00' }],
        'Friday': [{ start: '09:00', end: '15:00' }]
      }
    });

    await mentorUser.save();
    console.log('Sample mentor created successfully');
    console.log(`Mentor Email: ${mentorUser.email}`);
    console.log(`Mentor Username: ${mentorUser.username}`);

    // Create a sample student
    const studentUser = new User({
      email: 'student@example.com',
      username: 'samplestudent',
      firstName: 'Sample',
      lastName: 'Student',
      password: 'StudentPass123!',
      role: 'student',
      bio: 'Computer science student eager to learn web development',
      skills: [
        { name: 'HTML', level: 'beginner', verified: false },
        { name: 'CSS', level: 'beginner', verified: false },
        { name: 'JavaScript', level: 'beginner', verified: false }
      ],
      education: [{
        institution: 'University',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        startDate: new Date('2022-09-01'),
        current: true
      }],
      location: 'New York, NY',
      timezone: 'EST',
      isVerified: true,
      isApproved: true,
      isActive: true
    });

    await studentUser.save();
    console.log('Sample student created successfully');
    console.log(`Student Email: ${studentUser.email}`);
    console.log(`Student Username: ${studentUser.username}`);

    console.log('\n=== SEEDING COMPLETED ===');
    console.log('You can now login with:');
    console.log('Admin: admin@peertutoring.com / AdminPass123!');
    console.log('Mentor: mentor@example.com / MentorPass123!');
    console.log('Student: student@example.com / StudentPass123!');

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the seeding
if (require.main === module) {
  seedAdmin();
}

module.exports = { seedAdmin };