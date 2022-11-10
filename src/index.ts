import axios from "axios";
import { API_KEY, TOKEN_SERVER, TOKEN_URL } from "./shared";
import {
  INapsterResult,
  INapsterAlbum,
  INapsterArtist,
  INapsterTrack,
  INapsterData,
  NapsterAuthResponse,
  NapsterPlaylistResponse,
  UiMessageType,
  MessageType,
} from "./types";

const http = axios.create();

declare var Napster: any;
let auth: NapsterAuthResponse | undefined;

let scriptReadyResolve: any;
let scriptReady = new Promise((resolve) => {
  scriptReadyResolve = resolve;
});

const sendMessage = (message: MessageType) => {
  application.postUiMessage(message);
};

const getApiKey = () => {
  const apiKey = localStorage.getItem("apiKey");
  return apiKey || API_KEY;
};

const refreshToken = async () => {
  if (!auth) {
    return;
  }
  const apiKey = localStorage.getItem("clientId");
  const apiSecret = localStorage.getItem("clientSecret");

  let tokenUrl = TOKEN_SERVER;
  const params = new URLSearchParams();
  params.append("client_id", apiKey || API_KEY);
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", auth.refresh_token);
  params.append("response_type", "code");

  if (apiKey && apiSecret) {
    params.append("client_secret", apiSecret);
    tokenUrl = TOKEN_URL;
  }
  const result = await axios.post(tokenUrl, params, {
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
      http.defaults.headers.common["Authorization"] = "Bearer " + accessToken;
      return http(originalRequest);
    }
  }
);

const path = "https://api.napster.com/v2.2";

function albumResultToAlbum(results: INapsterAlbum[]): Album[] {
  return results.map(
    (r): Album => ({
      apiId: r.id.toString(),
      artistApiId: r.contributingArtists.primaryArtist,
      artistName: r.artistName,
      name: r.name,
      images: getAlbumImages(r.id),
    })
  );
}

function artistResultToArtist(results: INapsterArtist[]): Artist[] {
  return results.map(
    (r): Artist => ({
      apiId: r.id.toString(),
      name: r.name,
      images: getArtistImages(r.id),
    })
  );
}

function getAlbumImages(albumId: string): ImageInfo[] {
  const sizes = [70, 170, 200, 300, 500];
  return sizes.map(
    (s): ImageInfo => ({
      height: s,
      url: `https://api.napster.com/imageserver/v2/albums/${albumId}/images/${s}x${s}.jpg`,
      width: s,
    })
  );
}

function getArtistImages(artistId: string): ImageInfo[] {
  const sizes = [
    { width: 70, height: 47 },
    { width: 150, height: 100 },
    { width: 356, height: 237 },
    { width: 633, height: 422 },
  ];

  return sizes.map(
    (s): ImageInfo => ({
      height: s.height,
      width: s.width,
      url: `https://api.napster.com/imageserver/v2/artists/${artistId}/images/${s.width}x${s.height}.jpg`,
    })
  );
}

function trackResultToSong(results: INapsterTrack[]): Track[] {
  return results.map(
    (r): Track => ({
      albumApiId: r.albumId,
      apiId: r.id,
      artistApiId: r.artistId,
      artistName: r.artistName,
      duration: r.playbackSeconds,
      images: getAlbumImages(r.albumId),
      name: r.name,
    })
  );
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
    scriptReadyResolve(undefined);
  }

  public async initalizePlayer(accessToken: string, refreshToken?: string) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(), 5000);
    });
    await Promise.race([scriptReady, timeoutPromise]);

    Napster.init({
      consumerKey: getApiKey(),
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

  public async play(request: PlayTrackRequest) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(), 5000);
    });
    await Promise.race([scriptReady, timeoutPromise]);

    const id = request.apiId || "";
    Napster.player.play(id, request.seekTime);
  }

  public async pause() {
    try {
      Napster.player.pause();
    } catch {}
  }

  public async resume() {
    try {
      Napster.player.resume();
    } catch {}
  }

  public async seek(time: number) {
    try {
      Napster.player.seek(time);
    } catch {}
  }

  public async setVolume(volume: number) {
    if (Napster && Napster.player) {
      Napster.player.setVolume(volume);
    }
  }
}

