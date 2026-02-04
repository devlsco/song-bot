import { CommandDefinition, CommandContext } from "../types";
import axios from "axios";
import logger from "../utils/logger";

const CLIP_REQUEST_TIMEOUT_MS = 10_000;

interface ZiplineResponse {
  code: string;
}

interface TwitchClipsResponse {
  data?: Array<{ id: string }>;
}

export const command: CommandDefinition = {
  name: "clip",
  aliases: [],
  description: "Creates a clip of the current stream.",
  access: {},
  cooldown: {
    user: 5,
  },
  channels: ["aamsl"],
  reply: true,

  execute: async (context: CommandContext) => {
    const clipName = context.message.messageText.split(" ").slice(1).join(" ").trim();
    const { clientId } = context.config.twitch;
    const streamerId = process.env.STREAMER_ID;
    const zipLineUrl = process.env.ZIPLINE_URL;
    const zipLineAuth = process.env.ZIPLINE_AUTH_TOKEN;
    const discordWebhook = process.env.DISCORD_WEBHOOK;

    if (!streamerId) {
      return "Clip command is not configured (STREAMER_ID missing).";
    }

    try {
      const clipResponse = await axios.post<TwitchClipsResponse>(
        "https://api.twitch.tv/helix/clips",
        { broadcaster_id: streamerId },
        {
          timeout: CLIP_REQUEST_TIMEOUT_MS,
          headers: {
            "Client-ID": clientId,
            Authorization: `Bearer ${context.client.configuration.password}`,
            "Content-Type": "application/json",
          },
        }
      );

      const clipId = clipResponse.data.data?.[0]?.id;

      if (!clipId) {
        return "Sorry, failed to create clip. Twitch API returned no ID.";
      }

      const fullClipUrl = `https://clips.twitch.tv/${clipId}`;

      if (zipLineUrl && zipLineAuth) {
        try {
          const zp = await axios.post<ZiplineResponse>(
            "http://localhost:3050/api/user/urls",
            {
              destination: fullClipUrl,
              vanity: null,
              enabled: true,
            },
            {
              timeout: CLIP_REQUEST_TIMEOUT_MS,
              headers: {
                "content-type": "application/json",
                Referer: "AmeClip",
                authorization: zipLineAuth,
              },
            }
          );

          if (discordWebhook) {
            try {
              await axios.post(
                discordWebhook,
                {
                  content: `> **User:** ${context.message.senderUsername}\n${
                    clipName.length ? `> **Message:** ${clipName}\n` : ""
                  }> **Clip:** ${fullClipUrl}`,
                },
                {
                  timeout: 5_000,
                  headers: { "Content-Type": "application/json" },
                }
              );
              logger.info("Clip link sent to Discord webhook successfully.");
            } catch (err) {
              logger.error("Discord webhook failed:", err);
            }
          }

          return `Clip created https://${zipLineUrl}/go/${zp.data.code}`;
        } catch (zipErr) {
          logger.error("Zipline/shorten failed:", zipErr);
        }
      }

      return `Clip created ${fullClipUrl}`;
    } catch (error: unknown) {
      const axErr = error as { response?: { data?: unknown } };
      logger.error("Twitch Clip API error:", axErr.response?.data ?? error);
      return "Error o7";
    }
  },
};
