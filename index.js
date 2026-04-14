const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const prefix = "!";
const DATA_FILE = "timers.json";

// load saved timers
let timers = new Map();
if (fs.existsSync(DATA_FILE)) {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE));
  timers = new Map(raw);
}

function saveTimers() {
  fs.writeFileSync(DATA_FILE, JSON.stringify([...timers]));
}

function parseTime(str) {
  const match = str.match(/(\d+)([smhd])/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit];
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.split(" ");
  const command = args[0];

  if (command === "!csban") {
    const user = message.mentions.users.first();
    const timeArg = args[2];
    const reason = args.slice(3).join(" ") || "no reason";

    if (!user || !timeArg) {
      return message.reply("Usage: !ban @user 1h reason");
    }

    const duration = parseTime(timeArg);
    if (!duration) return message.reply("Invalid time (use s/m/h/d)");

    const endTime = Date.now() + duration;

    const msg = await message.channel.send(
      `⏳ ${user} unbanned in: ${formatTime(duration)}\nReason: ${reason}`
    );

    timers.set(user.id, {
      endTime,
      messageId: msg.id,
      channelId: msg.channel.id,
      reason
    });

    saveTimers();
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  setInterval(async () => {
    for (const [userId, data] of timers) {
      const channel = await client.channels.fetch(data.channelId).catch(() => null);
      if (!channel) continue;

      const msg = await channel.messages.fetch(data.messageId).catch(() => null);
      if (!msg) continue;

      const timeLeft = data.endTime - Date.now();

      if (timeLeft <= 0) {
        await msg.edit(`✅ <@${userId}> is now unbanned`);
        timers.delete(userId);
        saveTimers();
      } else {
        await msg.edit(
          `⏳ <@${userId}> unbanned in: ${formatTime(timeLeft)}\nReason: ${data.reason}`
        );
      }
    }
  }, 60000);
});

client.login("YOUR_BOT_TOKEN");
