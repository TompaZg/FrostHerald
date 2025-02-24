const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Debug command for testing'),
    async execute(interaction) {
        try {
            const debugInfo = {
                bot: {
                    username: interaction.client.user.tag,
                    status: interaction.client.presence.status,
                    uptime: Math.floor(interaction.client.uptime / 1000) + ' seconds'
                },
                guild: {
                    name: interaction.guild.name,
                    memberCount: interaction.guild.memberCount,
                    channelCount: interaction.guild.channels.cache.size
                },
                announcements: {
                    pending: interaction.client.announcements?.size || 0,
                    scheduled: interaction.client.scheduledAnnouncements?.size || 0
                }
            };

            return await interaction.editReply({
                content: '```json\n' + JSON.stringify(debugInfo, null, 2) + '\n```',
                flags: 64
            });
        } catch (error) {
            console.error('Debug command error:', error);
            return await interaction.editReply({
                content: '❌ Error executing debug command',
                flags: 64
            });
        }
    }
}; 