require('dotenv').config();

module.exports = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    adminId: process.env.ADMIN_ID
  },
  settings: {
    autoBlockThreshold: 3, // Auto block setelah 3 laporan
    maxQueueTime: 300000, // 5 menit maksimal dalam antrian
    chatTimeout: 1800000 // 30 menit timeout chat
  },
  dataFiles: {
    users: './data/users.json',
    blockedUsers: './data/blocked_users.json',
    reports: './data/reports.json'
  }
};
