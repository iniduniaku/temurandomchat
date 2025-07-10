const dataService = require('../services/dataService');
const matchingService = require('../services/matchingService');
const reportService = require('../services/reportService');
const helpers = require('../utils/helpers');

class UserHandlers {
  constructor(bot) {
    this.bot = bot;
  }

  // /start hanya untuk informasi awal
  handleStart(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(chatId, '🚫 Anda telah diblokir dari bot ini.');
      return;
    }

    // Add/update user data
    const userInfo = {
      id: userId,
      name: msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : ''),
      username: msg.from.username || 'no_username',
      language: msg.from.language_code || 'unknown'
    };

    dataService.addUser(userId, userInfo);

    // Show welcome message (informasi awal saja)
    this.showWelcomeMessage(chatId);
  }

  // /cari untuk mencari pasangan
  handleCari(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(chatId, '🚫 Anda telah diblokir dari bot ini.');
      return;
    }

    // Add/update user data jika belum ada
    const userInfo = {
      id: userId,
      name: msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : ''),
      username: msg.from.username || 'no_username',
      language: msg.from.language_code || 'unknown'
    };

    dataService.addUser(userId, userInfo);

    // Langsung mulai pencarian
    this.startSearching(userId, chatId);
  }

  showWelcomeMessage(chatId) {
    const welcomeMessage = 
      `🤖 **SELAMAT DATANG DI RANDOM CHAT BOT!**\n\n` +
      `✨ **Fitur Utama:**\n` +
      `• 💬 Obrolan random dengan pengguna lain\n` +
      `• 🖼️ Berbagi foto, video, audio, sticker, dan media lainnya\n` +
      `• 👤 Lihat foto profil dan info pengguna\n` +
      `• ⚡ Interface yang mudah dengan tombol cepat\n` +
      `• 🛡️ Sistem laporan untuk keamanan\n\n` +
      `📋 **Cara Menggunakan:**\n` +
      `1. Ketik /cari untuk mencari pasangan obrolan\n` +
      `2. Tunggu hingga menemukan pasangan\n` +
      `3. Mulai mengobrol dengan bebas!\n` +
      `4. Gunakan /stop untuk mengakhiri obrolan\n\n` +
      `🔧 **Perintah Utama:**\n` +
      `• /start - Tampilkan informasi ini\n` +
      `• /cari - Mulai mencari pasangan obrolan\n` +
      `• /stop - Keluar dari antrian/obrolan\n` +
      `• /report - Laporkan pengguna bermasalah\n` +
      `• /help - Tampilkan bantuan lengkap\n\n` +
      `⚠️ **Aturan Penting:**\n` +
      `• Bersikap sopan dan menghormati pengguna lain\n` +
      `• Tidak mengirim konten yang tidak pantas\n` +
      `• Gunakan fitur laporan jika ada masalah\n\n` +
      `🚀 **Siap untuk memulai? Ketik /cari**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔍 Mulai Cari Pasangan', callback_data: 'start_cari' }
        ],
        [
          { text: '❓ Bantuan Lengkap', callback_data: 'show_help' },
          { text: '📊 Info Bot', callback_data: 'show_info' }
        ]
      ]
    };

    this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  startSearching(userId, chatId) {
    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(chatId, '🚫 Anda telah diblokir dari bot ini.');
      return;
    }

    // Check if user is already in chat
    if (matchingService.isInChat(userId)) {
      const partnerId = matchingService.getPartner(userId);
      const partnerInfo = dataService.getUser(partnerId);
      
      this.bot.sendMessage(chatId, 
        `💬 Anda sudah sedang obrolan dengan ${partnerInfo?.name || 'seseorang'}!\n\n` +
        `Gunakan /stop untuk mengakhiri obrolan saat ini.`
      );
      return;
    }

    // Check if user is already in queue
    if (matchingService.isInQueue(userId)) {
      const position = matchingService.getQueuePosition(userId);
      this.bot.sendMessage(chatId, 
        `⏳ Anda sudah dalam antrian pencarian!\n\n` +
        `📍 Posisi Anda: ${position}\n` +
        `⏱️ Mohon tunggu sebentar...`
      );
      return;
    }

    // Add to queue
    matchingService.addToQueue(userId);

    const searchingMessage = 
      `🔍 **MENCARI PASANGAN OBROLAN...**\n\n` +
      `⏳ Status: Sedang mencari\n` +
      `📍 Posisi antrian: ${matchingService.getQueuePosition(userId)}\n` +
      `👥 Total pengguna dalam antrian: ${matchingService.getQueueLength()}\n\n` +
      `💡 Tip: Pastikan notifikasi aktif agar tidak melewatkan chat!`;

    const searchKeyboard = {
      inline_keyboard: [
        [{ text: '❌ Batalkan Pencarian', callback_data: 'cancel_search' }]
      ]
    };

    this.bot.sendMessage(chatId, searchingMessage, {
      parse_mode: 'Markdown',
      reply_markup: searchKeyboard
    });

    // Try to find match
    matchingService.tryMatch();
  }

  handleStop(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Check if user is in chat
    if (matchingService.isInChat(userId)) {
      const partnerId = matchingService.getPartner(userId);
      const endResult = matchingService.endChat(userId, 'user_stopped');
      
      if (endResult && partnerId) {
        this.bot.sendMessage(chatId, '⏹️ Obrolan telah dihentikan.');
        this.bot.sendMessage(partnerId, '👋 Pasangan Anda telah meninggalkan obrolan.');
        
        this.showContinueOptions(userId, 'user_stopped');
        this.showContinueOptions(partnerId, 'partner_left');
      }
    } 
    // Check if user is in queue
    else if (matchingService.isInQueue(userId)) {
      matchingService.removeFromQueue(userId);
      this.bot.sendMessage(chatId, '❌ Pencarian dibatalkan.');
      this.showWelcomeMessage(chatId);
    } 
    else {
      this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan atau pencarian.');
      this.showWelcomeMessage(chatId);
    }
  }

  handleReport(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Check if user is in chat
    if (!matchingService.isInChat(userId)) {
      this.bot.sendMessage(chatId, '❌ Anda harus sedang dalam obrolan untuk melaporkan pengguna.');
      return;
    }

    const partnerId = matchingService.getPartner(userId);
    const userInfo = dataService.getUser(userId);
    const partnerInfo = dataService.getUser(partnerId);

    if (!partnerInfo) {
      this.bot.sendMessage(chatId, '❌ Tidak dapat menemukan informasi pasangan Anda.');
      return;
    }

    // Add report
    const report = dataService.addReport(userInfo, partnerInfo);
    
    if (!report) {
      this.bot.sendMessage(chatId, '❌ Gagal mengirim laporan. Silakan coba lagi.');
      return;
    }

    // Send confirmation to reporter
    this.bot.sendMessage(chatId, 
      `✅ Laporan Anda telah dikirim!\n\n` +
      `📋 User yang dilaporkan: ${partnerInfo.name}\n` +
      `🆔 ID Laporan: ${report.id}\n` +
      `📅 Waktu: ${helpers.formatDateTime(report.timestamp)}\n\n` +
      `🔍 Admin akan meninjau laporan Anda segera.`
    );

    // Check if user should be auto-blocked (3+ reports)
    const updatedPartnerInfo = dataService.getUser(partnerId);
    if (updatedPartnerInfo && updatedPartnerInfo.reportCount >= 3) {
      // Auto-block user
      dataService.blockUser(partnerId);
      
      // End their chat
      const endResult = matchingService.endChat(partnerId);
      if (endResult) {
        this.bot.sendMessage(partnerId, '🚫 Anda telah diblokir otomatis karena terlalu banyak laporan.');
        this.bot.sendMessage(userId, '⚠️ Pasangan Anda telah diblokir otomatis. Obrolan dihentikan.');
        
        this.showContinueOptions(userId, 'partner_blocked');
      }
      
      // Remove from queue if in queue
      matchingService.removeFromQueue(partnerId);
      
      // Notify admin about auto-block
      if (helpers.isValidAdminId()) {
        const adminId = helpers.getAdminId();
        this.bot.sendMessage(adminId, 
          `🚫 AUTO-BLOCK TRIGGERED\n\n` +
          `👤 User: ${updatedPartnerInfo.name} (ID: ${partnerId})\n` +
          `📊 Total Reports: ${updatedPartnerInfo.reportCount}\n` +
          `📅 Time: ${helpers.formatDateTime(new Date().toISOString())}\n\n` +
          `User has been automatically blocked due to multiple reports.`
        );
      }
    } else {
      // Send notification to admin about new report
      this.sendReportToAdmin(report);
    }
  }

  handleHelp(msg) {
    const chatId = msg.chat.id;
    
    const helpMessage = 
      `❓ **BANTUAN RANDOM CHAT BOT**\n\n` +
      `🔧 **Perintah Utama:**\n` +
      `/start - Tampilkan informasi bot\n` +
      `/cari - Mulai mencari pasangan obrolan\n` +
      `/stop - Keluar dari antrian/obrolan\n` +
      `/report - Laporkan pengguna bermasalah\n` +
      `/help - Tampilkan bantuan ini\n\n` +
      `💬 **Dalam Obrolan:**\n` +
      `• Kirim pesan teks, foto, video, audio, sticker\n` +
      `• Gunakan /stop untuk mengakhiri obrolan\n` +
      `• Gunakan /report untuk melaporkan masalah\n` +
      `• Lihat profil pasangan dengan tombol yang tersedia\n\n` +
      `🛡️ **Keamanan:**\n` +
      `• Gunakan /report jika ada masalah\n` +
      `• Block otomatis setelah 3+ laporan\n` +
      `• Admin akan menindaklanjuti laporan\n\n` +
      `⚡ **Tips:**\n` +
      `• Bersikap sopan untuk pengalaman terbaik\n` +
      `• Gunakan fitur inline keyboard untuk navigasi cepat\n` +
      `• Pastikan notifikasi aktif agar tidak melewatkan chat`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔍 Mulai Cari Pasangan', callback_data: 'start_cari' }
        ],
        [
          { text: '🏠 Menu Utama', callback_data: 'back_to_main_menu' }
        ]
      ]
    };

    this.bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Handle welcome callbacks
    if (['start_cari', 'show_help', 'show_info', 'back_to_welcome'].includes(data)) {
      this.handleWelcomeCallback(callbackQuery);
      return;
    }

    // Handle back to main menu
    if (data === 'back_to_main_menu') {
      this.bot.answerCallbackQuery(callbackQuery.id);
      try {
        this.bot.deleteMessage(chatId, callbackQuery.message.message_id);
      } catch (error) {
        // Message might be too old to delete, ignore error
      }
      this.showWelcomeMessage(chatId);
      return;
    }

    this.bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case 'cancel_search':
        this.handleCancelSearch(userId, chatId, callbackQuery.message.message_id);
        break;
      case 'end_chat':
        this.handleEndChat(userId, chatId);
        break;
      case 'report_user':
        this.handleReportFromCallback(userId, chatId);
        break;
      case 'continue_search':
        this.handleContinueSearch(userId, chatId, callbackQuery.message.message_id);
        break;
      case 'view_profile':
        this.handleViewProfile(userId, chatId);
        break;
      default:
        this.bot.sendMessage(chatId, '❌ Aksi tidak dikenali.');
        break;
    }
  }

  handleWelcomeCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    this.bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case 'start_cari':
        // Hapus welcome message
        try {
          this.bot.deleteMessage(chatId, callbackQuery.message.message_id);
        } catch (error) {
          // Message might be too old to delete, ignore error
        }
        // Mulai pencarian
        this.startSearching(userId, chatId);
        break;

      case 'show_help':
        this.handleHelpFromCallback(chatId, callbackQuery.message.message_id);
        break;

      case 'show_info':
        this.showBotInfo(chatId, callbackQuery.message.message_id);
        break;

      case 'back_to_welcome':
        this.backToWelcome(chatId, callbackQuery.message.message_id);
        break;
    }
  }

  handleHelpFromCallback(chatId, messageId) {
    const helpMessage = 
      `❓ **BANTUAN RANDOM CHAT BOT**\n\n` +
      `🔧 **Perintah Utama:**\n` +
      `/start - Tampilkan informasi bot\n` +
      `/cari - Mulai mencari pasangan obrolan\n` +
      `/stop - Keluar dari antrian/obrolan\n` +
      `/report - Laporkan pengguna bermasalah\n` +
      `/help - Tampilkan bantuan ini\n\n` +
      `💬 **Dalam Obrolan:**\n` +
      `• Kirim pesan teks, foto, video, audio, sticker\n` +
      `• Gunakan /stop untuk mengakhiri obrolan\n` +
      `• Gunakan /report untuk melaporkan masalah\n` +
      `• Lihat profil pasangan dengan tombol yang tersedia\n\n` +
      `🛡️ **Keamanan:**\n` +
      `• Gunakan /report jika ada masalah\n` +
      `• Block otomatis setelah 3+ laporan\n` +
      `• Admin akan menindaklanjuti laporan\n\n` +
      `⚡ **Tips:**\n` +
      `• Bersikap sopan untuk pengalaman terbaik\n` +
      `• Gunakan fitur inline keyboard untuk navigasi cepat\n` +
      `• Pastikan notifikasi aktif agar tidak melewatkan chat`;

    const backKeyboard = {
      inline_keyboard: [
        [{ text: '← Kembali ke Menu', callback_data: 'back_to_welcome' }]
      ]
    };

    this.bot.editMessageText(helpMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: backKeyboard
    });
  }

  showBotInfo(chatId, messageId) {
    const stats = dataService.getStats();
    const matchingStats = matchingService.getStats();

    const infoMessage = 
      `📊 **INFORMASI BOT**\n\n` +
      `🤖 **Random Chat Bot v2.0**\n` +
      `🚀 Bot obrolan random dengan fitur lengkap\n\n` +
      `📈 **Statistik:**\n` +
      `• 👥 Total pengguna: ${stats.totalUsers}\n` +
      `• 💬 Sedang obrolan: ${matchingStats.activeChats} pasang\n` +
      `• ⏳ Dalam antrian: ${matchingStats.queueLength}\n\n` +
      `✨ **Fitur Unggulan:**\n` +
      `• Interface interaktif dengan inline buttons\n` +
      `• Support semua jenis media (foto, video, audio, dll)\n` +
      `• Sistem keamanan dengan fitur laporan\n` +
      `• Auto-cleanup data untuk performa optimal\n` +
      `• Foto profil dan info pengguna\n\n` +
      `💻 **Teknologi:**\n` +
      `• Node.js + Telegram Bot API\n` +
      `• Real-time matching system\n` +
      `• JSON-based data storage\n\n` +
      `📝 **Versi:** 2.0.0\n` +
      `📅 **Update:** ${new Date().toLocaleDateString('id-ID')}`;

    const backKeyboard = {
      inline_keyboard: [
        [{ text: '← Kembali ke Menu', callback_data: 'back_to_welcome' }]
      ]
    };

    this.bot.editMessageText(infoMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: backKeyboard
    });
  }

  backToWelcome(chatId, messageId) {
    const welcomeMessage = 
      `🤖 **SELAMAT DATANG DI RANDOM CHAT BOT!**\n\n` +
      `✨ **Fitur Utama:**\n` +
      `• 💬 Obrolan random dengan pengguna lain\n` +
      `• 🖼️ Berbagi foto, video, audio, sticker, dan media lainnya\n` +
      `• 👤 Lihat foto profil dan info pengguna\n` +
      `• ⚡ Interface yang mudah dengan tombol cepat\n` +
      `• 🛡️ Sistem laporan untuk keamanan\n\n` +
      `📋 **Cara Menggunakan:**\n` +
      `1. Ketik /cari untuk mencari pasangan obrolan\n` +
      `2. Tunggu hingga menemukan pasangan\n` +
      `3. Mulai mengobrol dengan bebas!\n` +
      `4. Gunakan /stop untuk mengakhiri obrolan\n\n` +
      `🔧 **Perintah Utama:**\n` +
      `• /start - Tampilkan informasi ini\n` +
      `• /cari - Mulai mencari pasangan obrolan\n` +
      `• /stop - Keluar dari antrian/obrolan\n` +
      `• /report - Laporkan pengguna bermasalah\n` +
      `• /help - Tampilkan bantuan lengkap\n\n` +
      `⚠️ **Aturan Penting:**\n` +
      `• Bersikap sopan dan menghormati pengguna lain\n` +
      `• Tidak mengirim konten yang tidak pantas\n` +
      `• Gunakan fitur laporan jika ada masalah\n\n` +
      `🚀 **Siap untuk memulai? Ketik /cari**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔍 Mulai Cari Pasangan', callback_data: 'start_cari' }
        ],
        [
          { text: '❓ Bantuan Lengkap', callback_data: 'show_help' },
          { text: '📊 Info Bot', callback_data: 'show_info' }
        ]
      ]
    };

    this.bot.editMessageText(welcomeMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  handleCancelSearch(userId, chatId, messageId) {
    matchingService.removeFromQueue(userId);
    
    try {
      this.bot.editMessageText('❌ Pencarian telah dibatalkan.', {
        chat_id: chatId,
        message_id: messageId
      });
    } catch (error) {
      this.bot.sendMessage(chatId, '❌ Pencarian telah dibatalkan.');
    }
    
    setTimeout(() => {
      this.showWelcomeMessage(chatId);
    }, 2000);
  }

  handleEndChat(userId, chatId) {
    if (!matchingService.isInChat(userId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan.');
      return;
    }

    const partnerId = matchingService.getPartner(userId);
    const endResult = matchingService.endChat(userId, 'user_ended');
    
    if (endResult && partnerId) {
      this.bot.sendMessage(chatId, '⏹️ Obrolan telah dihentikan.');
      this.bot.sendMessage(partnerId, '👋 Pasangan Anda telah mengakhiri obrolan.');
      
      this.showContinueOptions(userId, 'ended');
      this.showContinueOptions(partnerId, 'partner_left');
    }
  }

  handleReportFromCallback(userId, chatId) {
    if (!matchingService.isInChat(userId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan untuk melaporkan pengguna.');
      return;
    }

    const partnerId = matchingService.getPartner(userId);
    const userInfo = dataService.getUser(userId);
    const partnerInfo = dataService.getUser(partnerId);

    if (!partnerInfo) {
      this.bot.sendMessage(chatId, '❌ Tidak dapat menemukan informasi pasangan Anda.');
      return;
    }

    const report = dataService.addReport(userInfo, partnerInfo);
    
    if (!report) {
      this.bot.sendMessage(chatId, '❌ Gagal mengirim laporan. Silakan coba lagi.');
      return;
    }

    this.bot.sendMessage(chatId, 
      `✅ Laporan berhasil dikirim!\n\n` +
      `📋 User yang dilaporkan: ${partnerInfo.name}\n` +
      `🆔 ID Laporan: ${report.id}\n\n` +
      `🔍 Admin akan meninjau laporan Anda.`
    );

    // Check for auto-block
    const updatedPartnerInfo = dataService.getUser(partnerId);
    if (updatedPartnerInfo && updatedPartnerInfo.reportCount >= 3) {
      dataService.blockUser(partnerId);
      
      const endResult = matchingService.endChat(partnerId);
      if (endResult) {
        this.bot.sendMessage(partnerId, '🚫 Anda telah diblokir otomatis karena terlalu banyak laporan.');
        this.bot.sendMessage(userId, '⚠️ Pasangan Anda telah diblokir otomatis. Obrolan dihentikan.');
        
        this.showContinueOptions(userId, 'partner_blocked');
      }
      
      matchingService.removeFromQueue(partnerId);
    } else {
      this.sendReportToAdmin(report);
    }
  }

  handleContinueSearch(userId, chatId, messageId) {
    try {
      this.bot.deleteMessage(chatId, messageId);
    } catch (error) {
      // Message might be too old to delete
    }
    
    this.startSearching(userId, chatId);
  }

  handleViewProfile(userId, chatId) {
    if (!matchingService.isInChat(userId)) {
      this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan.');
      return;
    }

    const partnerId = matchingService.getPartner(userId);
    const partnerInfo = dataService.getUser(partnerId);

    if (!partnerInfo) {
      this.bot.sendMessage(chatId, '❌ Tidak dapat menemukan informasi pasangan Anda.');
      return;
    }

    this.showUserProfile(chatId, partnerInfo);
  }

  showUserProfile(chatId, userInfo) {
    const profileMessage = 
      `👤 **PROFIL PASANGAN**\n\n` +
      `📝 Nama: ${userInfo.name}\n` +
      `🏷️ Username: @${userInfo.username}\n` +
      `📅 Bergabung: ${helpers.formatDate(userInfo.joinDate)}\n` +
      `🌐 Bahasa: ${userInfo.language || 'Tidak diketahui'}\n\n` +
      `💡 *Informasi ini hanya ditampilkan selama obrolan berlangsung.*`;

    // Try to get user's profile photo
    this.bot.getUserProfilePhotos(userInfo.id, { limit: 1 })
      .then(photos => {
        if (photos.total_count > 0) {
          const fileId = photos.photos.file_id;
          this.bot.sendPhoto(chatId, fileId, {
            caption: profileMessage,
            parse_mode: 'Markdown'
          });
        } else {
          this.bot.sendMessage(chatId, profileMessage, {
            parse_mode: 'Markdown'
          });
        }
      })
      .catch(() => {
        this.bot.sendMessage(chatId, profileMessage, {
          parse_mode: 'Markdown'
        });
      });
  }

  showContinueOptions(userId, reason = 'ended') {
    const reasonMessages = {
      'ended': '💔 Obrolan telah berakhir.',
      'partner_left': '👋 Pasangan Anda telah meninggalkan obrolan.',
      'partner_blocked': '🚫 Pasangan Anda telah diblokir.',
      'user_stopped': '⏹️ Anda telah menghentikan obrolan.',
      'admin_ended': '⚠️ Obrolan dihentikan oleh admin.'
    };

    const message = reasonMessages[reason] || reasonMessages['ended'];
    const fullMessage = 
      `${message}\n\n` +
      `🤔 Apa yang ingin Anda lakukan selanjutnya?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔍 Cari Pasangan Baru', callback_data: 'start_cari' },
          { text: '🏠 Kembali ke Menu', callback_data: 'back_to_main_menu' }
        ],
        [
          { text: '❓ Bantuan', callback_data: 'show_help' }
        ]
      ]
    };

    this.bot.sendMessage(userId, fullMessage, {
      reply_markup: keyboard
    });
  }

  handleMessage(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(chatId, '🚫 Anda telah diblokir dari bot ini.');
      return;
    }

    // Check if user is in chat
    if (!matchingService.isInChat(userId)) {
      this.bot.sendMessage(chatId, 
        '❌ Anda tidak sedang dalam obrolan.\n\n' +
        'Gunakan /cari untuk mencari pasangan obrolan.'
      );
      return;
    }

    const partnerId = matchingService.getPartner(userId);
    if (!partnerId) {
      this.bot.sendMessage(chatId, '❌ Tidak dapat menemukan pasangan Anda.');
      return;
    }

    // Forward message to partner
    try {
      this.bot.sendMessage(partnerId, msg.text);
    } catch (error) {
      console.error('Error forwarding message:', error);
      this.bot.sendMessage(chatId, '❌ Gagal mengirim pesan ke pasangan Anda.');
    }
  }

  handleMediaMessage(msg, mediaType) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(chatId, '🚫 Anda telah diblokir dari bot ini.');
      return;
    }

    // Check if user is in chat
    if (!matchingService.isInChat(userId)) {
      this.bot.sendMessage(chatId, 
        '❌ Anda tidak sedang dalam obrolan.\n\n' +
        'Gunakan /cari untuk mencari pasangan obrolan.'
      );
      return;
    }

    const partnerId = matchingService.getPartner(userId);
    if (!partnerId) {
      this.bot.sendMessage(chatId, '❌ Tidak dapat menemukan pasangan Anda.');
      return;
    }

    // Forward media to partner
    try {
      switch (mediaType) {
        case 'photo':
          const photo = msg.photo[msg.photo.length - 1];
          this.bot.sendPhoto(partnerId, photo.file_id, {
            caption: msg.caption || ''
          });
          break;
        case 'video':
          this.bot.sendVideo(partnerId, msg.video.file_id, {
            caption: msg.caption || ''
          });
          break;
        case 'audio':
          this.bot.sendAudio(partnerId, msg.audio.file_id, {
            caption: msg.caption || ''
          });
          break;
        case 'voice':
          this.bot.sendVoice(partnerId, msg.voice.file_id);
          break;
        case 'document':
          this.bot.sendDocument(partnerId, msg.document.file_id, {
            caption: msg.caption || ''
          });
          break;
        case 'sticker':
          this.bot.sendSticker(partnerId, msg.sticker.file_id);
          break;
        case 'video_note':
          this.bot.sendVideoNote(partnerId, msg.video_note.file_id);
          break;
        case 'location':
          this.bot.sendLocation(partnerId, msg.location.latitude, msg.location.longitude);
          break;
        case 'contact':
          this.bot.sendContact(partnerId, msg.contact.phone_number, msg.contact.first_name, {
            last_name: msg.contact.last_name || ''
          });
          break;
        case 'animation':
          this.bot.sendAnimation(partnerId, msg.animation.file_id, {
            caption: msg.caption || ''
          });
          break;
        default:
          this.bot.sendMessage(chatId, '❌ Tipe media tidak didukung.');
          break;
      }
    } catch (error) {
      console.error(`Error forwarding ${mediaType}:`, error);
      this.bot.sendMessage(chatId, `❌ Gagal mengirim ${mediaType} ke pasangan Anda.`);
    }
  }

  // Method untuk mengirim laporan ke admin
  sendReportToAdmin(report) {
    if (!helpers.isValidAdminId()) {
      return;
    }

    const adminId = helpers.getAdminId();
    const reportMessage = 
      `🚨 **LAPORAN BARU**\n\n` +
      `👤 **Pelapor:**\n` +
      `├ Nama: ${report.reporter.name}\n` +
      `├ Username: @${report.reporter.username}\n` +
      `└ ID: \`${report.reporter.id}\`\n\n` +
      `🎯 **Dilaporkan:**\n` +
      `├ Nama: ${report.reported.name}\n` +
      `├ Username: @${report.reported.username}\n` +
      `└ ID: \`${report.reported.id}\`\n\n` +
      `📋 **Detail:**\n` +
      `├ ID Laporan: ${report.id}\n` +
      `├ Alasan: ${report.reason || 'Tidak disebutkan'}\n` +
      `├ Waktu: ${helpers.formatDateTime(report.timestamp)}\n` +
      `└ Status: ${report.status}\n\n` +
      `📊 **Statistik User:**\n` +
      `└ Total laporan: ${dataService.getUser(report.reported.id)?.reportCount || 0}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🚫 Block User', callback_data: `admin_block_${report.reported.id}_${report.id}` },
          { text: '✅ Ignore', callback_data: `admin_ignore_${report.id}` }
        ],
        [
          { text: '📋 View History', callback_data: `admin_history_${report.reported.id}` },
          { text: '⚠️ Send Warning', callback_data: `admin_warn_${report.reported.id}` }
        ]
      ]
    };

    this.bot.sendMessage(adminId, reportMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Method untuk menampilkan info ketika match ditemukan
  showMatchFound(userId, partnerInfo) {
    const matchMessage = 
      `🎉 **PASANGAN DITEMUKAN!**\n\n` +
      `👤 **Pasangan Anda:**\n` +
      `├ Nama: ${partnerInfo.name}\n` +
      `├ Username: @${partnerInfo.username}\n` +
      `└ Bergabung: ${helpers.formatDate(partnerInfo.joinDate)}\n\n` +
      `💬 **Obrolan dimulai sekarang!**\n` +
      `Kirim pesan, foto, video, atau media lainnya untuk memulai percakapan.\n\n` +
      `⚡ **Tip:** Gunakan tombol di bawah untuk aksi cepat!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '⏹️ Akhiri Obrolan', callback_data: 'end_chat' },
          { text: '🚨 Laporkan', callback_data: 'report_user' }
        ],
        [
          { text: '👤 Lihat Profil', callback_data: 'view_profile' }
        ]
      ]
    };

    this.bot.sendMessage(userId, matchMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
}

module.exports = UserHandlers;
