const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const moment = require('moment');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Create an announcement')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The announcement message')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Where to send the announcement')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('time')
                .setDescription('When to send (format: YYYY-MM-DD HH:mm) in UTC')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Announcement title (default: "Announcement")')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('repeat_hours')
                .setDescription('Repeat every X hours (0 for no repeat)')
                .setMinValue(0)
                .setMaxValue(720))
        .addBooleanOption(option =>
            option.setName('embed')
                .setDescription('Send as an embed? (default: true)')
                .setRequired(false)),

    async execute(interaction) {
        // Get all options at once
        const options = {
            message: interaction.options.getString('message'),
            channel: interaction.options.getChannel('channel'),
            timeStr: interaction.options.getString('time'),
            title: interaction.options.getString('title') ?? 'Announcement',
            repeatHours: interaction.options.getInteger('repeat_hours') ?? 0,
            useEmbed: interaction.options.getBoolean('embed') ?? true
        };

        // Validate time
        const scheduledTime = moment.utc(options.timeStr, 'YYYY-MM-DD HH:mm');
        if (!scheduledTime.isValid()) {
            return interaction.reply({
                content: '❌ Invalid time format. Please use YYYY-MM-DD HH:mm (UTC)',
                ephemeral: true
            });
        }

        if (scheduledTime.isBefore(moment.utc())) {
            return interaction.reply({
                content: '❌ Cannot schedule announcements in the past',
                ephemeral: true
            });
        }

        try {
            // Store announcement data
            if (!interaction.client.announcements) {
                interaction.client.announcements = new Map();
            }
            
            const announceData = {
                message: options.message,
                scheduledTime,
                channel: options.channel.id,
                title: options.title,
                repeat: options.repeatHours > 0 ? `every_${options.repeatHours}_hours` : 'once',
                repeatHours: options.repeatHours,
                useEmbed: options.useEmbed
            };
            
            interaction.client.announcements.set(interaction.user.id, announceData);

            const previewEmbed = new EmbedBuilder()
                .setTitle('📢 Announcement Preview')
                .setDescription(options.message)
                .addFields(
                    { 
                        name: 'Title',
                        value: options.title,
                        inline: true
                    },
                    { 
                        name: 'Schedule', 
                        value: `${scheduledTime.format('YYYY-MM-DD HH:mm')} UTC`, 
                        inline: true 
                    },
                    { 
                        name: 'Channel', 
                        value: options.channel.toString(), 
                        inline: true 
                    },
                    { 
                        name: 'Format',
                        value: options.useEmbed ? 'Embed' : 'Plain text',
                        inline: true
                    },
                    { 
                        name: 'Repeat', 
                        value: options.repeatHours > 0 ? `Every ${options.repeatHours} hours` : 'No repeat', 
                        inline: true 
                    }
                )
                .setColor('#00ff00')
                .setTimestamp();

            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_announce')
                        .setLabel('Confirm')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancel_announce')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('preview_announce')
                        .setLabel('Send Preview')
                        .setStyle(ButtonStyle.Primary)
                );

            return interaction.reply({
                content: 'Please review your announcement:',
                embeds: [previewEmbed],
                components: [actionRow],
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error in announce command:', error);
            return interaction.reply({
                content: '❌ Failed to create announcement.',
                ephemeral: true
            });
        }
    }
}; 