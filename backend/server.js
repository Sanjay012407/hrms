const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
// Load environment configuration
const envConfig = require('./config/environment');
const config = envConfig.getConfig();
// Load utilities
const { generateSimplePassword } = require('./utils/passwordGenerator');
const { sendLoginSuccessEmail, sendCertificateExpiryEmail, sendNotificationEmail, testEmailConfiguration, sendVerificationEmail, sendAdminApprovalRequestEmail, sendUserCredentialsEmail, sendAdminNewUserCredentialsEmail, sendWelcomeEmailToNewUser } = require('./utils/emailService');
const { startCertificateMonitoring, triggerCertificateCheck } = require('./utils/certificateMonitor');
const { startAllCertificateSchedulers } = require('./utils/certificateScheduler');

const app = express();
const PORT = config.server.port;
const JWT_SECRET = config.jwt.secret;
const MONGODB_URI = config.database.uri;

// Middleware
app.use(cookieParser());

// Session middleware configuration
app.use(session({
  secret: process.env.SESSION_SECRET || JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    touchAfter: 24 * 3600, // Lazy session update
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    // Remove domain restriction to allow same-origin cookies
    domain: undefined
  },
  name: 'talentshield.sid' // Custom session name
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:5003']
    : process.env.CORS_ORIGINS?.split(',') || ['https://talentshield.co.uk'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input validation middleware
const validateProfileInput = (req, res, next) => {
  const { firstName, lastName, email } = req.body;
  
  if (!firstName || firstName.trim().length < 1) {
    return res.status(400).json({ message: 'First name is required' });
  }
  
  if (!lastName || lastName.trim().length < 1) {
    return res.status(400).json({ message: 'Last name is required' });
  }
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Valid email is required' });
  }
  
  next();
};

const validateCertificateInput = (req, res, next) => {
  const { certificate, category } = req.body;
  
  console.log('Certificate validation - received data:', { certificate, category, body: req.body });
  
  if (!certificate || certificate.trim().length < 1) {
    console.log('Certificate validation failed - missing certificate name');
    return res.status(400).json({ message: 'Certificate name is required', received: { certificate, category } });
  }
  
  if (!category || category.trim().length < 1) {
    console.log('Certificate validation failed - missing category');
    return res.status(400).json({ message: 'Certificate category is required', received: { certificate, category } });
  }
  
  console.log('Certificate validation passed');
  next();
};

// MongoDB connection
mongoose.connect(MONGODB_URI).then(() => {
  console.log('MongoDB connected successfully');
  
  // Start certificate monitoring
  const { startAllCertificateSchedulers } = require('./utils/certificateScheduler');
  startAllCertificateSchedulers();
  
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
  
  // Start certificate expiry monitoring schedulers
  console.log('Starting email notification schedulers...');
  startAllCertificateSchedulers();
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Disconnected from MongoDB');
});

// Profile Schema
const profileSchema = new mongoose.Schema({
  // User Reference
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true, index: true },
  
  // Basic Info
  firstName: { type: String, required: true, index: true },
  lastName: { type: String, required: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  mobile: String,
  dateOfBirth: Date,
  gender: String,
  profilePicture: String,
  profilePictureData: Buffer, // Store profile picture data in database
  profilePictureSize: Number, // Store file size in bytes
  profilePictureMimeType: String, // Store file MIME type
  
  // Job Details
  role: { type: String, default: 'User' },
  staffType: { type: String, default: 'Direct' },
  company: { type: String, default: 'VitruX Ltd' },
  jobRole: [String], // Array of job roles to support multiple selections
  jobTitle: { type: String, default: '' }, // Job title field - single string to fix casting error
  jobLevel: String,
  department: String, // Department field
  language: { type: String, default: 'English' },
  startDate: Date,
  
  // System IDs
  vtid: { type: Number, unique: true, sparse: true, index: true }, // VTID field
  skillkoId: { type: Number, unique: true, index: true },
  externalSystemId: String,
  extThirdPartySystemId: String,
  nopsID: String,
  insuranceNumber: String,
  
  // Additional Employee Details
  poc: String, 
  nationality: String,
  circetUIN: String,
  circetSCID: String,
  morrisonsIDNumber: String,
  morrisonsUIN: String,
  status: { type: String, default: 'Onboarding' }, // Onboarded, Onboarding, Dropped Out, Left
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
  },
  
  // Address
  address: {
    line1: String,
    line2: String,
    city: String,
    postCode: String,
    country: { type: String, default: '' },
  },
  
  // Metadata
  createdOn: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: true },
  mobileVerified: { type: Boolean, default: false },
  
  // Bio and other info
  bio: String,
  otherInformation: String,
});

// Auto-generate VTID as sequential number from 1000-9000
profileSchema.pre('save', async function(next) {
  if (!this.vtid) {
    // Find the highest existing VTID
    const lastProfile = await this.constructor.findOne({ vtid: { $exists: true } })
      .sort({ vtid: -1 })
      .select('vtid')
      .lean();
    
    let newVtid = 1000; // Start from 1000
    
    if (lastProfile && lastProfile.vtid) {
      newVtid = lastProfile.vtid + 1;
    }
    
    // Ensure we don't exceed 9000
    if (newVtid > 9000) {
      throw new Error('VTID limit exceeded. Maximum VTID is 9000.');
    }
    
    this.vtid = newVtid;
  }
  next();
});

// Auto-generate skillkoId as random 4-digit number
profileSchema.pre('save', async function(next) {
  if (!this.skillkoId) {
    let newId;
    let isUnique = false;
    
    // Generate random 4-digit number until we find a unique one
    while (!isUnique) {
      newId = Math.floor(Math.random() * 9000) + 1000; // Generates 1000-9999
      const existingProfile = await this.constructor.findOne({ skillkoId: newId });
      if (!existingProfile) {
        isUnique = true;
      }
    }
    
    this.skillkoId = newId;
   }
  next();
});

// Add compound indexes for better query performance
profileSchema.index({ firstName: 1, lastName: 1, email: 1 });
profileSchema.index({ company: 1, createdOn: -1 });
profileSchema.index({ skillkoId: 1, vtid: 1 });

const Profile = mongoose.model('Profile', profileSchema);

// User Schema for Authentication
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, unique: true, sparse: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  vtid: { type: String, unique: true, sparse: true, uppercase: true, trim: true, index: true }, // Add VTID to User
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', unique: true, sparse: true }, // Link to Profile
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  adminApprovalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  adminApprovalToken: { type: String },
  termsAcceptedAt: { type: Date },
  passwordChangedAt: { type: Date },
  lastLoginAt: { type: Date }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with salt rounds of 10
    this.password = await bcrypt.hash(this.password, 10);
    this.passwordChangedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Add method to create default admin if none exists
userSchema.statics.ensureAdminExists = async function() {
  try {
    const adminCount = await this.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      // Create default admin account
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      await this.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@talentshield.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        emailVerified: true,
        adminApprovalStatus: 'approved'
      });
      console.log('Default admin account created');
    }
  } catch (error) {
    console.error('Error ensuring admin exists:', error);
  }
};

// Clear any existing User model to avoid schema conflicts
if (mongoose.models.User) {
  delete mongoose.models.User;
}

const User = mongoose.model('User', userSchema);

// Certificate Schema
const certificateSchema = new mongoose.Schema({
  certificate: { type: String, required: true },
  description: String,
  account: String,
  issueDate: { type: Date }, // Changed to Date type
  expiryDate: { type: Date, index: true }, // Changed to Date type with index for queries
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', index: true },
  profileName: String,
  provider: String,
  fileRequired: { type: String, default: 'No' },
  active: { type: String, default: 'Yes' },
  status: { type: String, default: 'Approved', index: true },
  cost: { type: Number, default: 0 }, // Changed to Number
  category: { type: String, required: true, index: true }, 
  jobRole: String, 
  approvalStatus: String,
  isInterim: { type: Boolean, default: false }, // Changed to Boolean
  timeLogged: {
    days: { type: Number, default: 0 },
    hours: { type: Number, default: 0 },
    minutes: { type: Number, default: 0 }
  },
  supplier: String,
  totalCost: { type: Number, default: 0 }, // Changed to Number
  
  // File storage fields - store in database
  certificateFile: String, // Store original filename
  fileData: Buffer, // Store actual file data in database
  fileSize: Number, // Store file size in bytes
  mimeType: String, // Store file MIME type
  
  archived: { type: String, default: 'Unarchived' },
  createdOn: { type: Date, default: Date.now, index: true },
  updatedOn: { type: Date, default: Date.now }
});

// Helper function to parse date strings (moved from below for pre-save hook)
const parseDateString = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  
  try {
    const cleanDate = dateString.toString().trim();
    let date;
    
    // Try ISO format first (YYYY-MM-DD)
    if (cleanDate.match(/^\d{4}-\d{2}-\d{2}/)) {
      date = new Date(cleanDate);
    }
    // Try DD/MM/YYYY format
    else if (cleanDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const [day, month, year] = cleanDate.split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Default: try direct parsing
    else {
      date = new Date(cleanDate);
    }
    
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
};

// Pre-save hook to convert string dates to Date objects
certificateSchema.pre('save', function(next) {
  // Convert issueDate if it's a string
  if (this.issueDate && typeof this.issueDate === 'string') {
    this.issueDate = parseDateString(this.issueDate);
  }
  
  // Convert expiryDate if it's a string
  if (this.expiryDate && typeof this.expiryDate === 'string') {
    this.expiryDate = parseDateString(this.expiryDate);
  }
  
  // Validate expiryDate is after issueDate
  if (this.issueDate && this.expiryDate && this.expiryDate <= this.issueDate) {
    return next(new Error('Expiry date must be after issue date'));
  }
  
  // Convert cost strings to numbers
  if (typeof this.cost === 'string') {
    this.cost = parseFloat(this.cost) || 0;
  }
  
  if (typeof this.totalCost === 'string') {
    this.totalCost = parseFloat(this.totalCost) || 0;
  }
  
  // Convert isInterim string to boolean
  if (typeof this.isInterim === 'string') {
    this.isInterim = this.isInterim.toLowerCase() === 'true' || this.isInterim.toLowerCase() === 'yes';
  }
  
  // Update updatedOn timestamp
  this.updatedOn = Date.now();
  
  next();
});

const Certificate = mongoose.model('Certificate', certificateSchema);

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

const Supplier = mongoose.model('Supplier', supplierSchema);

// Job Role Schema
const jobRoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

const JobRole = mongoose.model('JobRole', jobRoleSchema);

// Job Title Schema
const jobTitleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

const JobTitle = mongoose.model('JobTitle', jobTitleSchema);

// Job Level Schema
const jobLevelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdOn: { type: Date, default: Date.now },
  usageCount: { type: Number, default: 1 }
});

