import axios from "axios";
import { API_KEY, API_SECRET, TOKEN_URL } from "./shared";
import "audiogata-plugin-typings";
import {
  INapsterResult,
  INapsterAlbum,
  INapsterArtist,
  INapsterTrack,
  INapsterData,
  NapsterAuthResponse,
  NapsterPlaylistResponse,
} from "./types";

const http = axios.create();

declare var Napster: any;
declare var application: Application;
let auth: NapsterAuthResponse | undefined;

const refreshToken = async () => {
  if (!auth) {
    return;
  }

  const params = new URLSearchParams();
  params.append("client_id", API_KEY);
  params.append("client_secret", API_SECRET);
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", auth.refresh_token);
  params.append("response_type", "code");
  const result = await axios.post(TOKEN_URL, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (result.data.access_token && result.data.refresh_token) {
    localStorage.setItem("auth", JSON.stringify(result.data));
    return result.data.access_token as string;
  }
};

http.interceptors.request.use(
  (config) => {
    const authString = localStorage.getItem("auth");
    if (authString) {
      auth = JSON.parse(authString);
      config.headers["Authorization"] = "Bearer " + auth?.access_token;
    }
    return config;
  },
  (error) => {
    Promise.reject(error);
  }
);

http.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const accessToken = await refreshToken();
      axios.defaults.headers.common["Authorization"] = "Bearer " + accessToken;
      return http(originalRequest);
    }
  }
);

const path = "https://api.napster.com/v2.2";

function albumResultToAlbum(results: INapsterAlbum[]): Album[] {
  return results.map((r) => ({
    apiId: r.id.toString(),
    artistId: r.contributingArtists.primaryArtist,
    artistName: r.artistName,
    name: r.name,
    images: [],
  }));
}

function aristResultToArtist(results: INapsterArtist[]): Artist[] {
  return results.map((r) => ({
    apiId: r.id.toString(),
    name: r.name,
    images: [],
  }));
}

function getImages(albumId: string): ImageInfo[] {
  const sizes = [70, 170, 200, 300, 500];
  return sizes.map((s) => ({
    height: s,
    url: `https://api.napster.com/imageserver/v2/albums/${albumId}/images/${s}x${s}.jpg`,
    width: s,
  }));
}

function trackResultToSong(results: INapsterTrack[]): Track[] {
  return results.map((r) => ({
    albumId: r.albumId,
    apiId: r.id,
    artistId: r.artistId,
    artistName: r.artistName,
    duration: r.playbackSeconds,
    images: getImages(r.albumId),
    name: r.name,
  }));
}

