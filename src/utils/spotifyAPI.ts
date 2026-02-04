import fetch from "node-fetch";
import { SpotifyAPI } from "../client/SpotifyAPI";
import logger from "./logger";

export let accessToken = "";
let accessTokenExpiresAt = 0;

const clientId = process.env.SPOTIFY_CLIENT_ID!;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN!;

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifySongItem {
  name: string;
  artists: SpotifyArtist[];
  duration_ms: number;
  external_urls: { spotify: string };
}

interface SpotifyCurrentlyPlayingResponse {
  item?: SpotifySongItem;
  progress_ms?: number;
}

export interface SpotifyTrackInfo {
  uri: string;
  songName: string;
  artists: string;
}

async function refreshAccessToken(): Promise<string> {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    logger.error("Failed to refresh Spotify token:", await res.text());
    throw new Error("Failed to refresh Spotify token");
  }

  const data = (await res.json()) as SpotifyTokenResponse;
  accessToken = data.access_token;
  accessTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

export async function getAccessToken() {
  if (!accessToken || Date.now() >= accessTokenExpiresAt) {
    await refreshAccessToken();
  }
  return accessToken;
}

function formatArtists(artistNames: string[]): string {
  if (artistNames.length === 0) return "";
  if (artistNames.length === 1) return artistNames[0];
  if (artistNames.length === 2) return `${artistNames[0]} & ${artistNames[1]}`;
  const lastArtist = artistNames[artistNames.length - 1];
  const otherArtists = artistNames.slice(0, artistNames.length - 1);
  return `${otherArtists.join(", ")} & ${lastArtist}`;
}

export async function getCurrentlyPlaying() {
  const token = await getAccessToken();

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    logger.error("Spotify API error:", await res.text());
    throw new Error("Failed to fetch currently playing track");
  }

  const data = (await res.json()) as SpotifyCurrentlyPlayingResponse;
  if (!data.item) return null;

  const songName = data.item.name;
  const artists = formatArtists(data.item.artists.map((a: SpotifyArtist) => a.name));
  const durationMs = data.item.duration_ms;
  const progressMs = data.progress_ms ?? 0;
  const songUrl = data.item.external_urls.spotify;

  return {
    songName,
    artists,
    durationMs,
    progressMs,
    songUrl,
  };
}

export async function getSpotifyTrackUriFromInput(
  input: string
): Promise<SpotifyTrackInfo | null> {
  const urlMatch = input.match(/https?:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
  if (urlMatch && urlMatch[1]) {
    const token = await getAccessToken();
    const trackId = urlMatch[1];
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      logger.error("Failed to fetch track details for URL:", await res.text());
      return null;
    }
    const trackData = (await res.json()) as SpotifySongItem;
    return {
      uri: `spotify:track:${trackId}`,
      songName: trackData.name,
      artists: formatArtists(trackData.artists.map((a) => a.name)),
    };
  }

  const uriMatch = input.match(/spotify:track:([a-zA-Z0-9]+)/);
  if (uriMatch && uriMatch[1]) {
    const token = await getAccessToken();
    const trackId = uriMatch[1];
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      logger.error("Failed to fetch track details for URI:", await res.text());
      return null;
    }
    const trackData = (await res.json()) as SpotifySongItem;
    return {
      uri: `spotify:track:${trackId}`,
      songName: trackData.name,
      artists: formatArtists(trackData.artists.map((a) => a.name)),
    };
  }

  try {
    const spotifyApi = new SpotifyAPI();
    const rawResults = await spotifyApi.searchTracks(input);
    type SearchItem = SpotifySongItem & { popularity?: number; uri?: string };
    const searchResults = rawResults as SearchItem[];
    if (searchResults.length === 0) {
      return null;
    }

    const normalizedInput = input.toLowerCase();

    const exactMatch = searchResults.find((track) => {
      const trackName = track.name.toLowerCase();
      const artistNames = track.artists.map((a) => a.name.toLowerCase());
      return (
        trackName === normalizedInput ||
        artistNames.some((artist) => normalizedInput.includes(artist))
      );
    });

    const selectedTrack =
      exactMatch ||
      searchResults.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];

    if (selectedTrack?.uri) {
      return {
        uri: selectedTrack.uri,
        songName: selectedTrack.name,
        artists: formatArtists(selectedTrack.artists.map((a) => a.name)),
      };
    }
    return null;
  } catch (error) {
    logger.error("Error searching for Spotify track:", error);
    return null;
  }
}
