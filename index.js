const { Client, Collection, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const moment = require('moment');
require('dotenv').config();
const { sequelize, Announcement } = require('./db');
const logger = require('./utils/logger');
const config = require('./config');

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    failIfNotExists: false,
    allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
});

client.announcements = new Collection();
client.scheduledAnnouncements = new Collection();

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// Event handler
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isButton()) {
            const announceData = client.announcements?.get(interaction.user.id);
            if (!announceData) {
                return await interaction.update({
                    content: '❌ Announcement data not found. Please create a new announcement.',
                    embeds: [],
                    components: [],
                });
            }

            try {
                switch (interaction.customId) {
                    case 'confirm_announce':
                        return await handleConfirmAnnouncement(interaction, announceData);
                    case 'cancel_announce':
                        return await handleCancelAnnouncement(interaction);
                    case 'preview_announce':
                        return await handlePreviewAnnouncement(interaction, announceData);
                    default:
                        return await interaction.update({
                            content: '❌ Unknown button interaction',
                            embeds: [],
                            components: [],
                        });
                }
            } catch (error) {
                logger.error('Button interaction error:', error);
                return await interaction.update({
                    content: '❌ Failed to process button interaction',
                    embeds: [],
                    components: [],
                });
            }
        }

        if (interaction.isStringSelectMenu()) {
            const announceData = client.announcements?.get(interaction.user.id);
            if (!announceData) {
                return await interaction.update({
                    content: '❌ Announcement data not found.',
                    components: [],
                    embeds: [],
                });
            }

            try {
                switch (interaction.customId) {
                    case 'date_select':
                        announceData.scheduledTime = moment.utc(interaction.values[0])
                            .hour(announceData.scheduledTime.hour())
                            .minute(announceData.scheduledTime.minute());
                        break;
                    case 'hour_select':
                        announceData.scheduledTime.hour(parseInt(interaction.values[0]));
                        break;
                    case 'minute_select':
                        announceData.scheduledTime.minute(parseInt(interaction.values[0]));
                        break;
                    case 'repeat_select':
                        const hours = parseInt(interaction.values[0]);
                        if (interaction.values[0] === 'none') {
                            announceData.repeat = 'once';
                            announceData.repeatHours = 0;
                        } else {
                            announceData.repeatHours = hours;
                            if (hours === 24) announceData.repeat = 'daily';
                            else if (hours === 168) announceData.repeat = 'weekly';
                            else announceData.repeat = `every_${hours}_hours`;
                        }
                        break;
                }

                const previewEmbed = new EmbedBuilder()
                    .setTitle('📢 Announcement Preview')
                    .setDescription(announceData.message)
                    .addFields(
                        { 
                            name: 'Schedule', 
                            value: `${announceData.scheduledTime.format('YYYY-MM-DD HH:mm')} UTC`, 
                            inline: true 
                        },
                        { 
                            name: 'Channel', 
                            value: `<#${announceData.channel}>`, 
                            inline: true 
                        },
                        { 
                            name: 'Repeat', 
                            value: announceData.repeatHours > 0 
                                ? `Every ${announceData.repeatHours} hours` 
                                : 'No repeat', 
                            inline: true 
                        }
                    )
                    .setColor('#00ff00')
                    .setTimestamp();

                await interaction.update({
                    embeds: [previewEmbed],
                    components: interaction.message.components
                });
            } catch (error) {
                logger.error('Error handling select menu:', error);
                await interaction.update({
                    content: '❌ Failed to update announcement settings.',
                    components: [],
                    embeds: [],
                });
            }
        }

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error('Command execution error:', error);
                if (!interaction.replied) {
                    await interaction.reply({
                        content: '❌ There was an error while executing this command.',
                        flags: 64
                    }).catch(() => {
                        logger.error('Failed to send error response');
                    });
                }
            }
        }
    } catch (error) {
        logger.error('Interaction error:', error);
    }
});

