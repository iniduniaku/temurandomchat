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
      this.showContinueOptions(chatId, 'queue_exit');
      return;
    }

    // End active chat
    const chatResult = matchingService.endChat(userId);
    if (chatResult) {
      this.bot.sendMessage(userId, '🔚 Obrolan telah dihentikan.');
      this.bot.sendMessage(chatResult.partnerId, '🔚 Pasangan Anda telah mengakhiri obrolan.');
      
      // Show continue options to both users
      this.showContinueOptions(userId, 'chat_ended');
      this.showContinueOptions(chatResult.partnerId, 'partner_left');
    } else {
      this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan atau antrian.');
    }
  }

  showContinueOptions(chatId, reason) {
    let message = '';
    
    switch (reason) {
      case 'queue_exit':
        message = '🚫 Anda telah keluar dari antrian.';
        break;
      case 'chat_ended':
        message = '🔚 Obrolan telah berakhir.';
        break;
      case 'partner_left':
        message = '🔚 Pasangan Anda telah mengakhiri obrolan.';
        break;
      case 'timeout':
        message = '⏰ Obrolan berakhir karena timeout.';
        break;
      case 'partner_blocked':
        message = '⚠️ Pasangan Anda telah diblokir. Obrolan dihentikan.';
        break;
      default:
        message = '🔚 Obrolan telah berakhir.';
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔍 Cari Pasangan Lagi', callback_data: 'find_new_partner' },
          { text: '🛑 Berhenti', callback_data: 'stop_chatting' }
        ]
      ]
    };

    this.bot.sendMessage(chatId, `${message}\n\nApa yang ingin Anda lakukan selanjutnya?`, {
      reply_markup: keyboard
    });
  }

  handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Answer callback query to remove loading state
    this.bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case 'find_new_partner':
        this.handleFindNewPartner(chatId, userId);
        break;
      case 'stop_chatting':
        this.handleStopChatting(chatId, userId);
        break;
    }
  }

  handleFindNewPartner(chatId, userId) {
    // Check if user is blocked
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(chatId, '❌ Anda telah diblokir dari menggunakan bot ini.');
      return;
    }

    // Add to queue
    if (matchingService.addToQueue(userId)) {
      const position = matchingService.getQueuePosition(userId);
      this.bot.sendMessage(chatId, 
        `🔍 Mencari pasangan baru...\n` +
        `⏳ Posisi dalam antrian: ${position}\n\n` +
        `Gunakan /stop untuk keluar dari antrian.`
      );

      // Try to match
      const match = matchingService.matchUsers();
      if (match) {
        this.handleMatch(match.user1Id, match.user2Id);
      }
    } else {
      this.bot.sendMessage(chatId, '⏳ Anda sudah dalam antrian mencari pasangan.');
    }
  }

  handleStopChatting(chatId, userId) {
    this.bot.sendMessage(chatId, 
      `👋 Terima kasih telah menggunakan bot ini!\n\n` +
      `Gunakan /start kapan saja untuk mulai obrolan lagi.\n` +
      `Gunakan /help untuk melihat bantuan.`
    );
  }

  async handleMatch(user1Id, user2Id) {
    try {
      const user1Info = dataService.getUser(user1Id);
      const user2Info = dataService.getUser(user2Id);

      // Get user photos
      const user1Photos = await this.getUserPhotos(user1Id);
      const user2Photos = await this.getUserPhotos(user2Id);

      // Send match notification to user1
      await this.sendMatchNotification(user1Id, user2Info, user2Photos);
      
      // Send match notification to user2
      await this.sendMatchNotification(user2Id, user1Info, user1Photos);

    } catch (error) {
      console.error('Error handling match:', error);
      
      // Fallback to text-only notification
      const user1Info = dataService.getUser(user1Id);
      const user2Info = dataService.getUser(user2Id);

      this.bot.sendMessage(user1Id, 
        `✅ Anda telah dicocokkan!\n\n` +
        `👤 Nama: ${user2Info.name}\n` +
        `🆔 Username: @${user2Info.username || 'Tidak ada'}\n\n` +
        `💬 Mulai obrolan! Gunakan /stop untuk mengakhiri atau /report untuk melaporkan user.`
      );

      this.bot.sendMessage(user2Id, 
        `✅ Anda telah dicocokkan!\n\n` +
        `👤 Nama: ${user1Info.name}\n` +
        `🆔 Username: @${user1Info.username || 'Tidak ada'}\n\n` +
        `💬 Mulai obrolan! Gunakan /stop untuk mengakhiri atau /report untuk melaporkan user.`
      );
    }
  }

  async getUserPhotos(userId) {
    try {
      const photos = await this.bot.getUserProfilePhotos(userId, { limit: 1 });
      return photos.photos && photos.photos.length > 0 ? photos.photos[0] : null;
    } catch (error) {
      console.error(`Error getting photos for user ${userId}:`, error);
      return null;
    }
  }

  async sendMatchNotification(userId, partnerInfo, partnerPhotos) {
    try {
      let message = `✅ PASANGAN DITEMUKAN!\n\n`;
      message += `👤 Nama: ${partnerInfo.name}\n`;
      message += `🆔 Username: @${partnerInfo.username || 'Tidak ada'}\n`;
      message += `🌐 Bahasa: ${partnerInfo.language || 'Tidak diketahui'}\n`;
      message += `📅 Bergabung: ${helpers.formatDate(partnerInfo.joinDate)}\n\n`;
      message += `💬 Mulai obrolan sekarang!\n`;
      message += `🔚 Gunakan /stop untuk mengakhiri\n`;
      message += `🚨 Gunakan /report untuk melaporkan`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔚 Akhiri Obrolan', callback_data: 'end_current_chat' },
            { text: '🚨 Laporkan User', callback_data: 'report_current_partner' }
          ]
        ]
      };

      if (partnerPhotos && partnerPhotos.length > 0) {
        // Send photo with caption
        const largestPhoto = partnerPhotos[partnerPhotos.length - 1]; // Get largest size
        await this.bot.sendPhoto(userId, largestPhoto.file_id, {
          caption: message,
          reply_markup: keyboard
        });
      } else {
        // Send text message with default avatar emoji
        message = `📷 Tidak ada foto profil\n\n` + message;
        await this.bot.sendMessage(userId, message, {
          reply_markup: keyboard
        });
      }
    } catch (error) {
      console.error('Error sending match notification:', error);
      
      // Fallback to simple text message
      const simpleMessage = 
        `✅ Anda telah dicocokkan dengan: ${partnerInfo.name}\n` +
        `💬 Mulai obrolan! Gunakan /stop untuk mengakhiri atau /report untuk melaporkan user.`;
      
      this.bot.sendMessage(userId, simpleMessage);
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
      
      // Update last active
      dataService.updateUser(userId, { lastActive: new Date().toISOString() });
      
      this.bot.sendMessage(partnerId, `${userInfo.name}: ${text}`);
    } else {
      this.bot.sendMessage(msg.chat.id, 
        '❌ Anda tidak sedang dalam obrolan.\n\n' +
        'Gunakan /start untuk mulai mencari pasangan obrolan.'
      );
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
    
    // Create admin report message with inline keyboard
    const reportMessage = 
      `🚨 LAPORAN PENGGUNA BARU\n\n` +
      `👤 Pelapor:\n` +
      `├ Nama: ${reporterInfo.name}\n` +
      `├ Username: @${reporterInfo.username}\n` +
      `└ ID: \`${reporterInfo.id}\`\n\n` +
      `🚫 Dilaporkan:\n` +
      `├ Nama: ${reportedUser.name}\n` +
      `├ Username: @${reportedUser.username}\n` +
      `├ ID: \`${reportedUser.id}\`\n` +
      `├ Total laporan: ${reportedUser.reportCount}\n` +
      `└ Waktu: ${helpers.formatTimeAgo(result.report.timestamp)}`;

    if (result.autoBlocked) {
      // User already auto-blocked
      const autoBlockMessage = reportMessage + `\n\n⚠️ USER TELAH OTOMATIS DIBLOKIR!`;
      
      this.bot.sendMessage(process.env.ADMIN_ID, autoBlockMessage, {
        parse_mode: 'Markdown'
      });

      // End chat and show continue options
      matchingService.endChat(userId);
      this.bot.sendMessage(partnerId, '🚫 Anda telah diblokir dari bot ini.');
      this.showContinueOptions(userId, 'partner_blocked');

    } else {
      // Show admin options for manual blocking
      const adminKeyboard = {
        inline_keyboard: [
          [
            { 
              text: '🚫 Block User', 
              callback_data: `admin_block_${reportedUser.id}_${result.report.id}` 
            },
            { 
              text: '✅ Ignore Report', 
              callback_data: `admin_ignore_${result.report.id}` 
            }
          ],
          [
            { 
              text: '📋 View User History', 
              callback_data: `admin_history_${reportedUser.id}` 
            }
          ]
        ]
      };

      this.bot.sendMessage(process.env.ADMIN_ID, reportMessage + `\n\n🔧 Pilih tindakan:`, {
        parse_mode: 'Markdown',
        reply_markup: adminKeyboard
      });
    }

    this.bot.sendMessage(chatId, '✅ Laporan telah dikirim ke admin. Terima kasih!');
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
      `3. Lihat foto dan informasi pasangan\n` +
      `4. Mulai obrolan dengan mengirim pesan\n` +
      `5. Gunakan /stop untuk mengakhiri obrolan\n` +
      `6. Pilih "Cari Pasangan Lagi" atau "Berhenti"\n` +
      `7. Gunakan /report jika ada masalah dengan pasangan\n\n` +
      `ℹ️ Bot ini menampilkan nama dan foto profil pengguna (tidak anonim)\n\n` +
      `📱 Fitur yang didukung:\n` +
      `• Kirim pesan teks, foto, video, audio\n` +
      `• Kirim sticker, voice note, dokumen\n` +
      `• Tombol quick action untuk kemudahan\n` +
      `• Sistem antrian dengan posisi real-time\n` +
      `• Auto-timeout untuk obrolan tidak aktif`;

    this.bot.sendMessage(chatId, helpMessage);
  }

  // Handle additional callback queries for inline buttons
  handleAdditionalCallbacks(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    this.bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case 'end_current_chat':
        if (matchingService.isInChat(userId)) {
          const chatResult = matchingService.endChat(userId);
          if (chatResult) {
            this.bot.sendMessage(userId, '🔚 Obrolan telah dihentikan.');
            this.bot.sendMessage(chatResult.partnerId, '🔚 Pasangan Anda telah mengakhiri obrolan.');
            
            this.showContinueOptions(userId, 'chat_ended');
            this.showContinueOptions(chatResult.partnerId, 'partner_left');
          }
        } else {
          this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan.');
        }
        break;
        
      case 'report_current_partner':
        if (matchingService.isInChat(userId)) {
          // Get user info from dataService instead of creating fake message
          const userInfo = dataService.getUser(userId);
          if (userInfo) {
            // Create a fake message object for handleReport
            const fakeMsg = {
              chat: { id: chatId },
              from: { 
                id: userId,
                first_name: userInfo.name,
                username: userInfo.username
              }
            };
            this.handleReport(fakeMsg);
          } else {
            this.bot.sendMessage(chatId, '❌ Tidak dapat memproses laporan.');
          }
        } else {
          this.bot.sendMessage(chatId, '❌ Anda tidak sedang dalam obrolan.');
        }
        break;
    }
  }

  // Handle media forwarding
  handleMediaMessage(msg, mediaType) {
    const userId = msg.from.id;
    
    if (dataService.isUserBlocked(userId)) {
      this.bot.sendMessage(msg.chat.id, '❌ Anda telah diblokir dari menggunakan bot ini.');
      return;
    }

    if (matchingService.isInChat(userId)) {
      const partnerId = matchingService.getPartner(userId);
      const userInfo = dataService.getUser(userId);
      
      // Update last active
      dataService.updateUser(userId, { lastActive: new Date().toISOString() });
      
      this.forwardMediaToPartner(msg, partnerId, userInfo, mediaType);
    } else {
      this.bot.sendMessage(msg.chat.id, '❌ Anda tidak sedang dalam obrolan.');
    }
  }

  forwardMediaToPartner(msg, partnerId, userInfo, mediaType) {
    let mediaOptions = {};
    let mediaId;
    
    try {
      switch (mediaType) {
        case 'photo':
          mediaId = msg.photo[msg.photo.length - 1].file_id;
          mediaOptions.caption = msg.caption ? `${userInfo.name}: ${msg.caption}` : `📷 Foto dari ${userInfo.name}`;
          this.bot.sendPhoto(partnerId, mediaId, mediaOptions);
          break;
          
        case 'document':
          mediaId = msg.document.file_id;
          mediaOptions.caption = `📎 Dokumen dari ${userInfo.name}`;
          this.bot.sendDocument(partnerId, mediaId, mediaOptions);
          break;
          
        case 'sticker':
          mediaId = msg.sticker.file_id;
          this.bot.sendSticker(partnerId, mediaId);
          break;
          
        case 'voice':
          mediaId = msg.voice.file_id;
          mediaOptions.caption = `🎤 Pesan suara dari ${userInfo.name}`;
          this.bot.sendVoice(partnerId, mediaId, mediaOptions);
          break;
          
        case 'video':
          mediaId = msg.video.file_id;
          mediaOptions.caption = msg.caption ? `${userInfo.name}: ${msg.caption}` : `🎥 Video dari ${userInfo.name}`;
          this.bot.sendVideo(partnerId, mediaId, mediaOptions);
          break;
          
        case 'audio':
          mediaId = msg.audio.file_id;
          mediaOptions.caption = `🎵 Audio dari ${userInfo.name}`;
          this.bot.sendAudio(partnerId, mediaId, mediaOptions);
          break;
          
        case 'video_note':
          mediaId = msg.video_note.file_id;
          this.bot.sendVideoNote(partnerId, mediaId);
          break;
          
        case 'location':
          this.bot.sendLocation(partnerId, msg.location.latitude, msg.location.longitude);
          this.bot.sendMessage(partnerId, `📍 Lokasi dari ${userInfo.name}`);
          break;
          
        case 'contact':
          this.bot.sendContact(partnerId, msg.contact.phone_number, msg.contact.first_name, {
            last_name: msg.contact.last_name
          });
          this.bot.sendMessage(partnerId, `👤 Kontak dari ${userInfo.name}`);
          break;
      }
    } catch (error) {
      console.error(`Error forwarding ${mediaType}:`, error);
      this.bot.sendMessage(partnerId, `❌ Gagal meneruskan ${mediaType} dari ${userInfo.name}`);
    }
  }
}

module.exports = UserHandlers;
