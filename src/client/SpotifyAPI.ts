import axios, { AxiosError, AxiosInstance } from "axios";
import { getAccessToken } from "../utils/spotifyAPI";
import logger from "../utils/logger";

const SPOTIFY_API_TIMEOUT_MS = 15_000;

export class SpotifyAPI {
  private async createClient(): Promise<AxiosInstance> {
    const token = await getAccessToken();
    return axios.create({
      baseURL: "https://api.spotify.com/v1",
      timeout: SPOTIFY_API_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  private async request<T = unknown>(
    method: "GET" | "POST" | "PUT",
    endpoint: string,
    body?: object
  ): Promise<T> {
    const client = await this.createClient();
    try {
      const res = await client.request<T>({
        url: `/me/player/${endpoint}`,
        method,
        ...(body ? { data: body } : {}),
      });
      return res.data;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  private handleError(err: unknown): Error {
    const error = err as AxiosError<any>;
    const status = error.response?.status;
    const spotifyMsg =
      error.response?.data?.error?.message || error.message || "Unknown error";

    if (status === 404) {
      return new Error("No active Spotify device found.");
    }

    if (status === 403) {
      return new Error(`Spotify ERROR: ${status} ${spotifyMsg}`);
    }

    logger.error("Spotify API Error:", status || 500, spotifyMsg);
    return new Error("Spotify request failed.");
  }

  async playTrack(trackUri: string): Promise<void> {
    return this.request("PUT", "play", { uris: [trackUri] });
  }

  async resumePlayback(): Promise<void> {
    return this.request("PUT", "play");
  }

  async pausePlayback(): Promise<void> {
    return this.request("PUT", "pause");
  }

  async skipToNext(): Promise<void> {
    return this.request("POST", "next");
  }

  async skipToPrevious(): Promise<void> {
    return this.request("POST", "previous");
  }

  async setVolume(volumePercent: number): Promise<void> {
    return this.request("PUT", `volume?volume_percent=${volumePercent}`);
  }

  async addTrackToQueue(trackUri: string): Promise<void> {
    const client = await this.createClient();
    try {
      await client.post(`/me/player/queue`, null, {
        params: { uri: trackUri },
      });
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async searchTracks(query: string): Promise<unknown[]> {
    const client = await this.createClient();
    try {
      const res = await client.get<{ tracks?: { items?: unknown[] } }>("/search", {
        params: { q: query, type: "track", limit: 5 },
      });
      return res.data?.tracks?.items ?? [];
    } catch (err) {
      throw this.handleError(err);
    }
  }
}
