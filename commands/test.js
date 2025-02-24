const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test command'),
    async execute(interaction) {
        return interaction.editReply({
            content: 'Test command works! ✅',
            flags: ['Ephemeral']
        });
    }
}; 