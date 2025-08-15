export interface INapsterMeta {
  totalCount: number;
  returnedCount: number;
}

export interface INapsterResult {
  search: INapsterSearch;
  meta: INapsterMeta;
}

export interface INapsterSearch {
  data: INapsterData;
}

export interface INapsterData {
  artists: INapsterArtist[];
  albums: INapsterAlbum[];
  tracks: INapsterTrack[];
  meta: INapsterMeta;
}

export interface INapsterArtist {
  id: string;
  name: string;
}

export interface INapsterAlbum {
  id: string;
  name: string;
  artistName: string;
  contributingArtists: IContributingArtists;
}

export interface IContributingArtists {
  primaryArtist: string;
}

export interface INapsterTrack {
  id: string;
  name: string;
  playbackSeconds: number;
  albumId: string;
  artistId: string;
  artistName: string;
}

export interface NapsterAuthResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
}

export interface NapsterPlaylist {
  description: string;
  id: string;
  images: ImageInfo[];
  name: string;
}

export interface NapsterPlaylistResponse {
  playlists: NapsterPlaylist[];
}

export interface PluginInfo {
  id?: string;
  name: string;
  script: string;
  version?: string;
  description?: string;
  optionsHtml?: string;
  optionsSameOrigin?: boolean;
}

type UiCheckLoginType = {
  type: "check-login";
};
type UiLoginType = {
  type: "login";
  auth: NapsterAuthResponse;
};
type UiLogoutType = {
  type: "logout";
};
type UiSetKeysType = {
  type: "set-keys";
  apiKey: string;
  apiSecret: string;
};

export type UiMessageType =
  | UiCheckLoginType
  | UiLoginType
  | UiLogoutType
  | UiSetKeysType;

type LoginType = {
  type: "login";
  auth: NapsterAuthResponse;
};

type InfoType = {
  type: "info";
  origin: string;
  pluginId: string;
  apiKey: string;
  apiSecret: string;
};

export type MessageType = LoginType | InfoType;
