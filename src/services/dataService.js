const fs = require('fs');
const path = require('path');
const config = require('../../config/config');

class DataService {
  constructor() {
    this.ensureDataDirectory();
    this.initializeDataFiles();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(config.dataFiles.users);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  initializeDataFiles() {
    // Initialize users.json
    if (!fs.existsSync(config.dataFiles.users)) {
      this.saveUsers({});
    }

    // Initialize blocked_users.json
    if (!fs.existsSync(config.dataFiles.blockedUsers)) {
      this.saveBlockedUsers([]);
    }

    // Initialize reports.json
    if (!fs.existsSync(config.dataFiles.reports)) {
      this.saveReports([]);
    }
  }

  // Safe JSON stringify with size limit
  safeStringify(obj, maxSize = 50 * 1024 * 1024) { // 50MB limit
    try {
      const jsonString = JSON.stringify(obj, null, 2);
      
      if (jsonString.length > maxSize) {
        throw new Error(`JSON size (${jsonString.length}) exceeds maximum allowed size (${maxSize})`);
      }
      
      return jsonString;
    } catch (error) {
      if (error.message.includes('Invalid string length') || error.message.includes('exceeds maximum')) {
        // If data is too large, try to clean it up
        console.warn('Data too large, attempting cleanup...');
        return this.cleanupAndStringify(obj);
      }
      throw error;
    }
  }

  // Cleanup data by removing old entries
  cleanupAndStringify(obj) {
    if (Array.isArray(obj)) {
      // For arrays (like reports), keep only recent 1000 entries
      const cleaned = obj.slice(-1000);
      return JSON.stringify(cleaned, null, 2);
    } else if (typeof obj === 'object') {
      // For objects (like users), keep only essential data
      const cleaned = {};
      const entries = Object.entries(obj);
      
      // Keep only last 10000 users if too many
      const maxUsers = 10000;
      const recentEntries = entries.slice(-maxUsers);
      
      for (const [key, value] of recentEntries) {
        // Clean up user data, keep only essential fields
        cleaned[key] = {
          id: value.id,
          name: value.name,
          username: value.username,
          joinDate: value.joinDate,
          reportCount: value.reportCount || 0,
          lastActive: value.lastActive || new Date().toISOString()
        };
      }
      
      return JSON.stringify(cleaned, null, 2);
    }
    return JSON.stringify(obj, null, 2);
  }

  // Users data management
  loadUsers() {
    try {
      if (!fs.existsSync(config.dataFiles.users)) {
        return {};
      }
      
      const data = fs.readFileSync(config.dataFiles.users, 'utf8');
      
      if (!data.trim()) {
        return {};
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading users:', error.message);
      
      // Try to backup corrupted file
      try {
        const backupName = `${config.dataFiles.users}.backup.${Date.now()}`;
        fs.copyFileSync(config.dataFiles.users, backupName);
        console.log(`Corrupted file backed up as: ${backupName}`);
      } catch (backupError) {
        console.error('Failed to backup corrupted file:', backupError.message);
      }
      
      // Return empty object and reinitialize
      this.saveUsers({});
      return {};
    }
  }

  saveUsers(users) {
    try {
      // Clean up old inactive users periodically
      const cleanedUsers = this.cleanupInactiveUsers(users);
      const jsonString = this.safeStringify(cleanedUsers);
      
      // Write to temporary file first
      const tempFile = `${config.dataFiles.users}.tmp`;
      fs.writeFileSync(tempFile, jsonString);
      
      // Rename temp file to actual file (atomic operation)
      fs.renameSync(tempFile, config.dataFiles.users);
      
    } catch (error) {
      console.error('Error saving users:', error.message);
      
      // If saving fails due to size, force cleanup
      if (error.message.includes('size') || error.message.includes('Invalid string length')) {
        console.log('Forcing data cleanup due to size constraints...');
        try {
          const forceCleaned = this.forceCleanupUsers(users);
          const cleanedString = this.safeStringify(forceCleaned);
          fs.writeFileSync(config.dataFiles.users, cleanedString);
          console.log('Data successfully cleaned and saved');
        } catch (cleanupError) {
          console.error('Failed to save even after cleanup:', cleanupError.message);
          // As last resort, save empty object
          fs.writeFileSync(config.dataFiles.users, '{}');
        }
      }
    }
  }

  // Clean up inactive users (haven't been active for 30 days)
  cleanupInactiveUsers(users) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const cleaned = {};
    let removedCount = 0;
    
    for (const [userId, userData] of Object.entries(users)) {
      const lastActive = new Date(userData.lastActive || userData.joinDate);
      
      if (lastActive > thirtyDaysAgo || userData.reportCount > 0) {
        // Keep active users and users with reports
        cleaned[userId] = userData;
      } else {
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} inactive users`);
    }
    
    return cleaned;
  }

  // Force cleanup - keep only most recent 5000 users
  forceCleanupUsers(users) {
    const entries = Object.entries(users);
    const sorted = entries.sort((a, b) => {
      const dateA = new Date(a[1].lastActive || a[1].joinDate);
      const dateB = new Date(b[1].lastActive || b[1].joinDate);
      return dateB - dateA;
    });
    
    const cleaned = {};
    const keepCount = Math.min(5000, sorted.length);
    
    for (let i = 0; i < keepCount; i++) {
      const [userId, userData] = sorted[i];
      cleaned[userId] = {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        joinDate: userData.joinDate,
        reportCount: userData.reportCount || 0,
        lastActive: userData.lastActive || new Date().toISOString()
      };
    }
    
    console.log(`Force cleanup: kept ${keepCount} out of ${entries.length} users`);
    return cleaned;
  }

  addUser(userId, userInfo) {
    try {
      const users = this.loadUsers();
      const existingUser = users[userId] || {};
      
      users[userId] = {
        id: userInfo.id,
        name: userInfo.name,
        username: userInfo.username,
        language: userInfo.language,
        joinDate: existingUser.joinDate || new Date().toISOString(),
        lastActive: new Date().toISOString(),
        reportCount: existingUser.reportCount || 0
      };
      
      this.saveUsers(users);
    } catch (error) {
      console.error('Error adding user:', error.message);
    }
  }

  getUser(userId) {
    try {
      const users = this.loadUsers();
      return users[userId] || null;
    } catch (error) {
      console.error('Error getting user:', error.message);
      return null;
    }
  }

  updateUser(userId, updateData) {
    try {
      const users = this.loadUsers();
      if (users[userId]) {
        users[userId] = { 
          ...users[userId], 
          ...updateData,
          lastActive: new Date().toISOString()
        };
        this.saveUsers(users);
      }
    } catch (error) {
      console.error('Error updating user:', error.message);
    }
  }

  // Blocked users management
  loadBlockedUsers() {
    try {
      if (!fs.existsSync(config.dataFiles.blockedUsers)) {
        return [];
      }
      
      const data = fs.readFileSync(config.dataFiles.blockedUsers, 'utf8');
      if (!data.trim()) {
        return [];
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading blocked users:', error.message);
      return [];
    }
  }

  saveBlockedUsers(blockedUsers) {
    try {
      const jsonString = this.safeStringify(blockedUsers);
      fs.writeFileSync(config.dataFiles.blockedUsers, jsonString);
    } catch (error) {
      console.error('Error saving blocked users:', error.message);
    }
  }

  isUserBlocked(userId) {
    try {
      const blockedUsers = this.loadBlockedUsers();
      return blockedUsers.includes(userId);
    } catch (error) {
      console.error('Error checking blocked user:', error.message);
      return false;
    }
  }

  blockUser(userId) {
    try {
      const blockedUsers = this.loadBlockedUsers();
      if (!blockedUsers.includes(userId)) {
        blockedUsers.push(userId);
        this.saveBlockedUsers(blockedUsers);
      }
    } catch (error) {
      console.error('Error blocking user:', error.message);
    }
  }

  unblockUser(userId) {
    try {
      const blockedUsers = this.loadBlockedUsers();
      const index = blockedUsers.indexOf(userId);
      if (index > -1) {
        blockedUsers.splice(index, 1);
        this.saveBlockedUsers(blockedUsers);
      }
    } catch (error) {
      console.error('Error unblocking user:', error.message);
    }
  }

  // Reports management
  loadReports() {
    try {
      if (!fs.existsSync(config.dataFiles.reports)) {
        return [];
      }
      
      const data = fs.readFileSync(config.dataFiles.reports, 'utf8');
      if (!data.trim()) {
        return [];
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading reports:', error.message);
      return [];
    }
  }

  saveReports(reports) {
    try {
      // Keep only last 1000 reports to prevent file from getting too large
      const limitedReports = reports.slice(-1000);
      const jsonString = this.safeStringify(limitedReports);
      fs.writeFileSync(config.dataFiles.reports, jsonString);
    } catch (error) {
      console.error('Error saving reports:', error.message);
    }
  }

  addReport(reporterInfo, reportedInfo, reason = '') {
    try {
      const reports = this.loadReports();
      const report = {
        id: Date.now(),
        reporter: {
          id: reporterInfo.id,
          name: reporterInfo.name,
          username: reporterInfo.username
        },
        reported: {
          id: reportedInfo.id,
          name: reportedInfo.name,
          username: reportedInfo.username
        },
        reason: reason,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      reports.push(report);
      this.saveReports(reports);

      // Update report count for reported user
      this.updateUser(reportedInfo.id, {
        reportCount: (reportedInfo.reportCount || 0) + 1
      });

      return report;
    } catch (error) {
      console.error('Error adding report:', error.message);
      return null;
    }
  }

  getStats() {
    try {
      const users = this.loadUsers();
      const blockedUsers = this.loadBlockedUsers();
      const reports = this.loadReports();

      return {
        totalUsers: Object.keys(users).length,
        blockedUsers: blockedUsers.length,
        totalReports: reports.length,
        pendingReports: reports.filter(r => r.status === 'pending').length
      };
    } catch (error) {
      console.error('Error getting stats:', error.message);
      return {
        totalUsers: 0,
        blockedUsers: 0,
        totalReports: 0,
        pendingReports: 0
      };
    }
  }

  // Maintenance function to clean up all data
  performMaintenance() {
    try {
      console.log('Performing data maintenance...');
      
      // Clean users
      const users = this.loadUsers();
      const cleanedUsers = this.cleanupInactiveUsers(users);
      this.saveUsers(cleanedUsers);
      
      // Clean reports (keep only last 6 months)
      const reports = this.loadReports();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const recentReports = reports.filter(report => 
        new Date(report.timestamp) > sixMonthsAgo
      );
      
      if (recentReports.length < reports.length) {
        this.saveReports(recentReports);
        console.log(`Cleaned ${reports.length - recentReports.length} old reports`);
      }
      
      console.log('Data maintenance completed');
    } catch (error) {
      console.error('Error during maintenance:', error.message);
    }
  }
}

module.exports = new DataService();
