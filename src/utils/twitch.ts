import axios, { AxiosInstance } from "axios";
import logger from "./logger";

const TWITCH_API_BASE = "https://api.twitch.tv/helix";
const TWITCH_API_TIMEOUT_MS = 15_000;

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
}

export interface TwitchChannel {
  id: string;
  name: string;
  displayName: string;
}

type TokenGetter = () => Promise<string>;

function createTwitchClient(
  getAccessToken: TokenGetter,
  clientId: string
): Promise<AxiosInstance> {
  return getAccessToken().then((accessToken) =>
    axios.create({
      baseURL: TWITCH_API_BASE,
      timeout: TWITCH_API_TIMEOUT_MS,
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })
  );
}

export async function getTwitchChannelByName(
  channelName: string,
  getAccessToken: TokenGetter,
  clientId: string
): Promise<TwitchChannel> {
  try {
    const client = await createTwitchClient(getAccessToken, clientId);
    const res = await client.get<{ data: TwitchUser[] }>("/users", {
      params: { login: channelName },
    });

    const user = res.data.data[0];
    if (!user) {
      throw new Error(`Twitch channel "${channelName}" not found`);
    }

    return {
      id: user.id,
      name: user.login,
      displayName: user.display_name,
    };
  } catch (err: unknown) {
    const axErr = err as { response?: { data?: unknown }; message?: string };
    logger.error("Error fetching Twitch channel:", axErr.response?.data ?? axErr);
    throw new Error(
      `Failed to fetch Twitch channel "${channelName}": ${axErr.message ?? "Unknown error"}`
    );
  }
}

export async function getTwitchUsersByIds(
  userIds: string[],
  getAccessToken: TokenGetter,
  clientId: string
): Promise<TwitchUser[]> {
  const users: TwitchUser[] = [];
  const MAX_IDS_PER_REQUEST = 100;
  const promises: Promise<{ data: { data: TwitchUser[] } }>[] = [];

  for (let i = 0; i < userIds.length; i += MAX_IDS_PER_REQUEST) {
    const batchIds = userIds.slice(i, i + MAX_IDS_PER_REQUEST);
    const params = new URLSearchParams();
    batchIds.forEach((id) => params.append("id", id));

    promises.push(
      createTwitchClient(getAccessToken, clientId).then((client) =>
        client.get<{ data: TwitchUser[] }>(`/users?${params.toString()}`)
      )
    );
  }

  const results = await Promise.allSettled(promises);

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      users.push(...result.value.data.data);
    } else {
      const reason = result.reason as { response?: { data?: unknown } };
      logger.error(
        "Error fetching Twitch users by IDs:",
        reason.response?.data ?? result.reason
      );
    }
  });

  return users;
}
