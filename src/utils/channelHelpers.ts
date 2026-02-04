import { ApiClient } from "@twurple/api";
import { ChatClient } from "@twurple/chat";
import { PrismaClient } from "@prisma/client";
import { CommandError } from "./errorHandler";

export async function getTwitchChannelByName(apiClient: ApiClient, name: string) {
  const user = await apiClient.users.getUserByName(name);
  if (!user) throw new CommandError(`Twitch channel "${name}" not found.`);
  return user;
}

export async function getDbChannel(
  prisma: PrismaClient,
  identifier: { name?: string; id?: string }
) {
  const { name, id } = identifier;

  if (!name && !id) {
    throw new CommandError("Missing identifier for getDbChannel()");
  }

  return prisma.channel.findUnique({
    where: name ? { name } : { id },
  });
}

export async function joinPartChannelIfNeeded(
  chatClient: ChatClient,
  channelName: string,
  doJoin = false,
  doPart = false
) {
  const fullName = `#${channelName}`;
  const isJoined = chatClient.currentChannels.includes(fullName);

  if (doPart && isJoined) {
    await chatClient.part(channelName);
  }

  if (doJoin && !isJoined) {
    await chatClient.join(channelName);
  }

  return !isJoined;
}