const napsterPlayer = new NapsterPlayer();

const loadPlayer = async () => {
  if (!auth) return;

  application.onPlay = napsterPlayer.play.bind(napsterPlayer);
  application.onPause = napsterPlayer.pause.bind(napsterPlayer);
  application.onResume = napsterPlayer.resume.bind(napsterPlayer);
  application.onSetVolume = napsterPlayer.setVolume.bind(napsterPlayer);
  application.onSeek = napsterPlayer.seek.bind(napsterPlayer);
  application.onGetUserPlaylists = getUserPlaylists;
  await napsterPlayer.initalizePlayer(auth.access_token, auth.refresh_token);
};

const sendOrigin = async () => {
  const host = document.location.host;
  const hostArray = host.split(".");
  hostArray.shift();
  const domain = hostArray.join(".");
  const origin = `${document.location.protocol}//${domain}`;
  const pluginId = await application.getPluginId();
  const apiKey = localStorage.getItem("apiKey") ?? "";
  const apiSecret = localStorage.getItem("apiSecret") ?? "";
  sendMessage({
    type: "info",
    origin: origin,
    pluginId: pluginId,
    apiKey: apiKey,
    apiSecret: apiSecret,
  });
};

application.onUiMessage = async (message: UiMessageType) => {
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
        sendMessage({
          type: "login",
          auth: JSON.parse(authStr) as NapsterAuthResponse,
        });
      }
      await sendOrigin();
      break;
    case "set-keys":
      localStorage.setItem("apiKey", message.apiKey);
      localStorage.setItem("apiSecret", message.apiSecret);
      break;
    default:
      const _exhaustive: never = message;
      break;
  }
};

application.onDeepLinkMessage = async (message: string) => {
  application.postUiMessage({ type: "deeplink", url: message });
};

async function getArtistAlbums(
  request: ArtistAlbumRequest
): Promise<ArtistAlbumsResult> {
  const limit = 200;
  const detailsUrl = `${path}/artists/${request.apiId}?apikey=${getApiKey()}`;
  const url = `${path}/artists/${
    request.apiId
  }/albums/top?apikey=${getApiKey()}&limit=${limit}`;
  try {
    const details = await axios.get<INapsterData>(detailsUrl);
    const results = await axios.get<INapsterData>(url);
    const albums = results.data.albums;
    const aritistInfo = details.data.artists[0];
    return {
      items: albumResultToAlbum(albums),
      artist: {
        name: aritistInfo.name,
        apiId: request.apiId || "",
        images: getArtistImages(request.apiId || ""),
      },
    };
  } catch {
    return { items: [] };
  }
}

async function getAlbumTracks(
  request: AlbumTrackRequest
): Promise<AlbumTracksResult> {
  const detailsUrl = `${path}/albums/${request.apiId}?apikey=${getApiKey()}`;
  const url = `${path}/albums/${request.apiId}/tracks?apikey=${getApiKey()}`;
  try {
    const details = await axios.get<INapsterData>(detailsUrl);
    const results = await axios.get<INapsterData>(url);
    const tracks = results.data.tracks;
    const albumData = details.data.albums[0];
    return {
      items: trackResultToSong(tracks),
      album: {
        artistName: albumData.artistName,
        artistApiId: albumData.contributingArtists.primaryArtist,
        apiId: request.apiId || "",
        name: albumData.name,
        images: getAlbumImages(request.apiId || ""),
      },
    };
  } catch {
    return { items: [] };
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
    items: result.data.playlists.map(
      (p): PlaylistInfo => ({
        name: p.name,
        images: p.images,
        apiId: p.id,
      })
    ),
  };
  return response;
}

