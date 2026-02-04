export function handleSpotifyError(error: any): string {
  const message = error.message?.toLowerCase() || "";

  if (message.includes("no active spotify device found")) {
    return "No active Spotify device was found. Please make sure Spotify is open and playing on one of your devices before using this command.";
  } else if (message.includes("restriction violated")) {
    return "This action is restricted by Spotify. The track may not be playable in your region or may have playback limitations.";
  } else if (message.includes("premium")) {
    return "A Spotify Premium subscription is required to use this feature.";
  }
  return "An unknown Spotify error occurred. Please try again or check your device and account status.";
}
