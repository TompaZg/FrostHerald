module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(message) {
        if (message.author.bot) return;
        if (!message.content.startsWith('!')) return;

        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (!message.client.commands.has(commandName)) return;

        try {
            await message.client.commands.get(commandName).execute(message, args);
        } catch (error) {
            console.error(error);
            await message.reply('There was an error executing that command!');
        }
    }
}; 