const JobLevel = mongoose.model('JobLevel', jobLevelSchema);

// Certificate Name Schema
const certificateNameSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdOn: { type: Date, default: Date.now },
  usageCount: { type: Number, default: 1 }
});

const CertificateName = mongoose.model('CertificateName', certificateNameSchema);

// Notification Schema - REQUIRED for in-app notifications
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    required: true,
    enum: [
      'profile_created',
      'profile_updated', 
      'profile_deleted',
      'certificate_created',
      'certificate_updated',
      'certificate_deleted',
      'certificate_expiry',
      'certificate_expired',
      'user_created',
      'system_notification',
      'general'
    ]
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'], 
    default: 'medium' 
  },
  message: { type: String, required: true },
  title: { type: String },
  read: { type: Boolean, default: false },
  createdOn: { type: Date, default: Date.now },
  readOn: { type: Date },
  metadata: { type: mongoose.Schema.Types.Mixed }
});

// Add indexes for better query performance
notificationSchema.index({ userId: 1, createdOn: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ type: 1, createdOn: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

// Multer configuration for file uploads with 10MB limit
const storage = multer.memoryStorage(); // Store in memory for database storage

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF files for certificates and images for profile pictures
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'image/jpeg' || 
        file.mimetype === 'image/png' || 
        file.mimetype === 'image/jpg') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPEG, PNG files are allowed'), false);
    }
  }
});

// Routes

// Helper function to parse date strings in various formats
const parseExpiryDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // Handle different date formats
    let date;
    
    // Check if it's already a valid Date object
    if (dateString instanceof Date) {
      return dateString;
    }
    
    // Convert to string and clean up
    const cleanDate = dateString.toString().trim();
    
    // Try ISO format first (YYYY-MM-DD)
    if (cleanDate.match(/^\d{4}-\d{2}-\d{2}/)) {
      date = new Date(cleanDate);
    }
    // Try DD/MM/YYYY format
    else if (cleanDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const [day, month, year] = cleanDate.split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Try MM/DD/YYYY format
    else if (cleanDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) && new Date(cleanDate).getTime()) {
      date = new Date(cleanDate);
    }
    // Try YYYY/MM/DD format
    else if (cleanDate.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
      const [year, month, day] = cleanDate.split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Default: try direct parsing
    else {
      date = new Date(cleanDate);
    }
    
    // Validate the date
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${dateString}`);
      return null;
    }
    
    return date;
  } catch (error) {
    console.warn(`Error parsing date: ${dateString}`, error);
    return null;
  }
};

// Routes

// Get all profiles (optimized - excludes large binary data)
app.get('/api/profiles', async (req, res) => {
  try {
    // Exclude large binary fields to optimize performance
    const profiles = await Profile.find()
      .select('-profilePictureData -profilePictureSize -profilePictureMimeType') // Exclude binary data
      .sort({ createdOn: -1 })
      .lean(); // Returns plain JavaScript objects instead of Mongoose documents
    
    console.log(`Fetched ${profiles.length} profiles (optimized)`);
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all profiles with complete data (for admin/bulk operations)
app.get('/api/profiles/complete', async (req, res) => {
  try {
    // Return all profile fields including binary data (use sparingly)
    const profiles = await Profile.find()
      .sort({ createdOn: -1 })
      .lean();
    
    console.log(`Fetched ${profiles.length} profiles (complete data)`);
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching complete profiles:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get profiles with pagination (for large datasets)
app.get('/api/profiles/paginated', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const profiles = await Profile.find()
      .select('-profilePictureData -profilePictureSize -profilePictureMimeType')
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Profile.countDocuments();
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      profiles,
      pagination: {
        currentPage: page,
        totalPages,
        totalProfiles: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching paginated profiles:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get profile by ID (optimized - excludes binary data)
app.get('/api/profiles/:id', async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id)
      .select('-profilePictureData -profilePictureSize -profilePictureMimeType')
      .lean();
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify email endpoint
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    console.log('Email verification request received');
    
    if (!token) {
      console.log('Verification failed: Missing token');
      return res.status(400).send('Missing verification token');
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      console.log('Token verified successfully for email:', payload.email);
    } catch (e) {
      console.log('Token verification failed:', e.message);
      return res.status(400).send('Invalid or expired verification token');
    }

    // First try to find user with matching email and token
    let user = await User.findOne({ email: payload.email, verificationToken: token });
    
    // If not found with exact token match, try just by email
    if (!user) {
      console.log('User not found with exact token match, trying by email only...');
      user = await User.findOne({ email: payload.email });
      
      if (!user) {
        console.log('User not found at all for email:', payload.email);
        return res.status(404).send('User not found. The verification link may have expired or the account may have been deleted.');
      }
      
      // Check if already verified
      if (user.emailVerified) {
        console.log('User email already verified:', payload.email);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/login?verified=true&message=already_verified`);
      }
      
      // Token doesn't match but user exists - could be expired or wrong token
      console.log('Token mismatch for user. Stored token:', user.verificationToken ? 'exists' : 'missing');
    }

    // Mark as verified
    user.emailVerified = true;
    user.verificationToken = undefined;
    await user.save();
    
    console.log('Email verified successfully for:', user.email);

    // Get frontend URL for redirect
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // If user is admin, redirect to login (they still need approval)
    if (user.role === 'admin') {
      console.log('Admin user verified, redirecting to login (still needs approval)');
      return res.redirect(`${frontendUrl}/login?verified=true&message=pending_approval`);
    } else {
      // For regular users, redirect to login with success message
      console.log('Regular user verified, redirecting to login');
      return res.redirect(`${frontendUrl}/login?verified=true`);
    }
  } catch (error) {
    console.error('Verify email error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/login?error=verification_failed`);
  }
});

// Approve admin endpoint (accessed via email link by super admin)
app.get('/api/auth/approve-admin', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Missing token');

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(400).send('Invalid or expired token');
    }

    const user = await User.findOne({ email: payload.email, adminApprovalToken: token });
    if (!user) return res.status(404).send('User not found');

    if (user.role !== 'admin') return res.status(400).send('User is not an admin');

    user.adminApprovalStatus = 'approved';
    user.adminApprovalToken = undefined;
    user.emailVerified = true; // Auto-verify email when admin is approved
    await user.save();

    res.send('Admin account approved successfully.');
  } catch (error) {
    console.error('Approve admin error:', error);
    res.status(500).send('Server error');
  }
});