async function getPlaylistTracks(
  request: PlaylistTrackRequest
): Promise<PlaylistTracksResult> {
  const limit = 200;

  const detailsUrl = `${path}/playlists/${request.apiId}?apikey=${getApiKey()}`;
  const url = `${path}/playlists/${
    request.apiId
  }/tracks?apikey=${getApiKey()}&limit=${limit}`;
  const detailsResult = await http.get<NapsterPlaylistResponse>(detailsUrl);
  const result = await http.get<INapsterData>(url);

  const response: PlaylistTracksResult = {
    playlist: {
      name: detailsResult.data.playlists[0].name,
      images: detailsResult.data.playlists[0].images,
    },
    items: trackResultToSong(result.data.tracks),
  };
  return response;
}

async function searchArtists(
  request: SearchRequest
): Promise<SearchArtistResult> {
  const perPage = 20;
  const offset = request.pageInfo?.offset || 0;
  const url = `${path}/search?apikey=${getApiKey()}&query=${encodeURIComponent(
    request.query
  )}&type=artist&per_type_limit=${perPage}&offset=${offset}`;
  try {
    const results = await axios.get<INapsterResult>(url);
    const artists = results.data.search.data.artists;
    const page: PageInfo = {
      offset: offset,
      totalResults: results.data.meta.totalCount,
      resultsPerPage: perPage,
    };
    const response: SearchArtistResult = {
      items: artistResultToArtist(artists),
      pageInfo: page,
    };
    return response;
  } catch {
    return { items: [] };
  }
}

async function searchAlbums(
  request: SearchRequest
): Promise<SearchAlbumResult> {
  const perPage = 20;
  const offset = request.pageInfo?.offset || 0;
  const url = `${path}/search?apikey=${getApiKey()}&query=${encodeURIComponent(
    request.query
  )}&type=album&per_type_limit=${perPage}&offset=${offset}`;
  try {
    const results = await axios.get<INapsterResult>(url);
    const albums = results.data.search.data.albums;
    const page: PageInfo = {
      offset: offset,
      totalResults: results.data.meta.totalCount,
      resultsPerPage: perPage,
    };
    const response: SearchAlbumResult = {
      items: albumResultToAlbum(albums),
      pageInfo: page,
    };
    return response;
  } catch {
    return { items: [] };
  }
}

async function searchTracks(
  request: SearchRequest
): Promise<SearchTrackResult> {
  const perPage = 20;
  const offset = request.pageInfo?.offset || 0;
  const url = `${path}/search?apikey=${getApiKey()}&query=${encodeURIComponent(
    request.query
  )}&type=track&per_type_limit=${perPage}&offset=${offset}`;
  try {
    const results = await axios.get<INapsterResult>(url);
    const tracks = results.data.search.data.tracks;
    const page: PageInfo = {
      offset: offset,
      totalResults: results.data.meta.totalCount,
      resultsPerPage: perPage,
    };
    const response: SearchTrackResult = {
      items: trackResultToSong(tracks),
      pageInfo: page,
    };
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

async function getTopItems(): Promise<SearchAllResult> {
  const url = `${path}/tracks/top`;
  const result = await http.get<INapsterData>(url);
  return {
    tracks: { items: trackResultToSong(result.data.tracks) },
  };
}

const init = async () => {
  application.onSearchAll = searchAll;
  application.onSearchAlbums = searchAlbums;
  application.onSearchTracks = searchTracks;
  application.onSearchArtists = searchArtists;
  application.onGetAlbumTracks = getAlbumTracks;
  application.onGetArtistAlbums = getArtistAlbums;
  application.onGetPlaylistTracks = getPlaylistTracks;
  application.onGetTopItems = getTopItems;
  const authString = localStorage.getItem("auth");
  if (authString) {
    auth = JSON.parse(authString);
    loadPlayer();
  }
  await napsterPlayer.loadScripts();
};

init();
