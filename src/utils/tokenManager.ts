import { RefreshingAuthProvider } from "@twurple/auth";
import type { AccessToken } from "@twurple/auth";
import { promises as fs } from "fs";
import path from "path";
import logger from "./logger";

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  obtainmentTimestamp?: number;
  scope?: string[];
}

const TOKEN_FILE_PATH = path.join(process.cwd(), "tokens.json");

type TokenRefreshCallback = (newAccessToken: string) => void | Promise<void>;

export class TokenManager {
  private authProvider?: RefreshingAuthProvider;
  private clientId: string;
  private clientSecret: string;
  private userId: string;
  private refreshCallbacks: TokenRefreshCallback[] = [];

  constructor(clientId: string, clientSecret: string, userId: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.userId = userId;
  }

  onTokenRefresh(callback: TokenRefreshCallback): void {
    this.refreshCallbacks.push(callback);
  }

  async initialize(): Promise<RefreshingAuthProvider> {
    const tokenData = await this.loadTokens();

    this.authProvider = new RefreshingAuthProvider({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });

    this.authProvider.onRefresh(async (userId: string, newTokenData: AccessToken) => {
      await this.saveTokens({
        accessToken: newTokenData.accessToken,
        refreshToken: newTokenData.refreshToken ?? undefined,
        expiresIn: newTokenData.expiresIn ?? undefined,
        obtainmentTimestamp: newTokenData.obtainmentTimestamp,
        scope: newTokenData.scope,
      });
      logger.info(`Token refreshed for user ${userId}`);

      for (const callback of this.refreshCallbacks) {
        try {
          await callback(newTokenData.accessToken);
        } catch (error) {
          logger.error("Error in token refresh callback:", error);
        }
      }
    });

    await this.authProvider.addUserForToken(
      {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken ?? null,
        expiresIn: tokenData.expiresIn ?? null,
        obtainmentTimestamp: tokenData.obtainmentTimestamp ?? Date.now(),
        scope: tokenData.scope ?? [],
      },
      tokenData.scope || []
    );

    return this.authProvider;
  }

  async getAuthProvider(): Promise<RefreshingAuthProvider> {
    if (!this.authProvider) {
      return await this.initialize();
    }
    return this.authProvider;
  }

  async getAccessToken(): Promise<string> {
    const provider = await this.getAuthProvider();
    const token = await provider.getAccessTokenForUser(this.userId);
    if (!token) {
      throw new Error(`No access token found for user ${this.userId}`);
    }
    return token.accessToken;
  }

  private async loadTokens(): Promise<TokenData> {
    try {
      const data = await fs.readFile(TOKEN_FILE_PATH, "utf-8");
      const tokenData = JSON.parse(data) as TokenData;

      if (!tokenData.accessToken) {
        throw new Error("No accessToken found in tokens.json");
      }

      logger.info("Tokens loaded from tokens.json");
      return tokenData;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        throw new Error(
          `tokens.json not found. Please create it with your initial tokens.`
        );
      }
      throw error;
    }
  }

  private async saveTokens(tokenData: TokenData): Promise<void> {
    try {
      await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(tokenData, null, 2), "utf-8");
      logger.debug("Tokens saved to tokens.json");
    } catch (error) {
      logger.error("Failed to save tokens:", error);
      throw error;
    }
  }
}
