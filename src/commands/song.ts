import { CommandDefinition } from "../types";
import { getCurrentlyPlaying } from "../utils/spotifyAPI";
import { formatMMSS } from "../utils/formatUtils";
import { handleSpotifyError } from "../utils/spotifyErrorHandler";
import logger from "../utils/logger";

export const command: CommandDefinition = {
  name: "song",
  aliases: ["np", "spotify"],
  description: "Shows the currently playing Spotify track",
  access: { global: 1 },
  cooldown: { user: 10, channel: 5 },
  channels: ["lsco"],
  reply: true,
  execute: async () => {
    try {
      const track = await getCurrentlyPlaying();
      if (!track) return "Nothing is currently playing on Spotify.";

      const { songName, artists, durationMs, progressMs } = track;

      const progressFormatted = formatMMSS(progressMs);
      const durationFormatted = formatMMSS(durationMs);

      const response = `\'${songName}\' by ${artists} (${progressFormatted}/${durationFormatted})`;
      return response;
    } catch (err: any) {
      logger.error("Error fetching current track:", err);
      return handleSpotifyError(err);
    }
  },
};
