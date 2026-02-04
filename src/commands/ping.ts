import { CommandDefinition, CommandContext } from "../types";
import humanizeDuration from "humanize-duration";

const humanizer = humanizeDuration.humanizer({
  language: "en",
  units: ["d", "h", "m", "s"],
  largest: 3,
  round: true,
  spacer: "",
  delimiter: " ",
  languages: {
    en: {
      d: () => "d",
      h: () => "h",
      m: () => "m",
      s: () => "s",
    },
  },
});

const botStartedAt = new Date();

export const command: CommandDefinition = {
  name: "ping",
  aliases: [],
  description: "Checks if the bot is online",
  access: {},
  cooldown: {
    user: 5,
  },
  reply: true,
  execute: async () => {
    const uptime = humanizer(Date.now() - botStartedAt.getTime());

    let output = `Pong! Uptime: ${uptime} `;
    return output;
  },
};
