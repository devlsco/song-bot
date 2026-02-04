export function getSpotifyTrackUri(text: string): string | null {
  const spotifyUrlRegex =
    /^(https:\/\/open\.spotify\.com\/track\/)([a-zA-Z0-9]+)(?:\?si=[a-zA-Z0-9]+)?$/;
  const spotifyUriRegex = /spotify:track:([a-zA-Z0-9]+)/;

  let match = text.match(spotifyUrlRegex);
  if (match && match[2]) {
    return `spotify:track:${match[2]}`;
  }

  match = text.match(spotifyUriRegex);
  if (match && match[1]) {
    return `spotify:track:${match[1]}`;
  }

  return null;
}
