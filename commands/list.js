const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Announcement } = require('../db');
const moment = require('moment');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Lists all active announcements'),

    async execute(interaction) {
        try {
            const announcements = await Announcement.findAll({
                where: {
                    guildId: interaction.guildId,
                    status: 'scheduled'
                }
            });

            if (!announcements.length) {
                return interaction.reply({
                    content: '📭 No active announcements found.',
                    ephemeral: true
                });
            }

            const listEmbed = new EmbedBuilder()
                .setTitle('📢 Active Announcements')
                .setDescription(`Found ${announcements.length} scheduled announcement(s)`)
                .setColor('#00ff00')
                .setTimestamp();

            for (const announcement of announcements) {
                const channel = await interaction.guild.channels.fetch(announcement.channelId);
                const scheduledTime = moment(announcement.scheduledTime);
                const timeUntil = scheduledTime.diff(moment.utc());
                
                if (timeUntil <= 0) continue; // Skip past announcements

                const timeLeft = scheduledTime.fromNow();
                const messagePreview = announcement.message.length > 100 
                    ? announcement.message.substring(0, 97) + '...' 
                    : announcement.message;

                listEmbed.addFields({
                    name: `📌 ${announcement.title}`,
                    value: 
                        `**Channel:** ${channel ? channel.toString() : 'Unknown'}\n` +
                        `**Time:** ${scheduledTime.format('YYYY-MM-DD HH:mm')} UTC (${timeLeft})\n` +
                        `**Repeat:** ${announcement.repeat === 'once' ? 'No' : `Every ${announcement.repeatHours} hours`}\n` +
                        `**Format:** ${announcement.useEmbed ? 'Embed' : 'Plain text'}\n` +
                        `**Preview:** ${messagePreview}`,
                    inline: false
                });
            }

            return interaction.reply({
                embeds: [listEmbed],
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error in list command:', error);
            return interaction.reply({
                content: '❌ Failed to fetch announcements.',
                ephemeral: true
            });
        }
    }
}; 