// Pomoćna funkcija za odgodu
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Dodajte funkciju za provjeru dozvola
function checkBotPermissions(channel, client) {
    const permissions = channel.permissionsFor(client.user);
    const requiredPermissions = [
        'ViewChannel',
        'SendMessages',
        'EmbedLinks'
    ];

    const missingPermissions = requiredPermissions.filter(perm => !permissions.has(perm));
    
    if (missingPermissions.length > 0) {
        console.log('Missing permissions:', {
            channel: channel.name,
            missingPermissions,
            currentPermissions: permissions.toArray()
        });
        return missingPermissions;
    }
    
    return null;
}

async function handleConfirmAnnouncement(interaction, announceData) {
    try {
        // Prvo deferujemo update
        await interaction.deferUpdate();

        const channel = await interaction.guild.channels.fetch(announceData.channel);
        
        // Provjera dozvola
        const missingPermissions = checkBotPermissions(channel, interaction.client);
        if (missingPermissions) {
            return await interaction.editReply({
                content: `❌ Missing permissions in ${channel.toString()}: ${missingPermissions.join(', ')}`,
                components: [],
                embeds: [],
            });
        }

        // Provjera limita objava
        const activeAnnouncements = await Announcement.count({
            where: {
                guildId: interaction.guildId,
                status: 'scheduled'
            }
        });

        if (activeAnnouncements >= config.defaultSettings.maxAnnouncements) {
            return await interaction.editReply({
                content: `❌ Maximum number of active announcements (${config.defaultSettings.maxAnnouncements}) reached.`,
                components: [],
                embeds: [],
            });
        }

        const now = moment.utc();
        const timeUntilAnnouncement = announceData.scheduledTime.diff(now);

        if (timeUntilAnnouncement <= 0) {
            return await interaction.editReply({
                content: '❌ Cannot schedule announcements in the past',
                components: [],
                embeds: [],
            });
        }

        // Spremi u bazu
        const announcement = await Announcement.create({
            id: `${interaction.user.id}-${Date.now()}`,
            userId: interaction.user.id,
            channelId: channel.id,
            guildId: interaction.guildId,
            message: announceData.message,
            scheduledTime: announceData.scheduledTime.toDate(),
            repeat: announceData.repeat,
            useEmbed: announceData.useEmbed,
            status: 'scheduled'
        });

        // Postavi timeout
        scheduleAnnouncement(announcement, channel);

        await interaction.editReply({
            content: `✅ Announcement scheduled for ${announceData.scheduledTime.format('YYYY-MM-DD HH:mm')} UTC in ${channel.toString()}${announceData.repeat !== 'once' ? ` (Repeating: ${announceData.repeat})` : ''}`,
            embeds: [],
            components: [],
        });

        logger.info('New announcement scheduled', {
            id: announcement.id,
            user: interaction.user.tag,
            guild: interaction.guild.name,
            channel: channel.name
        });

        client.announcements.delete(interaction.user.id);
    } catch (error) {
        logger.error('Error in handleConfirmAnnouncement:', error);
        try {
            await interaction.editReply({
                content: '❌ Failed to schedule announcement.',
                embeds: [],
                components: [],
            });
        } catch (followUpError) {
            logger.error('Failed to send error message:', followUpError);
        }
    }
}

async function handleCancelAnnouncement(interaction) {
    try {
        await interaction.deferUpdate();
        client.announcements.delete(interaction.user.id);
        await interaction.editReply({
            content: '❌ Announcement cancelled',
            embeds: [],
            components: [],
        });
    } catch (error) {
        logger.error('Error in handleCancelAnnouncement:', error);
    }
}

