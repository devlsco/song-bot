import { CommandDefinition } from "../types";
import { SpotifyAPI } from "../client/SpotifyAPI";
import { getSpotifyTrackUriFromInput } from "../utils/spotifyAPI";
import { handleSpotifyError } from "../utils/spotifyErrorHandler";
import logger from "../utils/logger";

export const command: CommandDefinition = {
  name: "play",
  aliases: [],
  description:
    "Plays a song on Spotify or adds it to the queue if something is already playing.",
  access: { global: 1 },
  cooldown: { user: 10, channel: 5 },
  channels: ["lsco"],
  reply: true,
  execute: async (context) => {
    const spotifyApi = new SpotifyAPI();
    const input = context.message.messageText.split(" ").slice(1).join(" ").trim();

    if (!input) {
      return "Please provide a song name or link for me to play.";
    }

    try {
      const trackInfo = await getSpotifyTrackUriFromInput(input);

      if (!trackInfo) {
        return "I couldn't find this song on Spotify.";
      }

      await spotifyApi.playTrack(trackInfo.uri);

      return `Now playing '${trackInfo.songName}' by ${trackInfo.artists}`;
    } catch (error: any) {
      logger.error("Error playing track:", error);
      return handleSpotifyError(error);
    }
  },
};
