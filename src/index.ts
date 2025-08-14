import ky from "ky";
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


declare var Napster: any;
let auth: NapsterAuthResponse | undefined;

const sendMessage = (message: MessageType) => {
  application.postUiMessage(message);
};

const getApiKey = () => {
  const apiKey = localStorage.getItem("apiKey");
  return apiKey || API_KEY;
};

const http = ky.create({
  hooks: {
    beforeRequest: [
      (request) => {
        const authString = localStorage.getItem("auth");
        if (authString) {
          auth = JSON.parse(authString);
          request.headers.set("Authorization", `Bearer ${auth?.access_token}`);
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          const accessToken = await refreshToken();
          request.headers.set("Authorization", `Bearer ${accessToken}`);
          return http(request, options);
        }
      },
    ],
  },
});

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
  const result = await ky.post<NapsterAuthResponse>(tokenUrl, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  }).json();
  if (result.access_token && result.refresh_token) {
    localStorage.setItem("auth", JSON.stringify(result));
    return result.access_token;
  }
};

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
}

const loadAuthentication = async () => {
  if (!auth) return;

  application.onGetUserPlaylists = getUserPlaylists;
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
      loadAuthentication();
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
    const details = await ky.get<INapsterData>(detailsUrl).json();
    const results = await ky.get<INapsterData>(url).json();
    const albums = results.albums;
    const aritistInfo = details.artists[0];
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

async function getArtistTopTracks(
  request: ArtistTopTracksRequest
): Promise<ArtistTopTracksResult> {
  const limit = 200;
  const detailsUrl = `${path}/artists/${request.apiId}?apikey=${getApiKey()}`;
  const url = `${path}/artists/${
    request.apiId
  }/tracks/top?apikey=${getApiKey()}&limit=${limit}`;
  try {
    const details = await ky.get<INapsterData>(detailsUrl).json();
    const results = await ky.get<INapsterData>(url).json();
    const tracks = results.tracks;
    const artistInfo = details.artists[0];
    return {
      items: trackResultToSong(tracks),
      artist: {
        name: artistInfo.name,
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
    const details = await ky.get<INapsterData>(detailsUrl).json();
    const results = await ky.get<INapsterData>(url).json();
    const tracks = results.tracks;
    const albumData = details.albums[0];
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
  const result = await http.get<NapsterPlaylistResponse>(url).json();

  const response: SearchPlaylistResult = {
    items: result.playlists.map(
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
  const detailsResult = await http.get<NapsterPlaylistResponse>(detailsUrl).json();
  const result = await http.get<INapsterData>(url).json();

  const response: PlaylistTracksResult = {
    playlist: {
      name: detailsResult.playlists[0].name,
      images: detailsResult.playlists[0].images,
    },
    items: trackResultToSong(result.tracks),
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
    const results = await ky.get<INapsterResult>(url).json();
    const artists = results.search.data.artists;
    const page: PageInfo = {
      offset: offset,
      totalResults: results.meta.totalCount,
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
    const results = await ky.get<INapsterResult>(url).json();
    const albums = results.search.data.albums;
    const page: PageInfo = {
      offset: offset,
      totalResults: results.meta.totalCount,
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
    const results = await ky.get<INapsterResult>(url).json();
    const tracks = results.search.data.tracks;
    const page: PageInfo = {
      offset: offset,
      totalResults: results.meta.totalCount,
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
  const result = await http.get<INapsterData>(url).json();
  return {
    tracks: { items: trackResultToSong(result.tracks) },
  };
}

const changeTheme = (theme: Theme) => {
  localStorage.setItem("kb-color-mode", theme);
};

async function getTrackUrl(request: GetTrackUrlRequest): Promise<string> {
  if (!auth || !request.apiId) {
    throw new Error("No authentication or track ID available");
  }
  
  const url = `${path}/streams`;
  try {
    const result = await http.get(url, {
      searchParams: {
        track: request.apiId,
        bitrate: 320,
        format: 'AAC',
        protocol: ''
      }
    }).json() as { streams: { url: string }[] };
    
    if (result.streams && result.streams.length > 0) {
      return result.streams[0].url;
    }
    throw new Error("No stream URL available");
  } catch (error) {
    throw new Error(`Failed to get stream URL: ${error}`);
  }
}

const init = async () => {
  application.onSearchAll = searchAll;
  application.onSearchAlbums = searchAlbums;
  application.onSearchTracks = searchTracks;
  application.onSearchArtists = searchArtists;
  application.onGetAlbumTracks = getAlbumTracks;
  application.onGetArtistAlbums = getArtistAlbums;
  application.onGetArtistTopTracks = getArtistTopTracks;
  application.onGetPlaylistTracks = getPlaylistTracks;
  application.onGetTopItems = getTopItems;
  application.onGetTrackUrl = getTrackUrl;
  const authString = localStorage.getItem("auth");
  if (authString) {
    auth = JSON.parse(authString);
    loadAuthentication();
  }
  const theme = await application.getTheme();
  changeTheme(theme);
};

application.onChangeTheme = async (theme: Theme) => {
  changeTheme(theme);
};

init();
