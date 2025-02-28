const { useMultiFileAuthState, makeWASocket } = require('@whiskeysockets/baileys');

function containsLink(text) {
    const urlRegex = /(https?:\/\/|www\.)[^\s]+/gi; 
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
            const text = message.message.conversation || 
                         message.message.extendedTextMessage?.text || 
                         ''; 

            console.log(`Pesan diterima dari ${sender}: ${text}`);

            if (containsLink(text)) {
                const groupMetadata = await sock.groupMetadata(sender).catch(() => null);
                await new Promise(resolve => setTimeout(resolve, 2000)); 
                const updatedGroupMetadata = await sock.groupMetadata(sender);
                
                const botID = sock.user.id.replace(/:[0-9]+/g, ''); 
                const botAdmin = updatedGroupMetadata?.participants.find(p => p.id.replace(/:[0-9]+/g, '') === botID)?.admin;
                
                console.log('Bot ID:', botID);
                console.log('Grup ID:', sender);
                console.log('Daftar Peserta Grup:', updatedGroupMetadata?.participants.map(p => p.id));
                console.log('Bot Admin Status:', botAdmin);
                
                if (botAdmin) {
                    await sock.sendMessage(sender, {
                        text: 'Pesan ini mengandung link yang tidak diperbolehkan!',
                    });
                    await sock.sendMessage(sender, {
                        delete: message.key,
                    });
                    console.log(`Pesan dari ${sender} mengandung link dan telah dihapus.`);
                } else {
                    console.log(`⚠️ Bot bukan admin atau WhatsApp API tidak mengembalikan status admin dengan benar!`);
                }
            }

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

            if (text === '.close') {
                const groupMetadata = await sock.groupMetadata(sender);
                if (groupMetadata.participants.find(p => p.id === message.key.participant && p.admin)) {
                    await sock.groupSettingUpdate(sender, 'announcement');
                    await sock.sendMessage(sender, { text: 'Grup telah ditutup, hanya admin yang dapat mengirim pesan.' });
                } else {
                    await sock.sendMessage(sender, { text: 'Hanya admin yang dapat menutup grup.' });
                }
            }

            if (text === '.open') {
                const groupMetadata = await sock.groupMetadata(sender);
                if (groupMetadata.participants.find(p => p.id === message.key.participant && p.admin)) {
                    await sock.groupSettingUpdate(sender, 'not_announcement');
                    await sock.sendMessage(sender, { text: 'Grup telah dibuka, semua anggota dapat mengirim pesan.' });
                } else {
                    await sock.sendMessage(sender, { text: 'Hanya admin yang dapat membuka grup.' });
                }
            }

            if (text === '.info') {
                await sock.sendMessage(sender, {
                    text: '✨ *DARX BOT* ✨\n\n📋 _LIST FEATURE_\n✅ Hide Tag\n✅ Anti Link\n✅ Open Grup\n✅ Close Grup\n\n🤖 Bot by Najwan'
                });
            }

            // Fitur Grename
            if (text.startsWith('.Grename ')) {
                const newGroupName = text.slice(9).trim(); // Ambil nama grup baru setelah .Grename
                if (newGroupName) {
                    const groupMetadata = await sock.groupMetadata(sender);
                    if (groupMetadata.participants.find(p => p.id === message.key.participant && p.admin)) {
                        await sock.groupUpdateSubject(sender, newGroupName); // Ganti nama grup
                        await sock.sendMessage(sender, { text: `Nama grup berhasil diubah menjadi: ${newGroupName}` });
                    } else {
                        await sock.sendMessage(sender, { text: 'Hanya admin yang dapat mengganti nama grup.' });
                    }
                } else {
                    await sock.sendMessage(sender, { text: 'Mohon masukkan nama grup baru setelah perintah .Grename' });
                }
            }

        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot().catch(err => console.error('Error:', err));
