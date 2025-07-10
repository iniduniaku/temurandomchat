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
      
      // Show continue options to partner
      const UserHandlers = require('./userHandlers');
      const userHandlerInstance = new UserHandlers(this.bot);
      userHandlerInstance.showContinueOptions(chatResult.partnerId, 'partner_blocked');
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
      `⏰ Laporan pending: ${dataStats.pendingReports}\n\n` +
      `📈 Statistik Real-time:\n` +
      `├ Users online: ${matchingStats.activeChats * 2 + matchingStats.queueLength}\n` +
      `├ Success rate: ${dataStats.totalUsers > 0 ? Math.round((matchingStats.activeChats * 2 / dataStats.totalUsers) * 100) : 0}%\n` +
      `└ Updated: ${helpers.formatDateTime(new Date().toISOString())}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh Stats', callback_data: 'admin_refresh_stats' },
          { text: '📋 View Reports', callback_data: 'admin_view_reports' }
        ],
        [
          { text: '🧹 Run Maintenance', callback_data: 'admin_maintenance' }
        ]
      ]
    };

    this.bot.sendMessage(chatId, statsMessage, {
      reply_markup: keyboard
    });
  }

  handleReports(msg) {
    const adminId = msg.from.id;
    const chatId = msg.chat.id;

    if (!helpers.isAdmin(adminId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses admin.');
      return;
    }

    const recentReports = reportService.getRecentReports(10);
    
    if (recentReports.length === 0) {
      this.bot.sendMessage(chatId, '📋 Tidak ada laporan terbaru.');
      return;
    }

    let reportsMessage = '📋 LAPORAN TERBARU (10 Terakhir):\n\n';
    
    recentReports.forEach((report, index) => {
      const statusIcon = report.status === 'pending' ? '⏳' : 
                        report.status === 'blocked' ? '🚫' : 
                        report.status === 'ignored' ? '✅' : '❓';
      
      reportsMessage += 
        `${index + 1}. ${statusIcon} ${report.reported.name} (ID: ${report.reported.id})\n` +
        `   👤 Pelapor: ${report.reporter.name}\n` +
        `   📅 ${helpers.formatTimeAgo(report.timestamp)}\n` +
        `   📊 Status: ${report.status}\n`;
      
      if (report.actionBy) {
        reportsMessage += `   👮 Action by: ${report.actionBy}\n`;
      }
      
      reportsMessage += '\n';
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh Reports', callback_data: 'admin_view_reports' },
          { text: '📊 Statistics', callback_data: 'admin_refresh_stats' }
        ]
      ]
    };

    this.bot.sendMessage(chatId, reportsMessage, {
      reply_markup: keyboard
    });
  }

  // TAMBAHAN: Method untuk handle command /maintenance
  handleMaintenance(msg) {
    const adminId = msg.from.id;
    const chatId = msg.chat.id;

    if (!helpers.isAdmin(adminId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses admin.');
      return;
    }

    this.bot.sendMessage(chatId, '🔧 Memulai maintenance data...');
    
    try {
      dataService.performMaintenance();
      
      // Get stats after maintenance
      const stats = dataService.getStats();
      const maintenanceReport = 
        `✅ MAINTENANCE SELESAI!\n\n` +
        `📊 Status setelah maintenance:\n` +
        `├ Total users: ${stats.totalUsers}\n` +
        `├ Blocked users: ${stats.blockedUsers}\n` +
        `├ Total reports: ${stats.totalReports}\n` +
        `└ Pending reports: ${stats.pendingReports}\n\n` +
        `🕐 Completed at: ${helpers.formatDateTime(new Date().toISOString())}`;
      
      this.bot.sendMessage(chatId, maintenanceReport);
    } catch (error) {
      console.error('Maintenance error:', error);
      this.bot.sendMessage(chatId, `❌ Error during maintenance: ${error.message}`);
    }
  }

  handleAdminHelp(msg) {
    const adminId = msg.from.id;
    const chatId = msg.chat.id;

    if (!helpers.isAdmin(adminId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses admin.');
      return;
    }

    const adminHelp = 
      `🔧 PANDUAN ADMIN BOT RANDOM CHAT\n\n` +
      `📱 PERINTAH COMMAND-BASED:\n` +
      `/block [user_id] - Blokir pengguna\n` +
      `/unblock [user_id] - Unblock pengguna\n` +
      `/stats - Lihat statistik bot\n` +
      `/reports - Lihat laporan terbaru\n` +
      `/maintenance - Jalankan maintenance\n` +
      `/adminhelp - Bantuan admin\n\n` +
      `🖱️ FITUR INTERACTIVE:\n\n` +
      `📨 Laporan Otomatis:\n` +
      `• Saat ada laporan, admin dapat:\n` +
      `  - 🚫 Block user langsung\n` +
      `  - ✅ Ignore laporan\n` +
      `  - 📋 View history lengkap user\n\n` +
      `👤 User Management:\n` +
      `• View riwayat user (laporan, status, dll)\n` +
      `• Send warning ke user\n` +
      `• Force end chat yang sedang berlangsung\n` +
      `• Block/unblock langsung dari history\n\n` +
      `📊 Dashboard:\n` +
      `• Real-time statistics dengan refresh\n` +
      `• Report management dengan status\n` +
      `• One-click maintenance\n\n` +
      `🔄 AUTO-FEATURES:\n` +
      `• Auto-block setelah 3+ laporan\n` +
      `• Auto data cleanup (inactive users)\n` +
      `• Auto maintenance setiap 24 jam\n` +
      `• Real-time status tracking\n\n` +
      `👤 PERINTAH PENGGUNA:\n` +
      `/start - Mulai mencari obrolan\n` +
      `/stop - Keluar dari antrian/obrolan\n` +
      `/report - Laporkan pengguna\n` +
      `/help - Bantuan pengguna\n\n` +
      `💡 TIPS:\n` +
      `• Gunakan inline buttons untuk aksi cepat\n` +
      `• Check user history sebelum block\n` +
      `• Berikan warning sebelum block jika perlu\n` +
      `• Monitor statistics secara berkala`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📊 View Stats', callback_data: 'admin_refresh_stats' },
          { text: '📋 View Reports', callback_data: 'admin_view_reports' }
        ],
        [
          { text: '🧹 Run Maintenance', callback_data: 'admin_maintenance' }
        ]
      ]
    };

    this.bot.sendMessage(chatId, adminHelp, {
      reply_markup: keyboard
    });
  }

  // Handler untuk admin callback queries
  handleAdminCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const adminId = callbackQuery.from.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    // Verify admin
    if (!helpers.isAdmin(adminId)) {
      this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Anda tidak memiliki akses admin.',
        show_alert: true
      });
      return;
    }

    this.bot.answerCallbackQuery(callbackQuery.id);

    // Parse callback data
    if (data.startsWith('admin_')) {
      const parts = data.split('_');
      const action = parts[1];
      const params = parts.slice(2);

      switch (action) {
        case 'block':
          this.blockUserFromReport(chatId, messageId, parseInt(params[0]), parseInt(params[1]), callbackQuery.message.text);
          break;
        case 'ignore':
          this.ignoreReport(chatId, messageId, parseInt(params[0]), callbackQuery.message.text);
          break;
        case 'history':
          this.showUserHistory(chatId, parseInt(params[0]));
          break;
        case 'direct':
          this.handleDirectAction(callbackQuery, params[0], parseInt(params[1]));
          break;
        case 'warn':
          this.sendWarningToUser(callbackQuery, parseInt(params[0]));
          break;
        case 'refresh':
          if (params[0] === 'stats') {
            this.refreshStats(chatId, messageId);
          }
          break;
        case 'view':
          if (params[0] === 'reports') {
            this.refreshReports(chatId, messageId);
          }
          break;
        case 'maintenance':
          this.runMaintenanceFromCallback(chatId);
          break;
        case 'end':
          if (params[0] === 'chat') {
            this.handleDirectAction(callbackQuery, 'end', parseInt(params[1]));
          }
          break;
      }
    }
  }

  blockUserFromReport(chatId, messageId, userId, reportId, originalMessage) {
    try {
      const userInfo = dataService.getUser(userId);
      
      if (!userInfo) {
        this.bot.editMessageText('❌ User tidak ditemukan.', {
          chat_id: chatId,
          message_id: messageId
        });
        return;
      }

      // Block the user
      dataService.blockUser(userId);

      // Update report status
      const reports = dataService.loadReports();
      const reportIndex = reports.findIndex(r => r.id === reportId);
      if (reportIndex > -1) {
        reports[reportIndex].status = 'blocked';
        reports[reportIndex].actionBy = 'admin';
        reports[reportIndex].actionDate = new Date().toISOString();
        dataService.saveReports(reports);
      }

      // End active chat if user is chatting
      const chatResult = matchingService.endChat(userId);
      if (chatResult) {
        this.bot.sendMessage(userId, '🚫 Anda telah diblokir dari bot ini.');
        this.bot.sendMessage(chatResult.partnerId, '⚠️ Pasangan Anda telah diblokir. Obrolan dihentikan.');
        
        // Show continue options to partner
        const UserHandlers = require('./userHandlers');
        const userHandlerInstance = new UserHandlers(this.bot);
        userHandlerInstance.showContinueOptions(chatResult.partnerId, 'partner_blocked');
      }

      // Remove from queue
      matchingService.removeFromQueue(userId);

      // Update message with action taken
      const updatedMessage = originalMessage + 
        `\n\n✅ TINDAKAN DIAMBIL:\n` +
        `🚫 User telah diblokir oleh admin\n` +
        `📅 Waktu: ${helpers.formatDateTime(new Date().toISOString())}`;

      this.bot.editMessageText(updatedMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });

      // Send confirmation
      this.bot.sendMessage(chatId, `✅ User ${userInfo.name} (ID: ${userId}) telah berhasil diblokir.`);

    } catch (error) {
      console.error('Error blocking user from report:', error);
      this.bot.editMessageText('❌ Terjadi error saat memblokir user.', {
        chat_id: chatId,
        message_id: messageId
      });
    }
  }

  ignoreReport(chatId, messageId, reportId, originalMessage) {
    try {
      // Update report status
      const reports = dataService.loadReports();
      const reportIndex = reports.findIndex(r => r.id === reportId);
      if (reportIndex > -1) {
        reports[reportIndex].status = 'ignored';
        reports[reportIndex].actionBy = 'admin';
        reports[reportIndex].actionDate = new Date().toISOString();
        dataService.saveReports(reports);
      }

      // Update message with action taken
      const updatedMessage = originalMessage + 
        `\n\n✅ TINDAKAN DIAMBIL:\n` +
        `👁️ Laporan diabaikan oleh admin\n` +
        `📅 Waktu: ${helpers.formatDateTime(new Date().toISOString())}`;

      this.bot.editMessageText(updatedMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Error ignoring report:', error);
      this.bot.editMessageText('❌ Terjadi error saat mengupdate laporan.', {
        chat_id: chatId,
        message_id: messageId
      });
    }
  }

  showUserHistory(chatId, userId) {
    try {
      const userInfo = dataService.getUser(userId);
      const userReports = reportService.getUserReports(userId);
      
      if (!userInfo) {
        this.bot.sendMessage(chatId, '❌ User tidak ditemukan.');
        return;
      }

      let historyMessage = `📋 RIWAYAT USER\n\n`;
      historyMessage += `👤 Informasi User:\n`;
      historyMessage += `├ Nama: ${userInfo.name}\n`;
      historyMessage += `├ Username: @${userInfo.username}\n`;
      historyMessage += `├ ID: \`${userInfo.id}\`\n`;
      historyMessage += `├ Bergabung: ${helpers.formatDate(userInfo.joinDate)}\n`;
      historyMessage += `├ Terakhir aktif: ${helpers.formatTimeAgo(userInfo.lastActive || userInfo.joinDate)}\n`;
      historyMessage += `├ Total laporan: ${userInfo.reportCount || 0}\n`;
      historyMessage += `├ Bahasa: ${userInfo.language || 'Tidak diketahui'}\n`;
      historyMessage += `└ Status: ${dataService.isUserBlocked(userId) ? '🚫 Diblokir' : '✅ Aktif'}\n\n`;

      if (userReports.length > 0) {
        historyMessage += `📊 Riwayat Laporan (${Math.min(userReports.length, 5)} terbaru):\n\n`;
        
        const recentReports = userReports.slice(-5).reverse();
        recentReports.forEach((report, index) => {
          const isReported = report.reported.id === userId;
          const otherUser = isReported ? report.reporter : report.reported;
          const statusIcon = report.status === 'pending' ? '⏳' : 
                            report.status === 'blocked' ? '🚫' : 
                            report.status === 'ignored' ? '✅' : '❓';
          
          historyMessage += `${index + 1}. ${statusIcon} ${isReported ? '🚫 Dilaporkan oleh' : '🚨 Melaporkan'}: ${otherUser.name}\n`;
          historyMessage += `   📅 ${helpers.formatDateTime(report.timestamp)}\n`;
          historyMessage += `   📋 Status: ${report.status}\n`;
          if (report.actionBy) {
            historyMessage += `   👮 Action: ${report.actionBy}\n`;
          }
          historyMessage += '\n';
        });
      } else {
        historyMessage += `📊 Tidak ada riwayat laporan.\n\n`;
      }

      // Current status
      if (matchingService.isInChat(userId)) {
        const partnerId = matchingService.getPartner(userId);
        const partnerInfo = dataService.getUser(partnerId);
        historyMessage += `🟢 Status saat ini: Sedang obrolan dengan ${partnerInfo?.name || 'Unknown'}\n`;
      } else if (matchingService.getQueuePosition(userId) > 0) {
        historyMessage += `🟡 Status saat ini: Dalam antrian (posisi ${matchingService.getQueuePosition(userId)})\n`;
      } else {
        historyMessage += `⚪ Status saat ini: Offline\n`;
      }

      // Add action buttons
      let keyboard = null;
      if (!dataService.isUserBlocked(userId)) {
        keyboard = {
          inline_keyboard: [
            [
              { text: '🚫 Block User', callback_data: `admin_direct_block_${userId}` },
              { text: '⚠️ Send Warning', callback_data: `admin_warn_${userId}` }
            ],
            [
              { text: '📞 Force End Chat', callback_data: `admin_end_chat_${userId}` },
              { text: '🔄 Refresh Info', callback_data: `admin_history_${userId}` }
            ]
          ]
        };
      } else {
        keyboard = {
          inline_keyboard: [
            [
              { text: '✅ Unblock User', callback_data: `admin_direct_unblock_${userId}` },
              { text: '🔄 Refresh Info', callback_data: `admin_history_${userId}` }
            ]
          ]
        };
      }

      this.bot.sendMessage(chatId, historyMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error showing user history:', error);
      this.bot.sendMessage(chatId, '❌ Terjadi error saat mengambil riwayat user.');
    }
  }

  handleDirectAction(callbackQuery, action, userId) {
    const chatId = callbackQuery.message.chat.id;
    const userInfo = dataService.getUser(userId);

    switch (action) {
      case 'block':
        dataService.blockUser(userId);
        
        // End chat if active
        const chatResult = matchingService.endChat(userId);
        if (chatResult) {
          this.bot.sendMessage(userId, '🚫 Anda telah diblokir dari bot ini.');
          this.bot.sendMessage(chatResult.partnerId, '⚠️ Pasangan Anda telah diblokir. Obrolan dihentikan.');
          
          // Show continue options to partner
          const UserHandlers = require('./userHandlers');
          const userHandlerInstance = new UserHandlers(this.bot);
          userHandlerInstance.showContinueOptions(chatResult.partnerId, 'partner_blocked');
        }
        
        matchingService.removeFromQueue(userId);
        this.bot.sendMessage(chatId, `✅ User ${userInfo?.name || 'Unknown'} telah diblokir.`);
        break;

      case 'unblock':
        dataService.unblockUser(userId);
        this.bot.sendMessage(chatId, `✅ User ${userInfo?.name || 'Unknown'} telah di-unblock.`);
        break;

      case 'end':
        if (matchingService.isInChat(userId)) {
          const endResult = matchingService.endChat(userId, 'admin_force');
          if (endResult) {
            this.bot.sendMessage(userId, '⚠️ Obrolan Anda telah dihentikan oleh admin.');
            this.bot.sendMessage(endResult.partnerId, '⚠️ Obrolan telah dihentikan oleh admin.');
            
            const UserHandlers = require('./userHandlers');
            const userHandlerInstance = new UserHandlers(this.bot);
            userHandlerInstance.showContinueOptions(userId, 'admin_ended');
            userHandlerInstance.showContinueOptions(endResult.partnerId, 'admin_ended');
            
            this.bot.sendMessage(chatId, `✅ Obrolan user ${userInfo?.name || 'Unknown'} telah dihentikan.`);
          } else {
            this.bot.sendMessage(chatId, `❌ User ${userInfo?.name || 'Unknown'} tidak sedang dalam obrolan.`);
          }
        } else {
          this.bot.sendMessage(chatId, `❌ User ${userInfo?.name || 'Unknown'} tidak sedang dalam obrolan.`);
        }
        break;
    }
  }

  sendWarningToUser(callbackQuery, userId) {
    const chatId = callbackQuery.message.chat.id;
    const userInfo = dataService.getUser(userId);

    const warningMessage = 
      `⚠️ PERINGATAN DARI ADMIN\n\n` +
      `Anda telah menerima peringatan karena perilaku yang tidak pantas dalam menggunakan bot random chat.\n\n` +
      `📋 Mohon untuk:\n` +
      `• Bersikap sopan dan menghormati pengguna lain\n` +
      `• Tidak mengirim konten yang tidak pantas\n` +
      `• Mengikuti aturan dan etika dalam berobrolan\n\n` +
      `⚠️ Pelanggaran selanjutnya dapat mengakibatkan pemblokiran akun Anda secara permanen.\n\n` +
      `Terima kasih atas pengertian dan kerjasamanya.`;

    this.bot.sendMessage(userId, warningMessage);
    
    // Log warning to admin
    const logMessage = `⚠️ Warning sent to ${userInfo?.name || 'User'} (ID: ${userId}) at ${helpers.formatDateTime(new Date().toISOString())}`;
    this.bot.sendMessage(chatId, logMessage);

    // Update user data with warning count
    const currentUser = dataService.getUser(userId);
    if (currentUser) {
      dataService.updateUser(userId, {
        warningCount: (currentUser.warningCount || 0) + 1,
        lastWarning: new Date().toISOString()
      });
    }
  }

  refreshStats(chatId, messageId) {
    try {
      const dataStats = dataService.getStats();
      const matchingStats = matchingService.getStats();

      const statsMessage = 
        `📊 STATISTIK BOT (Updated)\n\n` +
        `👥 Total pengguna: ${dataStats.totalUsers}\n` +
        `💬 Sedang obrolan: ${matchingStats.activeChats} pasang\n` +
        `⏳ Dalam antrian: ${matchingStats.queueLength}\n` +
        `🚫 Diblokir: ${dataStats.blockedUsers}\n` +
        `📋 Total laporan: ${dataStats.totalReports}\n` +
        `⏰ Laporan pending: ${dataStats.pendingReports}\n\n` +
        `📈 Statistik Real-time:\n` +
        `├ Users online: ${matchingStats.activeChats * 2 + matchingStats.queueLength}\n` +
        `├ Success rate: ${dataStats.totalUsers > 0 ? Math.round((matchingStats.activeChats * 2 / dataStats.totalUsers) * 100) : 0}%\n` +
        `└ Updated: ${helpers.formatDateTime(new Date().toISOString())}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Refresh Stats', callback_data: 'admin_refresh_stats' },
            { text: '📋 View Reports', callback_data: 'admin_view_reports' }
          ],
          [
            { text: '🧹 Run Maintenance', callback_data: 'admin_maintenance' }
          ]
        ]
      };

      this.bot.editMessageText(statsMessage, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error refreshing stats:', error);
      this.bot.sendMessage(chatId, '❌ Error refreshing statistics.');
    }
  }

  refreshReports(chatId, messageId) {
    try {
      const recentReports = reportService.getRecentReports(10);
      
      if (recentReports.length === 0) {
        this.bot.editMessageText('📋 Tidak ada laporan terbaru.', {
          chat_id: chatId,
          message_id: messageId
        });
        return;
      }

      let reportsMessage = '📋 LAPORAN TERBARU (Updated):\n\n';
      
      recentReports.forEach((report, index) => {
        const statusIcon = report.status === 'pending' ? '⏳' : 
                          report.status === 'blocked' ? '🚫' : 
                          report.status === 'ignored' ? '✅' : '❓';
        
        reportsMessage += 
          `${index + 1}. ${statusIcon} ${report.reported.name} (ID: ${report.reported.id})\n` +
          `   👤 Pelapor: ${report.reporter.name}\n` +
          `   📅 ${helpers.formatTimeAgo(report.timestamp)}\n` +
          `   📊 Status: ${report.status}\n`;
        
        if (report.actionBy) {
          reportsMessage += `   👮 Action by: ${report.actionBy}\n`;
        }
        
        reportsMessage += '\n';
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Refresh Reports', callback_data: 'admin_view_reports' },
            { text: '📊 Statistics', callback_data: 'admin_refresh_stats' }
          ]
        ]
      };

      this.bot.editMessageText(reportsMessage, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error refreshing reports:', error);
      this.bot.sendMessage(chatId, '❌ Error refreshing reports.');
    }
  }

  runMaintenanceFromCallback(chatId) {
    this.bot.sendMessage(chatId, '🔧 Memulai maintenance data...');
    
    try {
      dataService.performMaintenance();
      
      // Get stats after maintenance
      const stats = dataService.getStats();
      const maintenanceReport = 
        `✅ MAINTENANCE SELESAI!\n\n` +
        `📊 Status setelah maintenance:\n` +
        `├ Total users: ${stats.totalUsers}\n` +
        `├ Blocked users: ${stats.blockedUsers}\n` +
        `├ Total reports: ${stats.totalReports}\n` +
        `└ Pending reports: ${stats.pendingReports}\n\n` +
        `🕐 Completed at: ${helpers.formatDateTime(new Date().toISOString())}`;
      
      this.bot.sendMessage(chatId, maintenanceReport);
    } catch (error) {
      this.bot.sendMessage(chatId, `❌ Error during maintenance: ${error.message}`);
    }
  }
}

module.exports = AdminHandlers;