async function handlePreviewAnnouncement(interaction, announceData) {
    try {
        await interaction.deferUpdate();
        const channel = await interaction.guild.channels.fetch(announceData.channel);
        
        // Provjera dozvola
        const permissions = channel.permissionsFor(interaction.client.user);
        if (!permissions.has('SendMessages') || !permissions.has('ViewChannel')) {
            return await interaction.editReply({
                content: `❌ I don't have permission to send messages in ${channel.toString()}. Please check my permissions.`,
                components: [],
                embeds: [],
            });
        }

        const content = announceData.useEmbed ? {
            embeds: [
                new EmbedBuilder()
                    .setTitle('📢 Preview Announcement')
                    .setDescription(announceData.message)
                    .setColor('#00ff00')
                    .setTimestamp()
            ]
        } : {
            content: `**Preview:** ${announceData.message}`
        };

        await channel.send(content);
        await interaction.editReply({
            content: '✅ Preview sent!',
            components: [],
            embeds: [],
        });
    } catch (error) {
        logger.error('Error in handlePreviewAnnouncement:', error);
        try {
            await interaction.editReply({
                content: '❌ Failed to send preview. Please check bot permissions.',
                components: [],
                embeds: [],
            });
        } catch (followUpError) {
            logger.error('Failed to send error message:', followUpError);
        }
    }
}

// Pomoćne funkcije
function calculateNextTime(currentTime, repeatType) {
    const next = moment(currentTime);
    switch (repeatType) {
        case 'daily':
            return next.add(1, 'day');
        case 'weekly':
            return next.add(1, 'week');
        case 'monthly':
            return next.add(1, 'month');
        default:
            return null;
    }
}

async function sendAnnouncement(channel, scheduleInfo) {
    const content = scheduleInfo.useEmbed ? {
        embeds: [
            new EmbedBuilder()
                .setTitle(scheduleInfo.title || 'Announcement')
                .setDescription(scheduleInfo.message)
                .setColor('#00ff00')
                .setTimestamp()
        ]
    } : {
        content: `**${scheduleInfo.title || 'Announcement'}**\n\n${scheduleInfo.message}`
    };

    await channel.send(content);
    logger.info(`Announcement ${scheduleInfo.id} sent successfully`);
}

// Dodajte novu funkciju za zakazivanje objava
function scheduleAnnouncement(announcement, channel) {
    const now = moment.utc();
    const scheduledTime = moment(announcement.scheduledTime);
    const timeUntil = scheduledTime.diff(now);

    if (timeUntil <= 0) {
        logger.warn('Skipping past announcement', { id: announcement.id });
        return;
    }

    const timeout = setTimeout(async () => {
        try {
            await sendAnnouncement(channel, announcement);
            
            if (announcement.repeat !== 'once') {
                const nextTime = calculateNextTime(scheduledTime, announcement.repeat);
                if (nextTime) {
                    announcement.scheduledTime = nextTime.toDate();
                    await announcement.save();
                    scheduleAnnouncement(announcement, channel);
                }
            } else {
                announcement.status = 'completed';
                await announcement.save();
            }
        } catch (error) {
            logger.error('Failed to send announcement:', error);
            announcement.status = 'failed';
            await announcement.save();
        }
    }, timeUntil);

    client.scheduledAnnouncements.set(announcement.id, { 
        timeout, 
        announcement 
    });
}

client.once('ready', async () => {
    console.log(`Bot is ready! Logged in as ${client.user.tag}`);
    console.log('Guilds:', client.guilds.cache.map(g => g.name).join(', '));
    console.log('Registered commands:', Array.from(client.commands.keys()));
    
    // Očisti sve postojeće timeout-ove
    client.scheduledAnnouncements.forEach(schedule => {
        if (schedule.timeout) {
            clearTimeout(schedule.timeout);
        }
    });
    client.scheduledAnnouncements.clear();

    // Učitaj postojeće objave iz baze
    try {
        const announcements = await Announcement.findAll({
            where: {
                status: 'scheduled'
            }
        });

        logger.info(`Loading ${announcements.length} scheduled announcements`);

        for (const announcement of announcements) {
            try {
                const guild = client.guilds.cache.get(announcement.guildId);
                if (!guild) continue;

                const channel = await guild.channels.fetch(announcement.channelId);
                if (!channel) continue;

                scheduleAnnouncement(announcement, channel);
            } catch (error) {
                logger.error('Failed to load announcement:', {
                    id: announcement.id,
                    error: error.message
                });
            }
        }
    } catch (error) {
        logger.error('Failed to load announcements from database:', error);
    }
});

client.login(process.env.TOKEN);
