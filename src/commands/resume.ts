import { CommandDefinition } from "../types";
import { SpotifyAPI } from "../client/SpotifyAPI";
import { handleSpotifyError } from "../utils/spotifyErrorHandler";
import logger from "../utils/logger";

export const command: CommandDefinition = {
  name: "resume",
  aliases: [],
  description: "Resumes Spotify playback.",
  access: { global: 1 },
  cooldown: { user: 5, channel: 5 },
  channels: ["lsco"],
  reply: true,
  execute: async () => {
    const spotifyApi = new SpotifyAPI();

    try {
      await spotifyApi.resumePlayback();
      return "Spotify playback resumed.";
    } catch (err: any) {
      logger.error("Error resuming playback:", err);
      return handleSpotifyError(err);
    }
  },
};
