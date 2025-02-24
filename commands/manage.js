const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Announcement } = require('../db');
const moment = require('moment');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage')
        .setDescription('Manage announcements')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all scheduled announcements'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel a scheduled announcement')
                .addStringOption(option =>
                    option.setName('id')
                    .setDescription('The ID of the announcement to cancel')
                    .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get detailed info about an announcement')
                .addStringOption(option =>
                    option.setName('id')
                    .setDescription('The announcement ID')
                    .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'list':
                return await handleList(interaction);
            case 'cancel':
                return await handleCancel(interaction);
            case 'info':
                return await handleInfo(interaction);
        }
    }
};

async function handleList(interaction) {
    const announcements = await Announcement.findAll({
        where: {
            guildId: interaction.guildId,
            status: 'scheduled'
        }
    });

    if (announcements.length === 0) {
        return await interaction.editReply({
            content: '📅 No scheduled announcements found.',
            flags: 64
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('📢 Scheduled Announcements')
        .setColor('#00ff00')
        .setDescription(announcements.map(a => {
            const channel = interaction.guild.channels.cache.get(a.channelId);
            return `**ID:** ${a.id}\n📝 ${a.message.substring(0, 50)}...\n📅 ${moment(a.scheduledTime).format('YYYY-MM-DD HH:mm')} UTC\n📌 ${channel ? channel.toString() : 'Unknown channel'}\n${a.repeat !== 'once' ? `🔄 Repeating: ${a.repeat}\n` : ''}\n`;
        }).join('\n'));

    await interaction.editReply({ embeds: [embed], flags: 64 });
}

async function handleCancel(interaction) {
    const id = interaction.options.getString('id');
    
    try {
        const announcement = await Announcement.findOne({
            where: {
                id,
                guildId: interaction.guildId,
                status: 'scheduled'
            }
        });

        if (!announcement) {
            return await interaction.editReply({
                content: '❌ Announcement not found or already completed.',
                flags: 64
            });
        }

        // Provjera je li korisnik vlasnik objave ili admin
        if (announcement.userId !== interaction.user.id && 
            !interaction.member.permissions.has('ADMINISTRATOR')) {
            return await interaction.editReply({
                content: '❌ You can only cancel your own announcements.',
                flags: 64
            });
        }

        // Otkaži timeout ako postoji
        const scheduled = interaction.client.scheduledAnnouncements.get(announcement.id);
        if (scheduled?.timeout) {
            clearTimeout(scheduled.timeout);
            interaction.client.scheduledAnnouncements.delete(announcement.id);
        }

        announcement.status = 'cancelled';
        await announcement.save();

        return await interaction.editReply({
            content: '✅ Announcement cancelled successfully.',
            flags: 64
        });
    } catch (error) {
        logger.error('Error cancelling announcement:', error);
        return await interaction.editReply({
            content: '❌ Failed to cancel announcement.',
            flags: 64
        });
    }
}

async function handleInfo(interaction) {
    const id = interaction.options.getString('id');
    
    try {
        const announcement = await Announcement.findOne({
            where: {
                id,
                guildId: interaction.guildId
            }
        });

        if (!announcement) {
            return await interaction.editReply({
                content: '❌ Announcement not found.',
                flags: 64
            });
        }

        const channel = interaction.guild.channels.cache.get(announcement.channelId);
        const user = await interaction.client.users.fetch(announcement.userId);
        
        const embed = new EmbedBuilder()
            .setTitle('📢 Announcement Details')
            .setColor(announcement.status === 'scheduled' ? '#00ff00' : '#ff0000')
            .addFields(
                { name: 'ID', value: announcement.id, inline: true },
                { name: 'Status', value: announcement.status, inline: true },
                { name: 'Created by', value: user ? user.tag : 'Unknown user', inline: true },
                { name: 'Channel', value: channel ? channel.toString() : 'Deleted channel', inline: true },
                { name: 'Scheduled for', value: moment(announcement.scheduledTime).format('YYYY-MM-DD HH:mm UTC'), inline: true },
                { name: 'Repeat', value: announcement.repeat, inline: true },
                { name: 'Message', value: announcement.message }
            )
            .setTimestamp();

        return await interaction.editReply({
            embeds: [embed],
            flags: 64
        });
    } catch (error) {
        logger.error('Error getting announcement info:', error);
        return await interaction.editReply({
            content: '❌ Failed to get announcement info.',
            flags: 64
        });
    }
} 