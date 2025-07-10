const dataService = require('../services/dataService');
const matchingService = require('../services/matchingService');
const reportService = require('../services/reportService');
const helpers = require('../utils/helpers');

class AdminHandlers {
  constructor(bot) {
    this.bot = bot;
  }

  handleBlock(msg, match) {
    const adminId = msg.from.id;
    const chatId = msg.chat.id;

    if (!helpers.isAdmin(adminId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses admin.');
      return;
    }

    const userIdToBlock = parseInt(match[1]);
    
    if (isNaN(userIdToBlock)) {
      this.bot.sendMessage(chatId, '❌ ID pengguna tidak valid.');
      return;
    }

    const userInfo = dataService.getUser(userIdToBlock);
    dataService.blockUser(userIdToBlock);

    // End active chat if user is chatting
    const chatResult = matchingService.endChat(userIdToBlock);
    if (chatResult) {
      this.bot.sendMessage(userIdToBlock, '🚫 Anda telah diblokir dari bot ini.');
      this.bot.sendMessage(chatResult.partnerId, '⚠️ Pasangan Anda telah diblokir. Obrolan dihentikan.');
    }

    // Remove from queue
    matchingService.removeFromQueue(userIdToBlock);

    this.bot.sendMessage(chatId, 
      `✅ User ${userInfo?.name || 'Unknown'} (ID: ${userIdToBlock}) telah diblokir.`
    );
  }

  handleUnblock(msg, match) {
    const adminId = msg.from.id;
    const chatId = msg.chat.id;

    if (!helpers.isAdmin(adminId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses admin.');
      return;
    }

    const userIdToUnblock = parseInt(match[1]);
    
    if (isNaN(userIdToUnblock)) {
      this.bot.sendMessage(chatId, '❌ ID pengguna tidak valid.');
      return;
    }

    const userInfo = dataService.getUser(userIdToUnblock);
    dataService.unblockUser(userIdToUnblock);

    this.bot.sendMessage(chatId, 
      `✅ User ${userInfo?.name || 'Unknown'} (ID: ${userIdToUnblock}) telah di-unblock.`
    );
  }

  handleStats(msg) {
    const adminId = msg.from.id;
    const chatId = msg.chat.id;

    if (!helpers.isAdmin(adminId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses admin.');
      return;
    }

    const dataStats = dataService.getStats();
    const matchingStats = matchingService.getStats();

    const statsMessage = 
      `📊 STATISTIK BOT\n\n` +
      `👥 Total pengguna: ${dataStats.totalUsers}\n` +
      `💬 Sedang obrolan: ${matchingStats.activeChats} pasang\n` +
      `⏳ Dalam antrian: ${matchingStats.queueLength}\n` +
      `🚫 Diblokir: ${dataStats.blockedUsers}\n` +
      `📋 Total laporan: ${dataStats.totalReports}\n` +
      `⏰ Laporan pending: ${dataStats.pendingReports}`;

    this.bot.sendMessage(chatId, statsMessage);
  }

  handleReports(msg) {
    const adminId = msg.from.id;
    const chatId = msg.chat.id;

    if (!helpers.isAdmin(adminId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses admin.');
      return;
    }

    const recentReports = reportService.getRecentReports(5);
    
    if (recentReports.length === 0) {
      this.bot.sendMessage(chatId, '📋 Tidak ada laporan terbaru.');
      return;
    }

    let reportsMessage = '📋 LAPORAN TERBARU:\n\n';
    
    recentReports.forEach((report, index) => {
      reportsMessage += 
        `${index + 1}. ${report.reported.name} (ID: ${report.reported.id})\n` +
        `   Dilaporkan oleh: ${report.reporter.name}\n` +
        `   Waktu: ${helpers.formatTimeAgo(report.timestamp)}\n` +
        `   Status: ${report.status}\n\n`;
    });

    this.bot.sendMessage(chatId, reportsMessage);
  }

  handleAdminHelp(msg) {
    const adminId = msg.from.id;
    const chatId = msg.chat.id;

    if (!helpers.isAdmin(adminId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses admin.');
      return;
    }

    const adminHelp = 
      `🔧 PERINTAH ADMIN:\n\n` +
      `/block [user_id] - Blokir pengguna\n` +
      `/unblock [user_id] - Unblock pengguna\n` +
      `/stats - Lihat statistik bot\n` +
      `/reports - Lihat laporan terbaru\n` +
      `/adminhelp - Bantuan admin\n\n` +
      `👤 PERINTAH PENGGUNA:\n` +
      `/start - Mulai mencari obrolan\n` +
      `/stop - Keluar dari antrian/obrolan\n` +
      `/report - Laporkan pengguna\n` +
      `/help - Bantuan pengguna`;

    this.bot.sendMessage(chatId, adminHelp);
  }
}

module.exports = AdminHandlers;
