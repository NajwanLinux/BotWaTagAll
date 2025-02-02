const { useMultiFileAuthState, makeWASocket } = require('@whiskeysockets/baileys');

async function startBot() {
    // Gunakan multi-file auth state untuk menyimpan session
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // Buat socket WhatsApp
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Tampilkan QR code di terminal
    });

    // Event ketika terhubung
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            // Jika terputus, coba sambungkan kembali
            if (lastDisconnect?.error?.output?.statusCode !== 401) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Bot berhasil terhubung!');
        }
    });

    // Event ketika menerima pesan
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.key.fromMe && m.type === 'notify') {
            const sender = message.key.remoteJid; // ID pengirim
            const text = message.message.conversation || ''; // Isi pesan

            console.log(`Menerima pesan dari ${sender}: ${text}`);

            // Cek apakah pesan dimulai dengan ".h"
            if (text.startsWith('.h')) {
                if (message.key.remoteJid.endsWith('@g.us')) { // Cek apakah pesan berasal dari grup
                    const groupMetadata = await sock.groupMetadata(sender);
                    const participants = groupMetadata.participants.map(p => p.id);

                    // Ambil teks setelah ".h"
                    const customMessage = text.slice(3).trim(); // Hapus ".h " dari awal pesan

                    // Jika ada teks setelah ".h", gabungkan dengan mention
                    if (customMessage) {
                        const mentionText = participants.map(id => `@${id.split('@')[0]}`).join(' ');
                        await sock.sendMessage(sender, { 
                            text: `${customMessage} ${mentionText}`, 
                            mentions: participants 
                        });
                    } else {
                        // Jika tidak ada teks setelah ".h", kirim pesan default
                        const mentionText = participants.map(id => `@${id.split('@')[0]}`).join(' ');
                        await sock.sendMessage(sender, { 
                            text: `Hai semua! ${mentionText}`, 
                            mentions: participants 
                        });
                    }
                }
            }
        }
    });

    // Simpan credentials ketika ada perubahan
    sock.ev.on('creds.update', saveCreds);
}

startBot().catch(err => console.error('Error:', err));