class NapsterPlayer {
  private loadScript(src: string) {
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = src;
      script.onload = () => {
        resolve();
      };
      script.onerror = () => {
        reject();
      };
      document.head.appendChild(script);
    });
  }

  public async loadScripts() {
    await this.loadScript(
      "//ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"
    );
    await this.loadScript(
      "https://app.napster.com/sdk/streaming-player-1.0.1.js"
    );
    await this.loadScript(
      "https://cdn.jsdelivr.net/gh/Napster/napster.js@0b3beead613b52bdcec9062941f92c504919976e/napster.min.js"
    );
  }

  public initalizePlayer(accessToken: string, refreshToken?: string) {
    Napster.init({
      consumerKey: API_KEY,
      isHTML5Compatible: true,
    });
    Napster.member.set({
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
    Napster.player.auth();
    if (Napster.player.streamingPlayer) {
      Napster.player.streamingPlayer.callbackHandler("trackProgress", () => {
        const currentTime = Napster.player.streamingPlayer.currentTime();
        application.setTrackTime(currentTime);
      });
      Napster.player.streamingPlayer.callbackHandler("trackEnded", () => {
        application.endTrack();
      });
    }
  }

  public async play(song: Track) {
    const id = song.apiId || "";
    Napster.player.play(id);
  }

  public async pause() {
    try {
      Napster.player.pause();
    } catch {}
  }

  public async resume() {
    Napster.player.resume();
  }

  public async seek(time: number) {
    Napster.player.seek(time);
  }

  public async setVolume(volume: number) {
    if (Napster && Napster.player) {
      Napster.player.setVolume(volume);
    }
  }
}

const napsterPlayer = new NapsterPlayer();

const loadPlayer = () => {
  if (!auth) return;

  napsterPlayer.initalizePlayer(auth.access_token, auth.refresh_token);
  application.onPlay = napsterPlayer.play.bind(napsterPlayer);
  application.onPause = napsterPlayer.pause.bind(napsterPlayer);
  application.onResume = napsterPlayer.resume.bind(napsterPlayer);
  application.onSetVolume = napsterPlayer.setVolume.bind(napsterPlayer);
  application.onSeek = napsterPlayer.seek.bind(napsterPlayer);
  application.onGetUserPlaylists = getUserPlaylists;
};

const sendOrigin = async () => {
  const host = document.location.host;
  const hostArray = host.split(".");
  hostArray.shift();
  const domain = hostArray.join(".");
  const origin = `${document.location.protocol}//${domain}`;
  const pluginId = await application.getPluginId();
  application.postUiMessage({
    type: "origin",
    origin: origin,
    pluginId: pluginId,
  });
};

application.onUiMessage = async (message: any) => {
  switch (message.type) {
    case "login":
      auth = message.auth;
      localStorage.setItem("auth", JSON.stringify(auth));
      loadPlayer();
      break;
    case "logout":
      localStorage.removeItem("auth");
      break;
    case "check-login":
      const authStr = localStorage.getItem("auth");
      if (authStr) {
        application.postUiMessage({ type: "login", auth: JSON.parse(authStr) });
      }
      await sendOrigin();
      break;
  }
};

application.onDeepLinkMessage = async (message: string) => {
  application.postUiMessage({ type: "deeplink", url: message });
};

async function getArtistAlbums(artist: Artist) {
  const url = `${path}/artists/${artist.apiId}/albums/top?apikey=${API_KEY}`;
  try {
    const results = await axios.get<INapsterData>(url);
    const albums = results.data.albums;
    return albumResultToAlbum(albums);
  } catch {
    return [];
  }
}

async function getAlbumTracks(album: Album) {
  const url = `${path}/albums/${album.apiId}/tracks?apikey=${API_KEY}`;
  try {
    const results = await axios.get<INapsterData>(url);
    const tracks = results.data.tracks;
    return trackResultToSong(tracks);
  } catch {
    return [];
  }
}

async function getUserPlaylists(
  _request: UserPlaylistRequest
): Promise<SearchPlaylistResult> {
  if (!auth) {
    return { items: [] };
  }
  const url = `${path}/me/library/playlists`;
  const result = await http.get<NapsterPlaylistResponse>(url);

  const response: SearchPlaylistResult = {
    items: result.data.playlists.map((p) => ({
      name: p.name,
      images: p.images,
      apiId: p.id,
    })),
  };
  return response;
}

async function getPlaylistTracks(
  request: PlaylistTrackRequest
): Promise<SearchTrackResult> {
  const limit = 200;
  const url = `${path}/playlists/${request.playlist.apiId}/tracks?apikey=${API_KEY}&limit=${limit}`;
  const result = await http.get<INapsterData>(url);

  const response: SearchTrackResult = {
    items: trackResultToSong(result.data.tracks),
  };
  return response;
}

async function searchArtists(
  request: SearchRequest
): Promise<SearchArtistResult> {
  const url = `${path}/search?apikey=${API_KEY}&query=${encodeURIComponent(
    request.query
  )}&type=artist`;
  try {
    const results = await axios.get<INapsterResult>(url);
    const artists = results.data.search.data.artists;
    const response: SearchArtistResult = {
      items: aristResultToArtist(artists),
    };
    return response;
  } catch {
    return { items: [] };
  }
}

async function searchAlbums(
  request: SearchRequest
): Promise<SearchAlbumResult> {
  const url = `${path}/search?apikey=${API_KEY}&query=${encodeURIComponent(
    request.query
  )}&type=album`;
  try {
    const results = await axios.get<INapsterResult>(url);
    const albums = results.data.search.data.albums;
    const response: SearchAlbumResult = {
      items: albumResultToAlbum(albums),
    };
    return response;
  } catch {
    return { items: [] };
  }
}

async function searchTracks(
  request: SearchRequest
): Promise<SearchTrackResult> {
  const url = `${path}/search?apikey=${API_KEY}&query=${encodeURIComponent(
    request.query
  )}&type=track`;
  try {
    const results = await axios.get<INapsterResult>(url);
    const tracks = results.data.search.data.tracks;
    const response: SearchTrackResult = { items: trackResultToSong(tracks) };
    return response;
  } catch {
    return { items: [] };
  }
}

async function searchAll(request: SearchRequest): Promise<SearchAllResult> {
  const [tracks, albums, artists] = await Promise.all([
    searchTracks(request),
    searchAlbums(request),
    searchArtists(request),
  ]);
  return { tracks, albums, artists };
}

const init = async () => {
  await napsterPlayer.loadScripts();
  const authString = localStorage.getItem("auth");
  if (authString) {
    auth = JSON.parse(authString);
    loadPlayer();
  }
  application.onSearchAll = searchAll;
  application.onGetAlbumTracks = getAlbumTracks;
  application.onGetArtistAlbums = getArtistAlbums;
  application.onGetPlaylistTracks = getPlaylistTracks;
};

init();
