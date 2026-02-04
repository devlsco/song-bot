import { CommandDefinition } from "../types";
import { SpotifyAPI } from "../client/SpotifyAPI";
import { getSpotifyTrackUriFromInput } from "../utils/spotifyAPI";
import { handleSpotifyError } from "../utils/spotifyErrorHandler";
import logger from "../utils/logger";

export const command: CommandDefinition = {
  name: "queue",
  aliases: [],
  description: "Adds a song to the Spotify queue.",
  access: { global: 1 },
  cooldown: { user: 10, channel: 5 },
  channels: ["lsco"],
  reply: true,
  execute: async (context) => {
    const spotifyApi = new SpotifyAPI();
    const input = context.message.messageText.split(" ").slice(1).join(" ").trim();

    if (!input) {
      return "Please provide a song name or link for me to add to the queue.";
    }

    try {
      const trackInfo = await getSpotifyTrackUriFromInput(input);

      if (!trackInfo) {
        return "I couldn't find this song on Spotify.";
      }

      await spotifyApi.addTrackToQueue(trackInfo.uri);
      return `Added '${trackInfo.songName}' by ${trackInfo.artists} to the Spotify queue.`;
    } catch (err: any) {
      logger.error("Error adding track to queue:", err);
      return handleSpotifyError(err);
    }
  },
};
