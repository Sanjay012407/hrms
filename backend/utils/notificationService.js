const mongoose = require('mongoose');
const { 
  sendNotificationEmail,
  sendCertificateExpiryEmail,
  sendProfileCreationEmail,
  sendProfileUpdateEmail,
  sendProfileDeletionEmail,
  sendCertificateAddedEmail,
  sendCertificateDeletedEmail
} = require('./emailService');

// Helper function to get all admin users
async function getAllAdminUsers() {
  try {
    const User = mongoose.model('User');
    const adminUsers = await User.find({ role: 'admin' }).select('_id email firstName lastName');
    return adminUsers;
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return [];
  }
}

// Helper function to get user profile
async function getUserProfile(userId) {
  try {
    const Profile = mongoose.model('Profile');
    const profile = await Profile.findOne({ userId }).select('_id email firstName lastName vtid');
    return profile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Create notification in database
async function createNotification(data) {
  try {
    const Notification = mongoose.model('Notification');
    const notification = await Notification.createNotification(data);
    console.log(`✅ Notification created: ${notification.title} for user ${notification.userId}`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    return null;
  }
}

// Send notification to user and admin
async function sendNotificationToUserAndAdmin(notificationData, profileData = null) {
  try {
    const notifications = [];
    
    // Create notification for the user
    if (notificationData.userId) {
      const userNotification = await createNotification({
        ...notificationData,
        userId: notificationData.userId
      });
      if (userNotification) notifications.push(userNotification);
    }
    
    // Create notifications for all admins
    const adminUsers = await getAllAdminUsers();
    for (const admin of adminUsers) {
      // Don't send to admin if they are the same as the user
      if (admin._id.toString() !== notificationData.userId?.toString()) {
        const adminNotification = await createNotification({
          ...notificationData,
          userId: admin._id,
          title: `[Admin] ${notificationData.title}`,
          message: `${notificationData.message}${profileData ? ` (User: ${profileData.firstName} ${profileData.lastName} - ${profileData.email})` : ''}`
        });
        if (adminNotification) notifications.push(adminNotification);
      }
    }
    
    return notifications;
  } catch (error) {
    console.error('❌ Error sending notifications to user and admin:', error);
    return [];
  }
}

// Certificate expiring notification
async function notifyCertificateExpiring(certificateData, profileData, daysUntilExpiry) {
  try {
    console.log(`📧 Sending certificate expiring notification: ${certificateData.certificate} (${daysUntilExpiry} days)`);
    
    const priority = daysUntilExpiry <= 1 ? 'critical' : 
                    daysUntilExpiry <= 7 ? 'high' : 
                    daysUntilExpiry <= 14 ? 'medium' : 'low';
    
    const notificationData = {
      userId: profileData.userId,
      profileId: profileData._id,
      type: 'certificate_expiring',
      title: `Certificate Expiring in ${daysUntilExpiry} days`,
      message: `Your certificate "${certificateData.certificate}" will expire in ${daysUntilExpiry} days. Please renew it before ${certificateData.expiryDate}.`,
      priority,
      metadata: {
        certificateId: certificateData._id,
        certificateName: certificateData.certificate,
        expiryDate: certificateData.expiryDate,
        daysUntilExpiry
      }
    };
    
    // Create notifications
    const notifications = await sendNotificationToUserAndAdmin(notificationData, profileData);
    
    // Send email notification
    try {
      await sendCertificateExpiryEmail(
        profileData.email,
        `${profileData.firstName} ${profileData.lastName}`,
        certificateData.certificate,
        certificateData.expiryDate,
        daysUntilExpiry
      );
      console.log(`✅ Certificate expiring email sent to ${profileData.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send certificate expiring email:', emailError);
    }
    
    return notifications;
  } catch (error) {
    console.error('❌ Error in notifyCertificateExpiring:', error);
    return [];
  }
}

// Certificate expired notification
async function notifyCertificateExpired(certificateData, profileData, daysExpired) {
  try {
    console.log(`📧 Sending certificate expired notification: ${certificateData.certificate} (expired ${daysExpired} days ago)`);
    
    const notificationData = {
      userId: profileData.userId,
      profileId: profileData._id,
      type: 'certificate_expired',
      title: `Certificate Expired`,
      message: `Your certificate "${certificateData.certificate}" has expired ${daysExpired} days ago. Please renew it immediately.`,
      priority: 'critical',
      metadata: {
        certificateId: certificateData._id,
        certificateName: certificateData.certificate,
        expiryDate: certificateData.expiryDate,
        daysExpired
      }
    };
    
    // Create notifications
    const notifications = await sendNotificationToUserAndAdmin(notificationData, profileData);
    
    // Send email notification
    try {
      await sendNotificationEmail(
        profileData.email,
        `${profileData.firstName} ${profileData.lastName}`,
        `URGENT: Certificate Expired - ${certificateData.certificate}`,
        `Your certificate "${certificateData.certificate}" has expired ${daysExpired} days ago.\n\nCertificate: ${certificateData.certificate}\nExpiry Date: ${certificateData.expiryDate}\n\nPlease renew this certificate immediately to maintain compliance.`,
        'error'
      );
      console.log(`✅ Certificate expired email sent to ${profileData.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send certificate expired email:', emailError);
    }
    
    return notifications;
  } catch (error) {
    console.error('❌ Error in notifyCertificateExpired:', error);
    return [];
  }
}

// User creation notification
async function notifyUserCreation(userData, profileData, createdByUserId) {
  try {
    console.log(`📧 Sending user creation notification: ${profileData.firstName} ${profileData.lastName}`);
    
    const notificationData = {
      userId: userData._id,
      profileId: profileData._id,
      type: 'user_created',
      title: 'Welcome to Talent Shield HRMS',
      message: `Your account has been created successfully. Welcome to the Talent Shield HRMS system!`,
      priority: 'medium',
      metadata: {
        profileId: profileData._id,
        vtid: profileData.vtid,
        createdBy: createdByUserId
      }
    };
    
    // Create notifications
    const notifications = await sendNotificationToUserAndAdmin(notificationData, profileData);
    
    // Send welcome email to user
    try {
      await sendProfileCreationEmail(profileData, userData);
      console.log(`✅ User creation email sent to ${profileData.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send user creation email:', emailError);
    }
    
    return notifications;
  } catch (error) {
    console.error('❌ Error in notifyUserCreation:', error);
    return [];
  }
}

// Profile update notification
async function notifyProfileUpdate(profileData, updatedFields, updatedByUserId) {
  try {
    console.log(`📧 Sending profile update notification: ${profileData.firstName} ${profileData.lastName}`);
    
    const fieldNames = Object.keys(updatedFields).join(', ');
    
    const notificationData = {
      userId: profileData.userId,
      profileId: profileData._id,
      type: 'profile_updated',
      title: 'Profile Updated',
      message: `Your profile has been updated. Fields changed: ${fieldNames}`,
      priority: 'low',
      metadata: {
        profileId: profileData._id,
        updatedFields,
        updatedBy: updatedByUserId
      }
    };
    
    // Create notifications
    const notifications = await sendNotificationToUserAndAdmin(notificationData, profileData);
    
    // Send email notification
    try {
      await sendProfileUpdateEmail(profileData, updatedFields);
      console.log(`✅ Profile update email sent to ${profileData.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send profile update email:', emailError);
    }
    
    return notifications;
  } catch (error) {
    console.error('❌ Error in notifyProfileUpdate:', error);
    return [];
  }
}

// Certificate addition notification
async function notifyCertificateAdded(certificateData, profileData, addedByUserId) {
  try {
    console.log(`📧 Sending certificate added notification: ${certificateData.certificate}`);
    
    const notificationData = {
      userId: profileData.userId,
      profileId: profileData._id,
      type: 'certificate_added',
      title: 'Certificate Added',
      message: `A new certificate "${certificateData.certificate}" has been added to your profile.`,
      priority: 'low',
      metadata: {
        certificateId: certificateData._id,
        certificateName: certificateData.certificate,
        category: certificateData.category,
        expiryDate: certificateData.expiryDate,
        addedBy: addedByUserId
      }
    };
    
    // Create notifications
    const notifications = await sendNotificationToUserAndAdmin(notificationData, profileData);
    
    // Send email notification
    try {
      await sendCertificateAddedEmail(profileData, certificateData);
      console.log(`✅ Certificate added email sent to ${profileData.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send certificate added email:', emailError);
    }
    
    return notifications;
  } catch (error) {
    console.error('❌ Error in notifyCertificateAdded:', error);
    return [];
  }
}

// Certificate deletion notification
async function notifyCertificateDeleted(certificateData, profileData, deletedByUserId) {
  try {
    console.log(`📧 Sending certificate deleted notification: ${certificateData.certificate}`);
    
    const notificationData = {
      userId: profileData.userId,
      profileId: profileData._id,
      type: 'certificate_deleted',
      title: 'Certificate Removed',
      message: `The certificate "${certificateData.certificate}" has been removed from your profile.`,
      priority: 'medium',
      metadata: {
        certificateId: certificateData._id,
        certificateName: certificateData.certificate,
        category: certificateData.category,
        expiryDate: certificateData.expiryDate,
        deletedBy: deletedByUserId
      }
    };
    
    // Create notifications
    const notifications = await sendNotificationToUserAndAdmin(notificationData, profileData);
    
    // Send email notification
    try {
      await sendCertificateDeletedEmail(profileData, certificateData);
      console.log(`✅ Certificate deleted email sent to ${profileData.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send certificate deleted email:', emailError);
    }
    
    return notifications;
  } catch (error) {
    console.error('❌ Error in notifyCertificateDeleted:', error);
    return [];
  }
}

// Certificate update notification
async function notifyCertificateUpdated(certificateData, profileData, updatedFields, updatedByUserId) {
  try {
    console.log(`📧 Sending certificate updated notification: ${certificateData.certificate}`);
    
    const fieldNames = Object.keys(updatedFields).join(', ');
    
    const notificationData = {
      userId: profileData.userId,
      profileId: profileData._id,
      type: 'certificate_updated',
      title: 'Certificate Updated',
      message: `Your certificate "${certificateData.certificate}" has been updated. Fields changed: ${fieldNames}`,
      priority: 'low',
      metadata: {
        certificateId: certificateData._id,
        certificateName: certificateData.certificate,
        updatedFields,
        updatedBy: updatedByUserId
      }
    };
    
    // Create notifications
    const notifications = await sendNotificationToUserAndAdmin(notificationData, profileData);
    
    // Send email notification
    try {
      await sendNotificationEmail(
        profileData.email,
        `${profileData.firstName} ${profileData.lastName}`,
        `Certificate Updated: ${certificateData.certificate}`,
        `Your certificate "${certificateData.certificate}" has been updated.\n\nUpdated fields: ${fieldNames}\n\nPlease review the changes in your profile.`,
        'info'
      );
      console.log(`✅ Certificate updated email sent to ${profileData.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send certificate updated email:', emailError);
    }
    
    return notifications;
  } catch (error) {
    console.error('❌ Error in notifyCertificateUpdated:', error);
    return [];
  }
}

// Get user notifications
async function getUserNotifications(userId, options = {}) {
  try {
    const Notification = mongoose.model('Notification');
    const { 
      limit = 50, 
      skip = 0, 
      unreadOnly = false,
      type = null 
    } = options;
    
    const query = { userId };
    if (unreadOnly) query.isRead = false;
    if (type) query.type = type;
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('profileId', 'firstName lastName email vtid');
    
    return notifications;
  } catch (error) {
    console.error('❌ Error fetching user notifications:', error);
    return [];
  }
}

// Get unread notification count
async function getUnreadNotificationCount(userId) {
  try {
    const Notification = mongoose.model('Notification');
    const count = await Notification.countDocuments({ 
      userId, 
      isRead: false 
    });
    return count;
  } catch (error) {
    console.error('❌ Error fetching unread notification count:', error);
    return 0;
  }
}

// Mark notification as read
async function markNotificationAsRead(notificationId, userId) {
  try {
    const Notification = mongoose.model('Notification');
    const notification = await Notification.findOne({ 
      _id: notificationId, 
      userId 
    });
    
    if (!notification) {
      throw new Error('Notification not found');
    }
    
    await notification.markAsRead();
    return notification;
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    throw error;
  }
}

// Mark all notifications as read
async function markAllNotificationsAsRead(userId) {
  try {
    const Notification = mongoose.model('Notification');
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );
    
    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    throw error;
  }
}

module.exports = {
  createNotification,
  sendNotificationToUserAndAdmin,
  notifyCertificateExpiring,
  notifyCertificateExpired,
  notifyUserCreation,
  notifyProfileUpdate,
  notifyCertificateAdded,
  notifyCertificateDeleted,
  notifyCertificateUpdated,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getAllAdminUsers,
  getUserProfile
};
