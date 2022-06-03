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
  images: IImage[];
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
