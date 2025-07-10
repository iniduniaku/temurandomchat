const dataService = require('../services/dataService');
const matchingService = require('../services/matchingService');
const reportService = require('../services/reportService');
const helpers = require('../utils/helpers');

class UserHandlers {
  constructor(bot) {
    this.bot = bot;
  }

  // Welcome message saat /start (tidak langsung mencari)
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

    // Show welcome message instead of starting search
    this.showWelcomeMessage(chatId);
  }

  showWelcomeMessage(chatId) {
    const welcomeMessage = 
      `🤖 **SELAMAT DATANG DI TEMU!**\n\n` +
      `✨ **Fitur Utama:**\n` +
      `• 💬 Obrolan random dengan pengguna lain\n` +
      `• 🖼️ Berbagi foto, video, audio, sticker, dan media lainnya\n` +
      `• 👤 Lihat foto profil dan info pengguna\n` +
      `• ⚡ Interface yang mudah dengan tombol cepat\n` +
      `• 🛡️ Sistem laporan untuk keamanan\n\n` +
      `📋 **Cara Menggunakan:**\n` +
      `1. Tekan tombol "🔍 Mulai Cari Pasangan" di bawah\n` +
      `2. Tunggu hingga menemukan pasangan obrolan\n` +
      `3. Mulai mengobrol dengan bebas!\n` +
      `4. Gunakan tombol "⏹️ Akhiri Obrolan" jika ingin berhenti\n\n` +
      `⚠️ **Aturan Penting:**\n` +
      `• Bersikap sopan dan menghormati pengguna lain\n` +
      `• Tidak mengirim konten yang tidak pantas\n` +
      `• Gunakan fitur laporan jika ada masalah\n\n` +
      `🚀 **Siap untuk memulai obrolan random?**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔍 Mulai Cari Pasangan', callback_data: 'start_searching' }
        ],
        [
          { text: '❓ Bantuan', callback_data: 'show_help' },
          { text: '📊 Info Bot', callback_data: 'show_info' }
        ]
      ]
    };

    this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Method untuk memulai pencarian (dipindahkan dari handleStart yang lama)
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
      const result = matchingService.endChat(userId, 'user_stopped');
      
      if (result) {
        // Notify partner
        this.bot.sendMessage(result.partnerId, '👋 Pasangan Anda telah meninggalkan obrolan.');
        this.showContinueOptions(result.partnerId, 'partner_left');
        
        // Notify user
        this.bot.sendMessage(chatId, '⏹️ Anda telah menghentikan obrolan.');
        this.showContinueOptions(userId, 'user_stopped');
      }
      return;
    }

    // Check if user is in queue
    if (matchingService.isInQueue(userId)) {
      matchingService.removeFromQueue(userId);
      this.bot.sendMessage(chatId, '❌ Pencarian dibatalkan.');
      this.showWelcomeMessage(chatId);
      return;
    }

    // User is not in chat or queue
    this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan atau pencarian.');
    this.showWelcomeMessage(chatId);
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
      this.bot.sendMessage(chatId, '❌ Tidak dapat menemukan informasi pasangan.');
      return;
    }

    // Add report
    const report = dataService.addReport(userInfo, partnerInfo);
    
    if (report) {
      // End the chat
      matchingService.endChat(userId, 'reported');
      
      // Notify users
      this.bot.sendMessage(chatId, 
        `✅ Laporan telah dikirim!\n\n` +
        `👮 Admin akan meninjau laporan Anda.\n` +
        `🔒 Obrolan telah dihentikan untuk keamanan.`
      );
      
      this.bot.sendMessage(partnerId, 
        `⚠️ Anda telah dilaporkan oleh pasangan.\n` +
        `🔒 Obrolan dihentikan untuk investigasi.`
      );

      // Send notification to admin
      reportService.notifyAdminNewReport(this.bot, report);

      // Check if user should be auto-blocked
      const updatedPartnerInfo = dataService.getUser(partnerId);
      if (updatedPartnerInfo && updatedPartnerInfo.reportCount >= 3) {
        dataService.blockUser(partnerId);
        this.bot.sendMessage(partnerId, 
          `🚫 Akun Anda telah diblokir otomatis karena menerima 3+ laporan.\n\n` +
          `📞 Hubungi admin jika Anda merasa ini adalah kesalahan.`
        );
        
        // Notify admin about auto-block
        const config = require('../../config/config');
        this.bot.sendMessage(config.telegram.adminId, 
          `🚫 AUTO-BLOCK TRIGGERED\n\n` +
          `User: ${updatedPartnerInfo.name} (ID: ${partnerId})\n` +
          `Reports: ${updatedPartnerInfo.reportCount}\n` +
          `Reason: 3+ reports received`
        );
      }

      // Show continue options
      this.showContinueOptions(userId, 'ended');
      this.showContinueOptions(partnerId, 'ended');
    } else {
      this.bot.sendMessage(chatId, '❌ Gagal mengirim laporan. Silakan coba lagi.');
    }
  }

  handleHelp(msg) {
    const chatId = msg.chat.id;
    
    const helpMessage = 
      `❓ **BANTUAN TEMU**\n\n` +
      `🔧 **Perintah Utama:**\n` +
      `/start - Tampilkan menu utama\n` +
      `/stop - Keluar dari antrian/obrolan\n` +
      `/report - Laporkan pengguna bermasalah\n` +
      `/help - Tampilkan bantuan ini\n\n` +
      `💬 **Dalam Obrolan:**\n` +
      `• Kirim pesan teks, foto, video, audio, sticker\n` +
      `• Gunakan tombol "⏹️ Akhiri Obrolan" untuk berhenti\n` +
      `• Pilih "🔍 Cari Lagi" untuk pasangan baru\n\n` +
      `🛡️ **Keamanan:**\n` +
      `• Gunakan /report jika ada masalah\n` +
      `• Block otomatis setelah 3+ laporan\n` +
      `• Admin akan menindaklanjuti laporan\n\n` +
      `⚡ **Tips:**\n` +
      `• Bersikap sopan untuk pengalaman terbaik\n` +
      `• Gunakan fitur inline keyboard untuk navigasi cepat`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🏠 Menu Utama', callback_data: 'back_to_main_menu' }]
      ]
    };

    this.bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Handle callback queries
  handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Handle welcome callbacks
    if (['start_searching', 'show_help', 'show_info', 'back_to_welcome', 'back_to_main_menu'].includes(data)) {
      this.handleWelcomeCallback(callbackQuery);
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
      case 'find_new':
        this.handleFindNew(userId, chatId, callbackQuery.message.message_id);
        break;
      case 'show_profile':
        this.handleShowProfile(userId, chatId);
        break;
      default:
        this.bot.sendMessage(chatId, '❌ Aksi tidak dikenali.');
    }
  }

  // Handle welcome callback queries
  handleWelcomeCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    this.bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case 'start_searching':
        // Hapus welcome message
        this.bot.deleteMessage(chatId, callbackQuery.message.message_id);
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
      case 'back_to_main_menu':
        this.backToWelcome(chatId, callbackQuery.message.message_id);
        break;
    }
  }

  // Method untuk menampilkan bantuan dari callback
  handleHelpFromCallback(chatId, messageId) {
    const helpMessage = 
      `❓ **BANTUAN TEMU**\n\n` +
      `🔧 **Perintah Utama:**\n` +
      `/start - Tampilkan menu utama\n` +
      `/stop - Keluar dari antrian/obrolan\n` +
      `/report - Laporkan pengguna bermasalah\n` +
      `/help - Tampilkan bantuan ini\n\n` +
      `💬 **Dalam Obrolan:**\n` +
      `• Kirim pesan teks, foto, video, audio, sticker\n` +
      `• Gunakan tombol "⏹️ Akhiri Obrolan" untuk berhenti\n` +
      `• Pilih "🔍 Cari Lagi" untuk pasangan baru\n\n` +
      `🛡️ **Keamanan:**\n` +
      `• Gunakan /report jika ada masalah\n` +
      `• Block otomatis setelah 3+ laporan\n` +
      `• Admin akan menindaklanjuti laporan\n\n` +
      `⚡ **Tips:**\n` +
      `• Bersikap sopan untuk pengalaman terbaik\n` +
      `• Gunakan fitur inline keyboard untuk navigasi cepat`;

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

  // Method untuk menampilkan info bot
  showBotInfo(chatId, messageId) {
    const stats = dataService.getStats();
    const matchingStats = matchingService.getStats();

    const infoMessage = 
      `📊 **INFORMASI BOT**\n\n` +
      `🤖 **Temu v2.0**\n` +
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

  // Method untuk kembali ke welcome message
  backToWelcome(chatId, messageId) {
    const welcomeMessage = 
      `🤖 **SELAMAT DATANG DI TEMU!**\n\n` +
      `✨ **Fitur Utama:**\n` +
      `• 💬 Obrolan random dengan pengguna lain\n` +
      `• 🖼️ Berbagi foto, video, audio, sticker, dan media lainnya\n` +
      `• 👤 Lihat foto profil dan info pengguna\n` +
      `• ⚡ Interface yang mudah dengan tombol cepat\n` +
      `• 🛡️ Sistem laporan untuk keamanan\n\n` +
      `📋 **Cara Menggunakan:**\n` +
      `1. Tekan tombol "🔍 Mulai Cari Pasangan" di bawah\n` +
      `2. Tunggu hingga menemukan pasangan obrolan\n` +
      `3. Mulai mengobrol dengan bebas!\n` +
      `4. Gunakan tombol "⏹️ Akhiri Obrolan" jika ingin berhenti\n\n` +
      `⚠️ **Aturan Penting:**\n` +
      `• Bersikap sopan dan menghormati pengguna lain\n` +
      `• Tidak mengirim konten yang tidak pantas\n` +
      `• Gunakan fitur laporan jika ada masalah\n\n` +
      `🚀 **Siap untuk memulai obrolan random?**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔍 Mulai Cari Pasangan', callback_data: 'start_searching' }
        ],
        [
          { text: '❓ Bantuan', callback_data: 'show_help' },
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
    if (matchingService.isInQueue(userId)) {
      matchingService.removeFromQueue(userId);
      
      this.bot.editMessageText('❌ Pencarian dibatalkan.', {
        chat_id: chatId,
        message_id: messageId
      });

      // Show welcome message after a short delay
      setTimeout(() => {
        this.showWelcomeMessage(chatId);
      }, 1000);
    } else {
      this.bot.editMessageText('❌ Anda tidak sedang dalam pencarian.', {
        chat_id: chatId,
        message_id: messageId
      });
    }
  }

  handleEndChat(userId, chatId) {
    if (matchingService.isInChat(userId)) {
      const result = matchingService.endChat(userId, 'user_ended');
      
      if (result) {
        // Notify partner
        this.bot.sendMessage(result.partnerId, '💔 Pasangan Anda telah mengakhiri obrolan.');
        this.showContinueOptions(result.partnerId, 'partner_left');
        
        // Notify user
        this.bot.sendMessage(chatId, '⏹️ Obrolan telah dihentikan.');
        this.showContinueOptions(userId, 'ended');
      }
    } else {
      this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan.');
    }
  }

  handleFindNew(userId, chatId, messageId) {
    // Delete the continue options message
    this.bot.deleteMessage(chatId, messageId);
    
    // Start new search
    this.startSearching(userId, chatId);
  }

  handleShowProfile(userId, chatId) {
    if (matchingService.isInChat(userId)) {
      const partnerId = matchingService.getPartner(userId);
      const partnerInfo = dataService.getUser(partnerId);
      
      if (partnerInfo) {
        this.sendUserProfile(chatId, partnerInfo);
      } else {
        this.bot.sendMessage(chatId, '❌ Tidak dapat mengambil profil pasangan.');
      }
    } else {
      this.bot.sendMessage(chatId, '❌ Anda harus sedang dalam obrolan untuk melihat profil.');
    }
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
          { text: '🔍 Cari Pasangan Baru', callback_data: 'start_searching' },
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

  // Handle chat matched
  onChatMatched(user1Id, user2Id) {
    const user1Info = dataService.getUser(user1Id);
    const user2Info = dataService.getUser(user2Id);

    if (!user1Info || !user2Info) {
      console.error('User info not found for matched users');
      return;
    }

    // Send match notification to both users
    this.sendMatchNotification(user1Id, user2Info);
    this.sendMatchNotification(user2Id, user1Info);
  }

  sendMatchNotification(userId, partnerInfo) {
    const matchMessage = 
      `🎉 **PASANGAN DITEMUKAN!**\n\n` +
      `👤 **Profil Pasangan:**\n` +
      `• Nama: ${partnerInfo.name}\n` +
      `• Username: @${partnerInfo.username}\n` +
      `• Bergabung: ${helpers.formatDate(partnerInfo.joinDate)}\n\n` +
      `💬 Anda sekarang terhubung! Mulai percakapan dengan mengirim pesan.\n\n` +
      `💡 **Tips:** Bersikap sopan dan nikmati obrolan Anda!`;

    const chatKeyboard = {
      inline_keyboard: [
        [
          { text: '👤 Lihat Profil', callback_data: 'show_profile' },
          { text: '⏹️ Akhiri Obrolan', callback_data: 'end_chat' }
        ]
      ]
    };

    this.bot.sendMessage(userId, matchMessage, {
      parse_mode: 'Markdown',
      reply_markup: chatKeyboard
    });

    // Try to send partner's profile photo
    this.sendPartnerProfilePhoto(userId, partnerInfo.id);
  }

  async sendPartnerProfilePhoto(userId, partnerId) {
    try {
      const photos = await this.bot.getUserProfilePhotos(partnerId, { limit: 1 });
      
      if (photos.photos && photos.photos.length > 0) {
        const photo = photos.photos[0];
        const fileId = photo[photo.length - 1].file_id; // Get highest resolution
        
        await this.bot.sendPhoto(userId, fileId, {
          caption: '📸 Foto profil pasangan Anda'
        });
      }
    } catch (error) {
      console.log('Could not send partner profile photo:', error.message);
      // Not critical, continue without photo
    }
  }

  sendUserProfile(chatId, userInfo) {
    const profileMessage = 
      `👤 **PROFIL PENGGUNA**\n\n` +
      `• Nama: ${userInfo.name}\n` +
      `• Username: @${userInfo.username}\n` +
      `• Bergabung: ${helpers.formatDate(userInfo.joinDate)}\n` +
      `• Terakhir aktif: ${helpers.formatTimeAgo(userInfo.lastActive || userInfo.joinDate)}\n` +
      `• Bahasa: ${userInfo.language || 'Tidak diketahui'}`;

    this.bot.sendMessage(chatId, profileMessage, {
      parse_mode: 'Markdown'
    });

    // Try to send user's profile photo
    this.sendPartnerProfilePhoto(chatId, userInfo.id);
  }

  // Handle regular text messages
  handleMessage(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(chatId, '🚫 Anda telah diblokir dari bot ini.');
      return;
    }

    // Update user last active
    dataService.updateUser(userId, { lastActive: new Date().toISOString() });

    if (matchingService.isInChat(userId)) {
      const partnerId = matchingService.getPartner(userId);
      
      if (partnerId) {
        // Forward message to partner
        this.bot.sendMessage(partnerId, msg.text);
      }
    } else {
      // User is not in chat, show help
      this.bot.sendMessage(chatId, 
        `❌ Anda tidak sedang dalam obrolan.\n\n` +
        `Gunakan /start untuk memulai pencarian pasangan.`
      );
    }
  }

  // Handle media messages (photo, video, audio, etc.)
  handleMediaMessage(msg, mediaType) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(chatId, '🚫 Anda telah diblokir dari bot ini.');
      return;
    }

    // Update user last active
    dataService.updateUser(userId, { lastActive: new Date().toISOString() });

    if (matchingService.isInChat(userId)) {
      const partnerId = matchingService.getPartner(userId);
      
      if (partnerId) {
        // Forward media to partner based on type
        this.forwardMediaMessage(msg, partnerId, mediaType);
      }
    } else {
      this.bot.sendMessage(chatId, 
        `❌ Anda tidak sedang dalam obrolan.\n\n` +
        `Gunakan /start untuk memulai pencarian pasangan.`
      );
    }
  }

  forwardMediaMessage(msg, partnerId, mediaType) {
    try {
      switch (mediaType) {
        case 'photo':
          const photo = msg.photo[msg.photo.length - 1]; // Get highest resolution
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

        case 'animation':
          this.bot.sendAnimation(partnerId, msg.animation.file_id, {
            caption: msg.caption || ''
          });
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

        default:
          console.log(`Unknown media type: ${mediaType}`);
      }
    } catch (error) {
      console.error(`Error forwarding ${mediaType}:`, error);
    }
  }
}

module.exports = UserHandlers;
