const dataService = require('../services/dataService');
const matchingService = require('../services/matchingService');
const reportService = require('../services/reportService');
const helpers = require('../utils/helpers');

class UserHandlers {
  constructor(bot) {
    this.bot = bot;
  }

  handleStart(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(chatId, '❌ Anda telah diblokir dari menggunakan bot ini.');
      return;
    }

    // Save/update user info
    const userInfo = helpers.formatUserInfo(msg.from);
    dataService.addUser(userId, userInfo);

    // Add to queue or inform about current status
    if (matchingService.isInChat(userId)) {
      this.bot.sendMessage(chatId, '💬 Anda sedang dalam obrolan. Gunakan /stop untuk mengakhiri obrolan.');
      return;
    }

    if (matchingService.addToQueue(userId)) {
      const position = matchingService.getQueuePosition(userId);
      this.bot.sendMessage(chatId, 
        `🔍 Anda telah masuk antrian (posisi: ${position})\n` +
        `⏳ Mencari pasangan obrolan...\n\n` +
        `Gunakan /stop untuk keluar dari antrian.`
      );

      // Try to match
      const match = matchingService.matchUsers();
      if (match) {
        this.handleMatch(match.user1Id, match.user2Id);
      }
    } else {
      const position = matchingService.getQueuePosition(userId);
      this.bot.sendMessage(chatId, `⏳ Anda sudah dalam antrian (posisi: ${position}). Silakan tunggu...`);
    }
  }

  handleStop(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Remove from queue
    if (matchingService.removeFromQueue(userId)) {
      this.bot.sendMessage(chatId, '🚫 Anda telah keluar dari antrian.');
      return;
    }

    // End active chat
    const chatResult = matchingService.endChat(userId);
    if (chatResult) {
      this.bot.sendMessage(userId, '🔚 Obrolan telah dihentikan.');
      this.bot.sendMessage(chatResult.partnerId, '🔚 Pasangan Anda telah mengakhiri obrolan.');
    } else {
      this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan atau antrian.');
    }
  }

  handleMessage(msg) {
    const userId = msg.from.id;
    const text = msg.text;

    // Skip commands
    if (text.startsWith('/')) return;

    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(msg.chat.id, '❌ Anda telah diblokir dari menggunakan bot ini.');
      return;
    }

    // Forward message to partner
    if (matchingService.isInChat(userId)) {
      const partnerId = matchingService.getPartner(userId);
      const userInfo = dataService.getUser(userId);
      
      this.bot.sendMessage(partnerId, `${userInfo.name}: ${text}`);
    } else {
      this.bot.sendMessage(msg.chat.id, '❌ Anda tidak sedang dalam obrolan. Gunakan /start untuk memulai.');
    }
  }

  handleReport(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!matchingService.isInChat(userId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan.');
      return;
    }

    const partnerId = matchingService.getPartner(userId);
    const reporterInfo = helpers.formatUserInfo(msg.from);
    const reportedUser = dataService.getUser(partnerId);
    
    if (!reportedUser) {
      this.bot.sendMessage(chatId, '❌ Tidak dapat memproses laporan.');
      return;
    }

    const result = reportService.reportUser(reporterInfo, reportedUser);
    
    // Send report to admin
    const reportMessage = 
      `🚨 LAPORAN PENGGUNA\n\n` +
      `👤 Pelapor: ${reporterInfo.name} (@${reporterInfo.username})\n` +
      `ID: ${reporterInfo.id}\n\n` +
      `🚫 Dilaporkan: ${reportedUser.name} (@${reportedUser.username})\n` +
      `ID: ${reportedUser.id}\n` +
      `Jumlah laporan: ${reportedUser.reportCount}\n` +
      `Waktu: ${helpers.formatTimeAgo(result.report.timestamp)}\n\n` +
      `${result.autoBlocked ? '⚠️ User telah otomatis diblokir!' : `Gunakan /block ${reportedUser.id} untuk memblokir.`}`;

    this.bot.sendMessage(process.env.ADMIN_ID, reportMessage);
    this.bot.sendMessage(chatId, '✅ Laporan telah dikirim ke admin. Terima kasih!');

    if (result.autoBlocked) {
      // End chat and notify
      matchingService.endChat(userId);
      this.bot.sendMessage(partnerId, '🚫 Anda telah diblokir dari bot ini.');
      this.bot.sendMessage(userId, '⚠️ Pasangan Anda telah diblokir. Obrolan dihentikan.');
    }
  }

  handleHelp(msg) {
    const chatId = msg.chat.id;
    const helpMessage = 
      `🤖 BANTUAN BOT RANDOM CHAT\n\n` +
      `📝 Perintah yang tersedia:\n` +
      `/start - Mulai mencari pasangan obrolan\n` +
      `/stop - Keluar dari antrian atau mengakhiri obrolan\n` +
      `/report - Laporkan pengguna yang tidak pantas\n` +
      `/help - Tampilkan bantuan ini\n\n` +
      `✨ Cara menggunakan:\n` +
      `1. Gunakan /start untuk mulai mencari pasangan\n` +
      `2. Tunggu hingga ditemukan pasangan\n` +
      `3. Mulai obrolan dengan mengirim pesan\n` +
      `4. Gunakan /stop untuk mengakhiri obrolan\n` +
      `5. Gunakan /report jika ada masalah dengan pasangan`;

    this.bot.sendMessage(chatId, helpMessage);
  }

  handleMatch(user1Id, user2Id) {
    const user1Info = dataService.getUser(user1Id);
    const user2Info = dataService.getUser(user2Id);

    this.bot.sendMessage(user1Id, 
      `✅ Anda telah dicocokkan dengan: ${user2Info.name}\n` +
      `💬 Mulai obrolan! Gunakan /stop untuk mengakhiri atau /report untuk melaporkan user.`
    );

    this.bot.sendMessage(user2Id, 
      `✅ Anda telah dicocokkan dengan: ${user1Info.name}\n` +
      `💬 Mulai obrolan! Gunakan /stop untuk mengakhiri atau /report untuk melaporkan user.`
    );
  }
}

module.exports = UserHandlers;
