const { useMultiFileAuthState, makeWASocket } = require('@whiskeysockets/baileys');

// Fungsi untuk mendeteksi link
function containsLink(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g; // Regex untuk mendeteksi URL
    return urlRegex.test(text);
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== 401) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Bot berhasil terhubung!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.key.fromMe && m.type === 'notify') {
            const sender = message.key.remoteJid;
            const text = message.message.conversation || '';

            console.log(`Menerima pesan dari ${sender}: ${text}`);

            // Cek apakah pesan mengandung link
            if (containsLink(text)) {
                // Hapus pesan yang mengandung link
                await sock.sendMessage(sender, {
                    text: 'Pesan ini mengandung link yang tidak diperbolehkan!',
                });
                await sock.sendMessage(sender, {
                    delete: message.key,
                });
                console.log(`Pesan dari ${sender} mengandung link dan telah dihapus.`);
            }

            // Cek apakah pesan dimulai dengan ".h"
            if (text.startsWith('.h')) {
                if (message.key.remoteJid.endsWith('@g.us')) {
                    const groupMetadata = await sock.groupMetadata(sender);
                    const participants = groupMetadata.participants.map(p => p.id);
                    const customMessage = text.slice(3).trim();

                    if (customMessage) {
                        await sock.sendMessage(sender, {
                            text: `${customMessage}`,
                            mentions: participants,
                        });
                    } else {
                        await sock.sendMessage(sender, {
                            text: `Hai semua!`,
                            mentions: participants,
                        });
                    }
                }
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot().catch(err => console.error('Error:', err));