// Get profile by ID with complete data (including binary data)
app.get('/api/profiles/:id/complete', async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new profile
app.post('/api/profiles', validateProfileInput, async (req, res) => {
  try {
    // Handle jobTitle array from frontend - convert to string
    const profileData = { ...req.body };
    if (Array.isArray(profileData.jobTitle)) {
      // If array, take first element or join with comma
      profileData.jobTitle = profileData.jobTitle.length > 0 ? profileData.jobTitle[0] : '';
    }
    
    const profile = new Profile(profileData);
    const savedProfile = await profile.save();
    
    // Create user account for the profile
    try {
      // Check if user account already exists
      const existingUser = await User.findOne({ email: savedProfile.email });
      
      if (!existingUser) {
        // Use VTID as the initial password (will be hashed by pre-save hook)
        const vtidPassword = savedProfile.vtid.toString();
        
        // Create user account
        const newUser = new User({
          firstName: savedProfile.firstName,
          lastName: savedProfile.lastName,
          email: savedProfile.email,
          password: vtidPassword, // Password will be hashed by pre-save hook
          vtid: savedProfile.vtid.toString(), // Store VTID in User for VTID-based login
          role: 'user',
          isActive: true,
          emailVerified: true, // Auto-verify user accounts created by admin
          profileId: savedProfile._id
        });
        
        await newUser.save();
        console.log('User account created for profile:', savedProfile.email);
        
        // Update profile with user reference
        savedProfile.userId = newUser._id;
        await savedProfile.save();
        
        // Send credentials email to user
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const loginUrl = `${frontendUrl}/login`;
        const userName = `${savedProfile.firstName} ${savedProfile.lastName}`;
        
        await sendUserCredentialsEmail(savedProfile.email, userName, savedProfile.vtid, loginUrl);
        console.log('Credentials email sent to:', savedProfile.email);
      }
    } catch (userCreationError) {
      console.error('Error creating user account:', userCreationError);
      // Don't fail the profile creation if user account creation fails
    }
    
    // Send comprehensive email notifications
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const loginUrl = `${frontendUrl}/login`;
      
      // Check if a new user was created
      const wasNewUserCreated = await User.findOne({ profileId: savedProfile._id });
      
      // 1. Send profile creation email to user (with credentials if new user)
      const userCredentials = wasNewUserCreated ? {
        email: savedProfile.email,
        password: savedProfile.vtid.toString()
      } : null;
      
      await sendProfileCreationEmail(savedProfile, userCredentials);
      console.log('Profile creation email sent to user:', savedProfile.email);
      
      // 2. Send notification to all admins
      const adminUsers = await User.find({ role: 'admin' });
      for (const admin of adminUsers) {
        if (userCredentials) {
          // Send admin notification with user credentials
          await sendAdminNewUserCredentialsEmail(
            admin.email,
            `${savedProfile.firstName} ${savedProfile.lastName}`,
            savedProfile.email,
            userCredentials.password,
            loginUrl
          );
        } else {
          // Send general admin notification
          await sendNotificationEmail(
            admin.email,
            `${admin.firstName} ${admin.lastName}`,
            'New Profile Created',
            `A new profile has been created for ${savedProfile.firstName} ${savedProfile.lastName} (${savedProfile.email}).`,
            'info'
          );
        }
      }
      console.log('Admin notifications sent for profile creation');
      
    } catch (emailError) {
      console.error('Error sending profile creation emails:', emailError);
    }
    
    // Create in-app notification for profile creation
    try {
      const users = await User.find({ role: 'admin' });
      for (const user of users) {
        const notification = new Notification({
          userId: user._id,
          type: 'profile_created',
          priority: 'low',
          message: `New profile created: ${savedProfile.firstName} ${savedProfile.lastName}`,
          read: false
        });
        await notification.save();
      }
    } catch (notificationError) {
      console.error('Error creating notifications:', notificationError);
    }
    
    res.status(201).json(savedProfile);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Update profile
app.put('/api/profiles/:id', async (req, res) => {
  try {
    const profileId = req.params.id;
    
    // Get original profile for comparison
    const originalProfile = await Profile.findById(profileId);
    if (!originalProfile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Handle jobTitle array from frontend - convert to string
    const updateData = { ...req.body };
    if (Array.isArray(updateData.jobTitle)) {
      updateData.jobTitle = updateData.jobTitle.length > 0 ? updateData.jobTitle[0] : '';
    }
    
    const updatedProfile = await Profile.findByIdAndUpdate(
      profileId,
      { ...updateData, lastSeen: new Date() },
      { new: true, runValidators: true }
    );
    
    // CRITICAL FIX: Update associated certificates if profile name changed
    const nameChanged = (
      originalProfile.firstName !== updatedProfile.firstName ||
      originalProfile.lastName !== updatedProfile.lastName
    );
    
    if (nameChanged) {
      const newProfileName = `${updatedProfile.firstName} ${updatedProfile.lastName}`;
      
      // Update all certificates with the new profile name to maintain sync
      await Certificate.updateMany(
        { profileId: profileId },
        { profileName: newProfileName }
      );
      
      console.log(`Updated certificate profile names for profile ${profileId} to: ${newProfileName}`);
    }
    
    // Update associated user account if email changed
    if (originalProfile.email !== updatedProfile.email) {
      await User.findOneAndUpdate(
        { profileId: profileId },
        { 
          email: updatedProfile.email,
          firstName: updatedProfile.firstName,
          lastName: updatedProfile.lastName
        }
      );
      console.log(`Updated user account email from ${originalProfile.email} to ${updatedProfile.email}`);
    }
    
    // Send email notifications
    try {
      // Determine what fields were updated
      const updatedFields = {};
      Object.keys(updateData).forEach(key => {
        if (originalProfile[key] !== updatedProfile[key]) {
          updatedFields[key] = updatedProfile[key];
        }
      });
      
      if (Object.keys(updatedFields).length > 0) {
        // Send update notification to user
        await sendProfileUpdateEmail(updatedProfile, updatedFields);
        console.log('Profile update email sent to user:', updatedProfile.email);
        
        // Send notification to admins
        const adminUsers = await User.find({ role: 'admin' });
        for (const admin of adminUsers) {
          await sendNotificationEmail(
            admin.email,
            `${admin.firstName} ${admin.lastName}`,
            'Profile Updated',
            `Profile updated for ${updatedProfile.firstName} ${updatedProfile.lastName}. Updated fields: ${Object.keys(updatedFields).join(', ')}.`,
            'info'
          );
        }
        console.log('Admin notifications sent for profile update');
      }
      
    } catch (emailError) {
      console.error('Error sending profile update emails:', emailError);
    }
    
    // Create in-app notification for profile update
    try {
      const users = await User.find({ role: 'admin' });
      for (const user of users) {
        const notification = new Notification({
          userId: user._id,
          type: 'profile_updated',
          priority: 'low',
          message: `Profile updated: ${updatedProfile.firstName} ${updatedProfile.lastName}`,
          read: false
        });
        await notification.save();
      }
    } catch (notificationError) {
      console.error('Error creating update notification:', notificationError);
    }
    
    res.json(updatedProfile);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Upload profile picture
app.post('/api/profiles/:id/upload-picture', upload.single('profilePicture'), async (req, res) => {
  try {
    console.log('Profile picture upload endpoint called');
    console.log('Profile ID:', req.params.id);
    console.log('File received:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
    console.log('Request headers:', req.headers);
    
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Check file size (10MB limit)
    if (req.file.size > 10 * 1024 * 1024) {
      console.log('File size exceeds limit:', req.file.size);
      return res.status(400).json({ message: 'File size exceeds 10MB limit' });
    }
    
    console.log('File validation passed, updating profile...');
    
    const profile = await Profile.findByIdAndUpdate(
      req.params.id,
      { 
        profilePicture: `/api/profiles/${req.params.id}/picture`,
        profilePictureData: req.file.buffer,
        profilePictureSize: req.file.size,
        profilePictureMimeType: req.file.mimetype
      },
      { new: true }
    );
    
    if (!profile) {
      console.log('Profile not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    console.log('Profile picture uploaded successfully');
    res.json({ profilePicture: profile.profilePicture });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ message: error.message });
  }
});

// Serve profile picture from database
app.get('/api/profiles/:id/picture', async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    if (!profile.profilePictureData) {
      return res.status(404).json({ message: 'No profile picture found for this profile' });
    }
    
    res.set({
      'Content-Type': profile.profilePictureMimeType || 'image/jpeg',
      'Content-Length': profile.profilePictureSize,
      'Content-Disposition': `inline; filename="profile-${profile._id}.jpg"`,
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });
    
    res.send(profile.profilePictureData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get profile statistics (certificates count, etc.)
app.get('/api/profiles/:id/stats', async (req, res) => {
  try {
    const profileId = req.params.id;
    
    // Count certificates associated with this profile
    const certificateCount = await Certificate.countDocuments({ profileId: profileId });
    
    // Get profile basic info
    const profile = await Profile.findById(profileId, 'firstName lastName email');
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    res.json({
      profile: {
        id: profile._id,
        name: `${profile.firstName} ${profile.lastName}`,
        email: profile.email
      },
      certificates: {
        total: certificateCount
      }
    });
  } catch (error) {
    console.error('Error getting profile stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Test endpoint to verify API is working
app.get('/api/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'API is working', timestamp: new Date().toISOString() });
});

// Delete profile
app.delete('/api/profiles/:id', async (req, res) => {
  try {
    console.log('Delete profile endpoint called with ID:', req.params.id);
    console.log('Request headers:', req.headers);
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log('Invalid ObjectId format:', req.params.id);
      return res.status(400).json({ message: 'Invalid profile ID format' });
    }
    
    const profile = await Profile.findById(req.params.id);
    if (!profile) {
      console.log('Profile not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    console.log('Profile found:', profile.firstName, profile.lastName);

    // Send email notification to user BEFORE deletion
    try {
      await sendNotificationEmail(
        profile.email,
        `${profile.firstName} ${profile.lastName}`,
        'Profile Deletion Notice',
        `Your profile has been deleted from the HRMS system. If you have any questions, please contact your administrator.`,
        'warning'
      );
      console.log('Profile deletion email sent to user:', profile.email);
    } catch (emailError) {
      console.error('Error sending profile deletion email:', emailError);
    }

    // Delete all certificates associated with this profile
    const deletedCertificates = await Certificate.deleteMany({ profileId: req.params.id });
    console.log(`Deleted ${deletedCertificates.deletedCount} certificates for profile ${req.params.id}`);

    // Find and delete the associated user account (if exists)
    // Users are created with email matching the profile email
    const associatedUser = await User.findOne({ 
      email: profile.email, 
      role: 'user'
    });
    
    if (associatedUser) {
      await User.findByIdAndDelete(associatedUser._id);
      console.log(`Deleted associated user account ${associatedUser._id} for profile ${profile.email}`);
    }

    // Delete the profile
    await Profile.findByIdAndDelete(req.params.id);
    console.log(`Deleted profile ${req.params.id}`);
    
    // Create notifications for admins
    try {
      const adminUsers = await User.find({ role: 'admin' });
      for (const adminUser of adminUsers) {
        // Notification for profile deletion
        const profileNotification = new Notification({
          userId: adminUser._id,
          type: 'profile_deleted',
          priority: 'medium',
          message: `Profile deleted: ${profile.firstName} ${profile.lastName}`,
          read: false
        });
        await profileNotification.save();

        // Notification for certificate deletion (if any)
        if (deletedCertificates.deletedCount > 0) {
          const certNotification = new Notification({
            userId: adminUser._id,
            type: 'certificate_deleted',
            priority: 'medium',
            message: `${deletedCertificates.deletedCount} certificate(s) deleted with profile: ${profile.firstName} ${profile.lastName}`,
            read: false
          });
          await certNotification.save();
        }
      }
    } catch (notificationError) {
      console.error('Error creating delete notifications:', notificationError);
    }
    
    console.log('Profile deletion completed successfully');
    res.json({ 
      message: 'Profile and associated data deleted successfully',
      details: {
        profileDeleted: true,
        certificatesDeleted: deletedCertificates.deletedCount,
        userAccountDeleted: !!associatedUser
      }
    });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ message: error.message });
  }
});

// Certificate Routes

// Get all certificates
app.get('/api/certificates', async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .select('-fileData')
      .sort({ createdOn: -1 })
      .populate('profileId', 'vtid firstName lastName');
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Dashboard stats - MUST be before :id route
app.get('/api/certificates/dashboard-stats', async (req, res) => {
  try {
    const days = Number.parseInt(req.query.days, 10) || 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + days);
    cutoff.setHours(23, 59, 59, 999);

    // Only pull the fields we need; exclude file blobs; lean for perf
    const allCertificates = await Certificate.find(
      { expiryDate: { $exists: true, $ne: null } },
      {
        certificate: 1,
        expiryDate: 1,
        profileId: 1,
        profileName: 1,
        category: 1,
        active: 1,
        status: 1,
      }
    )
    .populate('profileId', 'firstName lastName')
    .lean();

    const categoryCounts = {};
    const expiring = [];
    const expired = [];
    const active = [];

    for (const cert of allCertificates) {
      // Expiry date parsing
      const expiryDate = parseExpiryDate(cert.expiryDate);
      if (!expiryDate) continue;
      
      // Set to end of day for proper comparison
      expiryDate.setHours(23, 59, 59, 999);

      const base = {
        id: cert._id?.toString?.() || cert.id,
        certificate: cert.certificate,
        expiryDate: cert.expiryDate,
        profileName:
          cert.profileName ||
          [cert.profileId?.firstName, cert.profileId?.lastName].filter(Boolean).join(' '),
      };

      // Active = not expired (expiry date >= today)
      if (expiryDate >= today) {
        active.push(cert);
        // Count categories for active certificates
        if (cert.category) {
          categoryCounts[cert.category] = (categoryCounts[cert.category] || 0) + 1;
        }
      }

      // Expiring = expiring within selected days (not expired yet)
      if (expiryDate >= today && expiryDate <= cutoff) {
        expiring.push({ ...base, _expiry: expiryDate });
      } else if (expiryDate < today) {
        // Expired = expiry date is before today
        expired.push({ ...base, _expiry: expiryDate });
      }
    }

    const activeCount = active.length;

    // Sort for better UX
    expiring.sort((a, b) => a._expiry - b._expiry);
    expired.sort((a, b) => a._expiry - b._expiry);

    // Limit and strip helper field
    const expiringCertificates = expiring.slice(0, 10).map(({ _expiry, ...rest }) => rest);
    const expiredCertificates = expired.slice(0, 10).map(({ _expiry, ...rest }) => rest);

    res.json({
      activeCount,
      expiringCertificates,
      expiredCertificates,
      categoryCounts,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get certificate by ID
app.get('/api/certificates/:id', async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id)
      .select('-fileData')
      .populate('profileId', 'vtid firstName lastName');
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    res.json(certificate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new certificate with file upload
app.post('/api/certificates', upload.single('certificateFile'), validateCertificateInput, async (req, res) => {
  try {
    const certificateData = { ...req.body };
    
    // Validate profileId if provided
    if (certificateData.profileId) {
      if (!mongoose.Types.ObjectId.isValid(certificateData.profileId)) {
        return res.status(400).json({ message: 'Invalid profileId format' });
      }
      
      const profile = await Profile.findById(certificateData.profileId);
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      
      // Auto-set profileName from profile
      certificateData.profileName = `${profile.firstName} ${profile.lastName}`;
    }
    
    // Handle file upload if present - store in database
    if (req.file) {
      // Check file size (10MB limit already enforced by multer)
      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ message: 'File size exceeds 10MB limit' });
      }
      
      certificateData.certificateFile = req.file.originalname;
      certificateData.fileData = req.file.buffer; // Store file data in database
      certificateData.fileSize = req.file.size;
      certificateData.mimeType = req.file.mimetype;
    }

    const certificate = new Certificate(certificateData);
    const savedCertificate = await certificate.save();
    
    // Send comprehensive email notifications
    if (certificateData.profileId) {
      try {
        const profile = await Profile.findById(certificateData.profileId);
        if (profile) {
          // Send notification to user
          await sendCertificateAddedEmail(profile, savedCertificate);
          console.log('Certificate added email sent to user:', profile.email);
          
          // Send notification to admins
          const adminUsers = await User.find({ role: 'admin' });
          for (const admin of adminUsers) {
            await sendNotificationEmail(
              admin.email,
              `${admin.firstName} ${admin.lastName}`,
              'Certificate Added',
              `New certificate "${savedCertificate.certificate}" has been added for ${profile.firstName} ${profile.lastName}.`,
              'success'
            );
          }
          console.log('Admin notifications sent for certificate addition');
        }
      } catch (emailError) {
        console.error('Error sending certificate creation emails:', emailError);
      }
    }
    
    // Create in-app notification for certificate creation
    try {
      const users = await User.find({ role: 'admin' });
      for (const user of users) {
        const notification = new Notification({
          userId: user._id,
          type: 'certificate_created',
          priority: 'low',
          message: `New certificate added: ${savedCertificate.certificate} for ${savedCertificate.profileName}`,
          read: false
        });
        await notification.save();
      }
    } catch (notificationError) {
      console.error('Error creating certificate notification:', notificationError);
    }
    
    res.status(201).json(savedCertificate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update certificate (without file)
app.put('/api/certificates/:id', async (req, res) => {
  try {
    const certificateId = req.params.id;
    
    // Get original certificate for comparison
    const originalCertificate = await Certificate.findById(certificateId).populate('profileId');
    if (!originalCertificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    const updateData = { 
      ...req.body,
      updatedOn: new Date()
    };
    
    const certificate = await Certificate.findByIdAndUpdate(
      certificateId,
      updateData,
      { new: true, runValidators: true }
    ).populate('profileId').select('-fileData');
    
    // Send email notifications if significant changes occurred
    try {
      const profile = certificate.profileId;
      if (profile) {
        // Determine what fields were updated
        const significantFields = ['certificate', 'expiryDate', 'status', 'approvalStatus'];
        const hasSignificantChanges = significantFields.some(field => 
          originalCertificate[field] !== certificate[field]
        );
        
        if (hasSignificantChanges) {
          // Send update notification to user
          await sendNotificationEmail(
            profile.email,
            `${profile.firstName} ${profile.lastName}`,
            'Certificate Updated',
            `Your certificate "${certificate.certificate}" has been updated.`,
            'info'
          );
          console.log('Certificate update email sent to user:', profile.email);
          
          // Send notification to admins
          const adminUsers = await User.find({ role: 'admin' });
          for (const admin of adminUsers) {
            await sendNotificationEmail(
              admin.email,
              `${admin.firstName} ${admin.lastName}`,
              'Certificate Updated',
              `Certificate "${certificate.certificate}" for ${profile.firstName} ${profile.lastName} has been updated.`,
              'info'
            );
          }
          console.log('Admin notifications sent for certificate update');
        }
      }
    } catch (emailError) {
      console.error('Error sending certificate update emails:', emailError);
    }
    
    res.json(certificate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update certificate with file upload
app.put('/api/certificates/:id/upload', upload.single('certificateFile'), async (req, res) => {
  try {
    console.log('File upload request received for certificate ID:', req.params.id);
    console.log('File info:', req.file);
    console.log('Request body:', req.body);

    const updateData = { updatedOn: new Date() };
    
    // If file is uploaded, store in database
    if (req.file) {
      // Check file size (10MB limit already enforced by multer)
      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ message: 'File size exceeds 10MB limit' });
      }
      
      updateData.certificateFile = req.file.originalname;
      updateData.fileData = req.file.buffer; // Store file data in database
      updateData.fileSize = req.file.size;
      updateData.mimeType = req.file.mimetype;
      console.log('File uploaded successfully:', req.file.originalname);
    } else {
      console.log('No file received in request');
    }
    
    // Add any other fields from request body
    Object.assign(updateData, req.body);
    
    const certificate = await Certificate.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!certificate) {
      console.log('Certificate not found with ID:', req.params.id);
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    console.log('Certificate updated successfully:', certificate._id);
    res.json(certificate);
  } catch (error) {
    console.error('Error in certificate file upload:', error);
    res.status(400).json({ message: error.message });
  }
});

// Serve certificate file from database
app.get('/api/certificates/:id/file', async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    if (!certificate.fileData) {
      return res.status(404).json({ message: 'No file found for this certificate' });
    }
    
    // Set appropriate headers
    res.set({
      'Content-Type': certificate.mimeType || 'application/octet-stream',
      'Content-Length': certificate.fileSize,
      'Content-Disposition': `inline; filename="${certificate.certificateFile}"`,
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });
    
    res.send(certificate.fileData);
  } catch (error) {
    console.error('Error serving certificate file:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete certificate file from database
app.delete('/api/certificates/:id/file', async (req, res) => {
  try {
    console.log('Delete certificate file request for ID:', req.params.id);
    
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    // Remove file data from certificate
    certificate.certificateFile = null;
    certificate.fileData = null;
    certificate.fileSize = null;
    certificate.mimeType = null;
    certificate.updatedOn = new Date();
    
    await certificate.save();
    
    console.log('Certificate file deleted successfully for ID:', req.params.id);
    
    // Return updated certificate without binary data
    const updatedCert = await Certificate.findById(req.params.id).select('-fileData');
    res.json({ 
      message: 'Certificate file deleted successfully',
      certificate: updatedCert
    });
  } catch (error) {
    console.error('Error deleting certificate file:', error);
    res.status(500).json({ message: error.message });
  }
});

// Serve certificate file for viewing (not downloading)

// Delete certificate with enhanced email notifications
app.delete('/api/certificates/:id', async (req, res) => {
  try {
    const certificateId = req.params.id;
    
    const certificate = await Certificate.findById(certificateId).populate('profileId');
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    const profile = certificate.profileId;
    
    // Delete certificate
    await Certificate.findByIdAndDelete(certificateId);
    
    // Send email notifications
    if (profile) {
      try {
        // Send notification to user
        await sendCertificateDeletedEmail(profile, certificate);
        console.log('Certificate deletion email sent to user:', profile.email);
        
        // Send notification to admins
        const adminUsers = await User.find({ role: 'admin' });
        for (const admin of adminUsers) {
          await sendNotificationEmail(
            admin.email,
            `${admin.firstName} ${admin.lastName}`,
            'Certificate Deleted',
            `Certificate "${certificate.certificate}" for ${profile.firstName} ${profile.lastName} has been deleted.`,
            'warning'
          );
        }
        console.log('Admin notifications sent for certificate deletion');
        
      } catch (emailError) {
        console.error('Error sending certificate deletion emails:', emailError);
      }
    }
    
    res.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Supplier Routes

// Get all suppliers
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ usageCount: -1, name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create or get supplier
app.post('/api/suppliers', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }
    
    const trimmedName = name.trim();
    
    // Check if supplier already exists
    let supplier = await Supplier.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    
    if (supplier) {
      // Increment usage count
      supplier.usageCount += 1;
      await supplier.save();
    } else {
      // Create new supplier
      supplier = new Supplier({
        name: trimmedName,
        createdBy: req.user?.userId,
        usageCount: 1
      });
      await supplier.save();
    }
    
    res.json(supplier);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Supplier already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Search suppliers
app.get('/api/suppliers/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      // Return more suppliers when no search query (increased from 10 to 50)
      const suppliers = await Supplier.find().sort({ usageCount: -1, name: 1 }).limit(50);
      return res.json(suppliers);
    }
    
    // Return all matching suppliers (no limit for search results)
    const suppliers = await Supplier.find({
      name: { $regex: q, $options: 'i' }
    }).sort({ usageCount: -1, name: 1 });
    
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Job Title Routes

// Get all job titles
app.get('/api/job-titles', async (req, res) => {
  try {
    const jobTitles = await JobTitle.find({ isActive: true }).sort({ name: 1 });
    res.json(jobTitles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search job titles
app.get('/api/job-titles/search', async (req, res) => {
  try {
    const { q } = req.query;
    const jobTitles = await JobTitle.find({
      name: { $regex: q, $options: 'i' },
      isActive: true
    }).sort({ name: 1 }).limit(10);
    res.json(jobTitles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new job title
app.post('/api/job-titles', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Job title name is required' });
    }
    
    const trimmedName = name.trim();
    
    // Check if job title already exists
    let jobTitle = await JobTitle.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    
    if (jobTitle) {
      return res.json(jobTitle);
    }
    
    // Create new job title
    jobTitle = new JobTitle({
      name: trimmedName,
      description: description?.trim(),
      createdBy: req.user?.userId
    });
    await jobTitle.save();
    
    res.status(201).json(jobTitle);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Job title already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Job Level Routes

// Get all job levels
app.get('/api/job-levels', async (req, res) => {
  try {
    const jobLevels = await JobLevel.find().sort({ usageCount: -1, name: 1 });
    res.json(jobLevels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create or get job level
app.post('/api/job-levels', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Job level name is required' });
    }
    
    const trimmedName = name.trim();
    
    // Check if job level already exists
    let jobLevel = await JobLevel.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    
    if (jobLevel) {
      // Increment usage count
      jobLevel.usageCount += 1;
      await jobLevel.save();
    } else {
      // Create new job level
      jobLevel = new JobLevel({
        name: trimmedName,
        createdBy: req.user?.userId,
        usageCount: 1
      });
      await jobLevel.save();
    }
    
    res.json(jobLevel);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Job level already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Search job levels
app.get('/api/job-levels/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      // Return more job levels when no search query (increased from 10 to 50)
      const jobLevels = await JobLevel.find().sort({ usageCount: -1, name: 1 }).limit(50);
      return res.json(jobLevels);
    }
    
    // Return all matching job levels (no limit for search results)
    const jobLevels = await JobLevel.find({
      name: { $regex: q, $options: 'i' }
    }).sort({ usageCount: -1, name: 1 });
    
    res.json(jobLevels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Certificate Name Routes

// Get all certificate names
app.get('/api/certificate-names', async (req, res) => {
  try {
    const certificateNames = await CertificateName.find().sort({ usageCount: -1, name: 1 });
    res.json(certificateNames);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create or get certificate name
app.post('/api/certificate-names', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Certificate name is required' });
    }
    
    const trimmedName = name.trim();
    
    // Check if certificate name already exists
    let certificateName = await CertificateName.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    
    if (certificateName) {
      // Increment usage count
      certificateName.usageCount += 1;
      await certificateName.save();
    } else {
      // Create new certificate name
      certificateName = new CertificateName({
        name: trimmedName,
        createdBy: req.user?.userId,
        usageCount: 1
      });
      await certificateName.save();
    }
    
    res.json(certificateName);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Certificate name already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Search certificate names
app.get('/api/certificate-names/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      // Return all certificate names when no search query
      const certificateNames = await CertificateName.find().sort({ usageCount: -1, name: 1 });
      return res.json(certificateNames);
    }
    
    // Return all matching certificate names (no limit)
    const certificateNames = await CertificateName.find({
      name: { $regex: q, $options: 'i' }
    }).sort({ usageCount: -1, name: 1 });
    
    res.json(certificateNames);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Initialize predefined certificate names
app.post('/api/certificate-names/initialize', async (req, res) => {
  try {
    const predefinedCertificates = [
      'SA006', 'SA001', 'SA001A', 'SA009', 'SA051C', 'IPAF 1B', 'SA020', 'A16', 'SA020A', 'SA007',
      'SA021', 'A14', 'GO1', 'EUSR Category 3', 'EUSR Category 4', 'EUSR Category 5',
      'Level 2 Award Excavation support systems', 'MOCOPA', 'Emergency first Aid', 'SA018',
      'NRSWA Card Certificate S1', 'NRSWA Certificate LA', 'NRSWA Certificate O2', 'NRSWA Certificate O3',
      'NRSWA Certificate O4', 'NRSWA Certificate O5', 'NRSWA Certificate O6', 'NRSWA Certificate O7',
      'NRSWA Certificate O8', 'SA051C or Equivalent', 'K008', 'SA005', 'SA003', 'K009', 'N020', 'J005',
      'SA008', 'SA024', 'S017', 'M022', 'M006', 'N10', 'N039', 'SA023 or Equivalent', 'K003', 'K004',
      'O008', '1a', '3a', '3b or Equivalent', 'Q035(SEC1)', 'Q036(SLEW1)', 'Q037(SLEW2)', 'Q038(SLEW3)',
      'Certificate O6', 'Certificate O7', 'Certificate O5', 'N025', 'F016', 'F022', 'SA004', 'N024',
      'H004', 'J008', 'F017', 'G005', 'N030', 'N006', 'G39', 'UKATA', 'SA026 or Equivalent', 'S013',
      'S018', 'K006', 'N033', 'N023', 'N026', 'N034', 'N028', 'N027', 'S011', 'M023', 'S012', 'M029',
      'N029', 'N038', 'N022', 'N043', 'N011', 'N037', 'N036', 'N041', 'N035', 'O002', 'O003', 'O004',
      'O005', 'O006', 'E001', 'F020', 'O009', 'Q020(DB1)', 'Q013(BB1M)', 'Q012(BB1C)', 'Q014(BB2C)',
      'Q015(BB3C)', 'Q011(BB1B)', 'Q029(MH1)', 'Q031', 'Q021(DL1)', 'Q019(CD1)', 'Q022(DL2)', 'Q023(DL3)',
      'Q030(MP1)', 'Q028(ME1)', 'Q025(FCFW1)', 'Q024(FCCW1)', 'Q016(CB2)', 'Q017(CB3)', 'Q018(CCC1)',
      'Q039', 'N005', 'H001', 'N031(ODF)', 'N004(OCR)', 'J010(OFF)', 'J010(OFR)', 'C004', 'F005',
      'F023', 'K010', 'C&G Part 1,2 & 3', '18th edition', 'C&G 2391 - 51', 'Ace Telecoms Battery installation course', 'A350'
    ];

    let addedCount = 0;
    for (const certName of predefinedCertificates) {
      const existing = await CertificateName.findOne({ name: { $regex: new RegExp(`^${certName}$`, 'i') } });
      if (!existing) {
        await new CertificateName({ name: certName, usageCount: 1 }).save();
        addedCount++;
      }
    }

    res.json({ message: `Initialized ${addedCount} new certificate names`, total: predefinedCertificates.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Notification Routes

// Get all notifications for a user
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Mark all notifications as read for a user
app.put('/api/notifications/user/:userId/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.params.userId, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get unread notification count
app.get('/api/notifications/:userId/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      userId: req.params.userId, 
      read: false 
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Dashboard Analytics Endpoints

// Get certificate statistics for dashboard
app.get('/api/certificates/analytics/stats', async (req, res) => {
  try {
    const totalCertificates = await Certificate.countDocuments();
    const activeCertificates = await Certificate.countDocuments({ 
      active: 'Yes', 
      status: 'Approved' 
    });
    
    // Calculate expiring certificates (within 30 days)
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const expiringCertificates = await Certificate.find({
      active: 'Yes',
      status: 'Approved',
      expiryDate: { $exists: true, $ne: null }
    });
    
    let expiringCount = 0;
    let expiredCount = 0;
    
    expiringCertificates.forEach(cert => {
      if (cert.expiryDate) {
        const expiryDate = parseExpiryDate(cert.expiryDate);
        
        if (expiryDate) {
          if (expiryDate < today) {
            expiredCount++;
          } else if (expiryDate <= thirtyDaysFromNow) {
            expiringCount++;
          }
        }
      }
    });
    
    res.json({
      total: totalCertificates,
      active: activeCertificates,
      expiring: expiringCount,
      expired: expiredCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get certificates by category
app.get('/api/certificates/analytics/by-category', async (req, res) => {
  try {
    const certificates = await Certificate.find({ 
      active: 'Yes', 
      status: 'Approved' 
    });
    
    const categoryCounts = {};
    certificates.forEach(cert => {
      const category = cert.category || 'Other';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    res.json(categoryCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get certificates by job role
app.get('/api/certificates/analytics/by-job-role', async (req, res) => {
  try {
    const certificates = await Certificate.find({ 
      active: 'Yes', 
      status: 'Approved' 
    });
    
    const jobRoleCounts = {};
    certificates.forEach(cert => {
      const jobRole = cert.jobRole || 'Unspecified';
      jobRoleCounts[jobRole] = (jobRoleCounts[jobRole] || 0) + 1;
    });
    
    res.json(jobRoleCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get expiring certificates with details
app.get('/api/certificates/expiring/:days?', async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 30;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    
    const certificates = await Certificate.find({
      active: 'Yes',
      status: 'Approved',
      expiryDate: { $exists: true, $ne: null }
    }).populate('profileId');
    
    const expiringCertificates = certificates.filter(cert => {
      if (!cert.expiryDate) return false;
      
      const expiryDate = parseExpiryDate(cert.expiryDate);
      
      return expiryDate && expiryDate >= today && expiryDate <= futureDate;
    });
    
    res.json(expiringCertificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get expired certificates
app.get('/api/certificates/expired', async (req, res) => {
  try {
    const today = new Date();
    
    const certificates = await Certificate.find({
      active: 'Yes',
      expiryDate: { $exists: true, $ne: null }
    }).populate('profileId');
    
    const expiredCertificates = certificates.filter(cert => {
      if (!cert.expiryDate) return false;
      
      const expiryDate = parseExpiryDate(cert.expiryDate);
      
      return expiryDate && expiryDate < today;
    });
    
    res.json(expiredCertificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Debug endpoint to check certificate dates
app.get('/api/certificates/debug-dates', async (req, res) => {
  try {
    const certificates = await Certificate.find({
      expiryDate: { $exists: true, $ne: null }
    }).limit(10);
    
    const today = new Date();
    const debugInfo = certificates.map(cert => {
      const parsedDate = parseExpiryDate(cert.expiryDate);
      return {
        id: cert._id,
        certificate: cert.certificate,
        originalDate: cert.expiryDate,
        parsedDate: parsedDate,
        isValid: parsedDate && !isNaN(parsedDate.getTime()),
        isExpired: parsedDate && parsedDate < today,
        daysFromNow: parsedDate ? Math.ceil((parsedDate - today) / (1000 * 60 * 60 * 24)) : null
      };
    });
    
    res.json({
      today: today,
      certificates: debugInfo
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get certificates by profile ID
app.get('/api/profiles/:profileId/certificates', async (req, res) => {
  try {
    const { profileId } = req.params;
    const certificates = await Certificate.find({ profileId }).sort({ createdOn: -1 });
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get profile stats (certificates count, etc.)
// Get profile by email (for user login)
app.get('/api/profiles/by-email/:email', async (req, res) => {
  try {
    // Normalize email to lowercase for consistent lookup
    const email = (req.params.email || '').toLowerCase().trim();
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const profile = await Profile.findOne({ email });
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile by email:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/certificates/delete-request', async (req, res) => {
  try {
    const { certificateId, certificateName, userEmail, userName, profileId } = req.body;
    
    // Get admin email from environment or use default
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@talentshield.com';
    
    // Create email content
    const subject = `Certificate Deletion Request - ${certificateName}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Certificate Deletion Request</h2>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Request Details</h3>
          <p><strong>User:</strong> ${userName}</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p><strong>Certificate:</strong> ${certificateName}</p>
          <p><strong>Certificate ID:</strong> ${certificateId}</p>
          <p><strong>Profile ID:</strong> ${profileId}</p>
          <p><strong>Request Date:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0;"><strong>Action Required:</strong> Please review this deletion request and take appropriate action in the admin panel.</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from the HRMS system.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `;
    
    // Send email to admin
    await sendNotificationEmail(adminEmail, 'Super Admin', subject, `Certificate deletion requested by ${userName} for: ${certificateName}`, 'warning');
    
    res.json({ message: 'Delete request sent successfully' });
  } catch (error) {
    console.error('Error sending delete request email:', error);
    res.status(500).json({ message: 'Failed to send delete request' });
  }
});

// Authentication Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role = 'user', termsAccepted = false, requireEmailVerification = true } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Prepare user document
    // NOTE: Password will be hashed by pre-save hook - do NOT hash manually to avoid double hashing
    const user = new User({
      firstName,
      lastName,
      email,
      password, // Plain text - pre-save hook will hash it
      role: role === 'admin' ? 'admin' : 'user',
      isActive: true,
      termsAcceptedAt: termsAccepted ? new Date() : undefined,
      emailVerified: !requireEmailVerification
    });

    if (requireEmailVerification) {
      user.verificationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '48h' });
      console.log('Verification token generated for:', email);
    }

    if (role === 'admin') {
      user.adminApprovalStatus = 'pending';
      user.adminApprovalToken = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      console.log('Admin approval token generated for:', email);
    }

    await user.save();
    console.log('User saved to database:', {
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      hasVerificationToken: !!user.verificationToken,
      adminApprovalStatus: user.adminApprovalStatus
    });

    // Send verification email if required
    try {
      if (requireEmailVerification && user.verificationToken) {
        const baseUrl = process.env.API_PUBLIC_URL || process.env.BACKEND_URL || `https://talentshield.co.uk`;
        const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(user.verificationToken)}`;
        const name = `${user.firstName} ${user.lastName}`.trim();
        
        console.log('Attempting to send verification email to:', user.email);
        console.log('Email config:', {
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT,
          user: process.env.EMAIL_USER ? 'configured' : 'missing',
          pass: process.env.EMAIL_PASS ? 'configured' : 'missing'
        });
        
        const result = await sendVerificationEmail(user.email, verifyUrl, name);
        if (result.success) {
          console.log(`✓ Verification email sent to ${user.email}`);
        } else {
          console.error(`✗ Verification email failed:`, result.error);
        }
      }
    } catch (e) {
      console.error('Failed to send verification email:', e);
      console.error('Error details:', {
        message: e.message,
        code: e.code,
        stack: e.stack
      });
    }

    // If admin role, send approval request to super admin(s)
    try {
      if (role === 'admin' && user.adminApprovalToken) {
        const superAdminEmails = (process.env.SUPER_ADMIN_EMAIL || 'admin@talentshield.com')
          .split(',')
          .map(e => e.trim())
          .filter(Boolean);
        
        const baseUrl = process.env.API_PUBLIC_URL || process.env.BACKEND_URL || `https://talentshield.co.uk`;
        const approveUrl = `${baseUrl}/api/auth/approve-admin?token=${encodeURIComponent(user.adminApprovalToken)}`;
        const name = `${user.firstName} ${user.lastName}`.trim();
        
        console.log('Attempting to send admin approval email to:', superAdminEmails.join(', '));
        
        for (const saEmail of superAdminEmails) {
          const result = await sendAdminApprovalRequestEmail(saEmail, name, user.email, approveUrl);
          if (result.success) {
            console.log(`✓ Admin approval request sent to ${saEmail}`);
          } else {
            console.error(`✗ Admin approval email failed for ${saEmail}:`, result.error);
          }
        }
      }
    } catch (e) {
      console.error('Failed to send admin approval email:', e);
      console.error('Error details:', {
        message: e.message,
        code: e.code
      });
    }

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Import notification routes
const notificationRoutes = require('./routes/notifications');
const bulkJobRolesRoutes = require('./routes/bulkJobRoles');
const jobRolesRoutes = require('./routes/jobRoles');
const jobLevelsRoutes = require('./routes/jobLevels');

// Use notification routes (moved after authenticateSession definition)
// This will be added later after the middleware is defined

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login request received:', {
      hasIdentifier: !!req.body.identifier,
      hasEmail: !!req.body.email,
      hasPassword: !!req.body.password,
      body: { ...req.body, password: req.body.password ? '[REDACTED]' : undefined }
    });
    
    const { identifier, email, password, rememberMe } = req.body;
    const loginIdentifier = (identifier || email || '').trim().toLowerCase();

    if (!loginIdentifier || !password) {
      console.log('Login validation failed:', { loginIdentifier, hasPassword: !!password });
      return res.status(400).json({ message: 'Email/username and password are required' });
    }

    // Check for admin or user account - support email, username, or VTID login
    const user = await User.findOne({ 
      $or: [
        { email: { $regex: new RegExp(`^${loginIdentifier}$`, 'i') } },
        { username: { $regex: new RegExp(`^${loginIdentifier}$`, 'i') } },
        { vtid: { $regex: new RegExp(`^${loginIdentifier}$`, 'i') } }
      ]
    });
    
    if (user) {
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(400).json({ message: 'Account is deactivated' });
      }

      // For admin accounts, enforce approval
      if (user.role === 'admin' && user.adminApprovalStatus !== 'approved') {
        return res.status(403).json({ 
          message: 'Your admin account is pending approval. Please wait for the super admin to approve your account.',
          requiresApproval: true
        });
      }

      // For admin accounts, enforce email verification
      if (user.role === 'admin' && !user.emailVerified) {
        return res.status(403).json({ 
          message: 'Email not verified. Please check your email and click the verification link to continue.',
          requiresVerification: true
        });
      }

      // Update last login time
      user.lastLoginAt = Date.now();
      await user.save();

      // Create session data
      const sessionUser = {
        userId: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        vtid: user.vtid,
        profileId: user.profileId
      };

      // Generate JWT token
      const token = jwt.sign(sessionUser, JWT_SECRET, { expiresIn: rememberMe ? '30d' : '24h' });

      // Store in session
      req.session.user = sessionUser;
      
      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }

      // Send login success email notification
      try {
        const loginTime = new Date().toLocaleString();
        const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
        const userName = `${user.firstName} ${user.lastName}`;
        await sendLoginSuccessEmail(user.email, userName, loginTime, ipAddress);
      } catch (emailError) {
        console.error('Failed to send login success email:', emailError);
      }
      
      return res.json({ user: sessionUser, token });
    }

    // No user found with given credentials
    return res.status(400).json({ message: 'Invalid credentials' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Could not log out' });
      }
      res.clearCookie('talentshield.sid'); // Clear session cookie
      return res.json({ message: 'Logout successful' });
    });
  } else {
    return res.json({ message: 'No active session' });
  }
});

// Session validation endpoint
app.get('/api/auth/validate-session', (req, res) => {
  console.log('Session validation request:', {
    sessionExists: !!req.session,
    sessionUser: req.session?.user ? 'exists' : 'missing',
    sessionId: req.sessionID,
    cookies: req.headers.cookie
  });
  
  if (req.session && req.session.user) {
    return res.json({
      isAuthenticated: true,
      user: {
        id: req.session.user.userId,
        firstName: req.session.user.firstName,
        lastName: req.session.user.lastName,
        email: req.session.user.email,
        role: req.session.user.role
      }
    });
  }
  
  return res.status(401).json({ 
    isAuthenticated: false, 
    message: 'No active session' 
  });
});

// Reset Password with Old Password Verification
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Email, old password, and new password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return res.status(400).json({ message: 'Old password is incorrect' });
    }

    // Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
      });
    }

    // Check if new password is different from old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: 'New password must be different from the old password' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// Session-based authentication middleware
const authenticateSession = async (req, res, next) => {
  try {
    // First check session
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }

    // Then check JWT token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const decoded = await jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      // Update session with token data
      req.session.user = decoded;
      return next();
    } catch (tokenError) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Internal server error during authentication' });
  }
};

// Legacy JWT middleware for backward compatibility
const authenticateToken = authenticateSession;

// Use notification routes (now that authenticateSession is defined)
app.use('/api/notifications', authenticateSession, notificationRoutes);

// Get current user's profile (for My Settings page)
app.get('/api/my-profile', authenticateSession, async (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // For admin users, get from User collection
    if (req.user.role === 'admin') {
      const user = await User.findOne({ email: req.user.email })
        .select('-password -__v') // Exclude sensitive fields
        .lean();
      
      if (!user) {
        return res.status(404).json({ message: 'Admin profile not found' });
      }

      // Try to merge with Profile collection details if available
      let profileExtras = {};
      try {
        const prof = await Profile.findOne({ email: req.user.email })
          .select('-profilePictureData -profilePictureSize -profilePictureMimeType -__v')
          .lean();
        if (prof) {
          profileExtras = {
            mobile: prof.mobile,
            bio: prof.bio,
            jobTitle: prof.jobTitle || '',
            department: prof.department || '',
            company: prof.company,
            staffType: prof.staffType,
            dateOfBirth: prof.dateOfBirth,
            nationality: prof.nationality,
            gender: prof.gender,
            location: prof.location,
            address: prof.address,
            emergencyContact: prof.emergencyContact,
            profilePicture: prof.profilePicture
          };
        }
      } catch (mergeErr) {
        console.warn('Admin merge with Profile failed:', mergeErr?.message || mergeErr);
      }

      // Include additional admin-specific data if needed
      const adminData = {
        ...user,
        ...profileExtras,
        isAdmin: true,
        permissions: ['all']
      };
      
      return res.json(adminData);
    } else {
      // For regular users, get from Profile collection
      const profile = await Profile.findOne({ email: req.user.email })
        .select('-profilePictureData -profilePictureSize -profilePictureMimeType') // Exclude binary data
        .lean();
      
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      
      res.json(profile);
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update admin profile details (persist in Profile collection)
app.put('/api/admin/update-profile', authenticateSession, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const {
      firstName,
      lastName,
      email,
      mobile,
      bio,
      jobTitle,
      department,
      company,
      staffType,
      dateOfBirth,
      nationality,
      gender,
      location,
      address,
      emergencyContact
    } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: 'First name, last name, and email are required' });
    }

    // Upsert into Profile collection keyed by admin email
    const update = {
      firstName,
      lastName,
      email,
      mobile: mobile ?? '',
      bio: bio ?? '',
      jobTitle: jobTitle ?? '',
      department: department ?? '',
      company: company ?? '',
      staffType: staffType ?? 'Admin',
      nationality: nationality ?? '',
      gender: gender ?? '',
      location: location ?? '',
      address: address ?? {},
      emergencyContact: emergencyContact ?? {},
      updatedAt: new Date()
    };
    if (dateOfBirth) {
      update.dateOfBirth = new Date(dateOfBirth);
    }

    const updatedProfile = await Profile.findOneAndUpdate(
      { email },
      update,
      { new: true, upsert: true }
    );

    return res.json({ success: true, message: 'Admin profile updated successfully', profile: updatedProfile });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    return res.status(500).json({ message: 'Failed to update admin profile', error: error.message });
  }
});

// Create new user endpoint (Admin only)
app.post('/api/users/create', authenticateSession, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { firstName, lastName, email, vtid } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: 'First name, last name, and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if user already exists
    const existingProfile = await Profile.findOne({ email });
    if (existingProfile) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Generate a secure password (minimum 6 characters)
    const generatedPassword = generateSimplePassword(8);

    // Create new profile
    const newProfile = new Profile({
      firstName,
      lastName,
      email,
      vtid: vtid || `VT${Date.now()}`, // Generate VTID if not provided
      role: 'user',
      isActive: true,
      emailVerified: true, // Auto-verify email for admin-created users
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user.email // Track who created the user
    });

    // Save the profile
    const savedProfile = await newProfile.save();

    // CRITICAL: Create User account for login
    // Without this, the user cannot login since login now uses User collection only
    try {
      const existingUser = await User.findOne({ email: savedProfile.email });
      
      if (!existingUser) {
        // Create User with VTID as password (pre-save hook will hash it)
        const newUser = new User({
          firstName: savedProfile.firstName,
          lastName: savedProfile.lastName,
          email: savedProfile.email,
          password: generatedPassword, // Plain text - pre-save hook will hash it
          vtid: savedProfile.vtid.toString(),
          role: 'user',
          isActive: true,
          emailVerified: true,
          profileId: savedProfile._id
        });
        
        await newUser.save();
        
        // Link back to profile
        savedProfile.userId = newUser._id;
        await savedProfile.save();
        
        console.log('User account created and linked for:', savedProfile.email);
      }
    } catch (userCreationError) {
      console.error('Error creating user account:', userCreationError);
      // If user creation fails, delete the profile to maintain consistency
      await Profile.findByIdAndDelete(savedProfile._id);
      throw new Error('Failed to create user account. Please try again.');
    }

    const loginUrl = `${process.env.FRONTEND_URL || 'https://talentshield.co.uk'}/login`;
    const userName = `${firstName} ${lastName}`;
    
    // Send credentials to the admin who created the user
    try {
      await sendAdminNewUserCredentialsEmail(
        req.user.email, 
        userName, 
        email, 
        generatedPassword, 
        loginUrl
      );
      console.log(`Credentials email sent to admin: ${req.user.email}`);
    } catch (emailError) {
      console.error('Failed to send credentials email to admin:', emailError);
      // Don't fail the user creation if email fails
    }

    // Send welcome email to the newly created user
    try {
      await sendWelcomeEmailToNewUser(email, userName, loginUrl);
      console.log(`Welcome email sent to new user: ${email}`);
    } catch (emailError) {
      console.error('Failed to send welcome email to new user:', emailError);
      // Don't fail the user creation if email fails
    }

    // Return success response (without password for security)
    res.status(201).json({
      success: true,
      message: 'User created successfully. Credentials sent to your email.',
      user: {
        id: savedProfile._id,
        firstName: savedProfile.firstName,
        lastName: savedProfile.lastName,
        email: savedProfile.email,
        vtid: savedProfile.vtid,
        role: savedProfile.role,
        isActive: savedProfile.isActive,
        createdAt: savedProfile.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      message: 'Failed to create user', 
      error: error.message 
    });
  }
});
app.use('/api', bulkJobRolesRoutes);
app.use('/api/job-roles', jobRolesRoutes);
app.use('/api/job-levels', jobLevelsRoutes);

// Email service handled by utils/emailService.js

// Function to calculate days until expiry
const calculateDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Enhanced email notification using utils/emailService.js
const sendEmailNotification = async (userEmail, subject, body) => {
  try {
    const { sendEmail } = require('./utils/emailService');
// Enhanced email service functions
const {
  sendProfileCreationEmail,
  sendProfileUpdateEmail,
  sendProfileDeletionEmail,
  sendCertificateAddedEmail,
  sendCertificateDeletedEmail,
  sendCertificateExpiryReminderEmail,
  sendCertificateExpiredEmail,
  sendUserCredentialsEmail,
  sendAdminNewUserCredentialsEmail,
  sendNotificationEmail
} = require('./utils/emailService');

// Password generator utility
const { generateSecurePassword } = require('./utils/passwordGenerator');

    const result = await sendEmail({
      to: userEmail,
      subject: subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#2196F3;color:white;padding:20px;text-align:center">
            <h1>HRMS Notification</h1>
          </div>
          <div style="padding:20px;background:#f9f9f9">
            <div style="white-space:pre-wrap">${body}</div>
          </div>
        </div>
      `
    });
    return result.success;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
};

// Function to check certificate expiry and create notifications
const checkCertificateExpiry = async () => {
  try {
    console.log('Checking certificate expiry...');
    
    const certificates = await Certificate.find({});
    const users = await User.find({});
    
    for (const cert of certificates) {
      if (!cert.expiryDate) continue;
      
      const daysUntilExpiry = calculateDaysUntilExpiry(cert.expiryDate);
      
      // Find user via profileId relationship
      let user = null;
      if (cert.profileId) {
        const profile = await Profile.findById(cert.profileId);
        if (profile && profile.userId) {
          user = users.find(u => u._id.toString() === profile.userId.toString());
        }
      }
      if (!user) continue;
      
      let shouldNotify = false;
      let priority = 'low';
      let message = '';
      
      // Check if we should create a notification (only 15 and 30 days)
      if (daysUntilExpiry <= 0) {
        priority = 'critical';
        message = `Certificate "${cert.certificate}" has expired!`;
        shouldNotify = true;
      } else if (daysUntilExpiry === 15) {
        priority = 'high';
        message = `Certificate "${cert.certificate}" expires in 15 days`;
        shouldNotify = true;
      } else if (daysUntilExpiry === 30) {
        priority = 'medium';
        message = `Certificate "${cert.certificate}" expires in 30 days`;
        shouldNotify = true;
      }
      
      if (shouldNotify) {
        // Check if notification already exists for this certificate and timeframe
        const existingNotification = await Notification.findOne({
          userId: user._id,
          certificateId: cert._id,
          type: daysUntilExpiry <= 0 ? 'certificate_expired' : 'certificate_expiry',
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
        });
        
        if (!existingNotification) {
          // Create notification
          const notification = new Notification({
            userId: user._id,
            type: daysUntilExpiry <= 0 ? 'certificate_expired' : 'certificate_expiry',
            priority: priority,
            message: message,
            certificateId: cert._id
          });
          
          await notification.save();
          
          // Send email notification
          let subject = '';
          let body = '';
          
          if (daysUntilExpiry <= 0) {
            subject = `URGENT: Certificate "${cert.certificate}" has expired`;
            body = `Dear ${user.firstName} ${user.lastName},\n\nYour certificate "${cert.certificate}" has expired as of ${cert.expiryDate}.\n\nPlease renew this certificate immediately to maintain compliance.\n\nBest regards,\nTalent Shield HRMS Team`;
          } else {
            subject = `${daysUntilExpiry <= 15 ? 'URGENT: ' : ''}Certificate "${cert.certificate}" expires in ${daysUntilExpiry} days`;
            body = `Dear ${user.firstName} ${user.lastName},\n\nYour certificate "${cert.certificate}" will expire in ${daysUntilExpiry} days on ${cert.expiryDate}.\n\nPlease ${daysUntilExpiry <= 15 ? 'take immediate action' : 'plan'} to renew this certificate before it expires.\n\nBest regards,\nTalent Shield HRMS Team`;
          }
          
          const emailSent = await sendEmailNotification(user.email, subject, body);
          
          if (emailSent) {
            notification.emailSent = true;
            await notification.save();
          }
          
          console.log(`Created notification for user ${user.email}: ${message}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking certificate expiry:', error);
  }
};

// Schedule certificate expiry check to run daily at 9 AM
cron.schedule('0 9 * * *', () => {
  console.log('Running daily certificate expiry check...');
  checkCertificateExpiry();
});

// API endpoint to get notifications for a user
app.get('/api/notifications/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const notifications = await Notification.find({ userId })
      .populate('certificateId')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// API endpoint to mark notification as read
app.put('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    await Notification.findByIdAndUpdate(notificationId, { read: true });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// API endpoint to manually trigger certificate expiry check
app.post('/api/notifications/check-expiry', authenticateToken, async (req, res) => {
  try {
    await checkCertificateExpiry();
    res.json({ success: true, message: 'Certificate expiry check completed' });
  } catch (error) {
    console.error('Error running certificate expiry check:', error);
    res.status(500).json({ error: 'Failed to run certificate expiry check' });
  }
});

// Clear users with old schema and create default user
const createDefaultUser = async () => {
  try {
    // Remove any users that might have the old schema with department/position
    await User.deleteMany({
      $or: [
        { department: { $exists: true } },
        { position: { $exists: true } }
      ]
    });
    
    // Create super admin accounts from SUPER_ADMIN_EMAIL env variable
    const superAdminEmails = process.env.SUPER_ADMIN_EMAIL?.split(',').map(e => e.trim()) || [];
    
    console.log(`Creating ${superAdminEmails.length} super admin accounts...`);
    
    for (const email of superAdminEmails) {
      if (!email || !email.includes('@')) {
        console.warn(`Skipping invalid email: ${email}`);
        continue;
      }
      
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (!existingUser) {
        // Extract name from email
        const emailPrefix = email.split('@')[0];
        const nameParts = emailPrefix.split('.');
        const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Admin';
        const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'User';
        
        // Generate a secure temporary password
        const tempPassword = 'TalentShield@2025'; // They should change this after first login
        
        const superAdmin = new User({
          firstName,
          lastName,
          email: email.toLowerCase(),
          password: tempPassword, // Will be hashed by pre-save hook
          role: 'admin',
          isActive: true,
          emailVerified: true,
          adminApprovalStatus: 'approved'
        });
        
        await superAdmin.save();
        console.log(`✅ Super admin created: ${email} (password: TalentShield@2025)`);
      } else {
        console.log(`⏭️  Super admin already exists: ${email}`);
      }
    }
    
    if (superAdminEmails.length === 0) {
      console.warn('⚠️  No super admin emails found in SUPER_ADMIN_EMAIL environment variable');
    }
  } catch (error) {
    console.error('Error creating default super admins:', error);
  }
};

// Create default suppliers
const createDefaultSuppliers = async () => {
  try {
    const defaultSuppliers = [
      'SKILLS PROVIDER',
      'Internal Training',
      'External Provider',
      'Certification Body',
      'Online Training Platform',
      'Professional Institute',
      'Trade Association'
    ];

    for (const supplierName of defaultSuppliers) {
      const existingSupplier = await Supplier.findOne({ name: supplierName });
      if (!existingSupplier) {
        const supplier = new Supplier({
          name: supplierName,
          usageCount: 0
        });
        await supplier.save();
      }
    }
    console.log('Default suppliers created');
  } catch (error) {
    console.error('Error creating default suppliers:', error);
  }
};


// Enhanced Certificate Expiry Monitoring with Email Notifications
const enhancedCertificateExpiryMonitoring = async () => {
  try {
    console.log('Running enhanced certificate expiry monitoring...');
    
    const today = new Date();
    const certificates = await Certificate.find({
      active: 'Yes',
      status: 'Approved',
      expiryDate: { $exists: true, $ne: null }
    }).populate('profileId');
    
    for (const certificate of certificates) {
      if (!certificate.profileId || !certificate.expiryDate) continue;
      
      const profile = certificate.profileId;
      const expiryDate = new Date(certificate.expiryDate);
      const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
      
      // Send expiry reminders
      if (daysUntilExpiry === 30 || daysUntilExpiry === 14 || daysUntilExpiry === 7 || daysUntilExpiry === 1) {
        try {
          // Send to user
          await sendCertificateExpiryReminderEmail(profile, certificate, daysUntilExpiry);
          
          // Send to admins
          const adminUsers = await User.find({ role: 'admin' });
          for (const admin of adminUsers) {
            await sendNotificationEmail(
              admin.email,
              `${admin.firstName} ${admin.lastName}`,
              `Certificate Expiring in ${daysUntilExpiry} Days`,
              `Certificate "${certificate.certificate}" for ${profile.firstName} ${profile.lastName} expires in ${daysUntilExpiry} days.`,
              daysUntilExpiry <= 7 ? 'error' : 'warning'
            );
          }
          
          console.log(`Expiry reminder sent for certificate ${certificate.certificate} (${daysUntilExpiry} days)`);
        } catch (emailError) {
          console.error('Error sending expiry reminder:', emailError);
        }
      }
      
      // Send expired notifications
      if (daysUntilExpiry < 0 && daysUntilExpiry >= -7) { // Send for first week after expiry
        try {
          // Send to user
          await sendCertificateExpiredEmail(profile, certificate);
          
          // Send to admins
          const adminUsers = await User.find({ role: 'admin' });
          for (const admin of adminUsers) {
            await sendNotificationEmail(
              admin.email,
              `${admin.firstName} ${admin.lastName}`,
              'Certificate EXPIRED',
              `Certificate "${certificate.certificate}" for ${profile.firstName} ${profile.lastName} has EXPIRED.`,
              'error'
            );
          }
          
          console.log(`Expired notification sent for certificate ${certificate.certificate}`);
        } catch (emailError) {
          console.error('Error sending expired notification:', emailError);
        }
      }
    }
    
    console.log('Certificate expiry monitoring completed');
  } catch (error) {
    console.error('Error in certificate expiry monitoring:', error);
  }
};

// Schedule enhanced certificate expiry monitoring to run daily at 9 AM
cron.schedule('0 9 * * *', enhancedCertificateExpiryMonitoring);
console.log('Enhanced certificate expiry monitoring scheduled for 9 AM daily');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Create default user on startup
  setTimeout(() => {
    createDefaultUser();
    createDefaultSuppliers();
  }, 2000);
  
  // Start certificate monitoring
  startCertificateMonitoring();
  
  // Run initial certificate expiry check on startup
  setTimeout(() => {
    console.log('Running initial certificate expiry check...');
    triggerCertificateCheck();
  }, 5000); // Wait 5 seconds for database connection
});

// Ensure API routes are defined before serving the React app
// Serve React app for all other routes
app.use(express.static(path.join(__dirname, '../frontend/build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});
