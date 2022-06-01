export interface ISong {
  id?: string;
  name: string;
  source: string;
  from?: string;
  apiId?: string;
  duration?: number;
  albumId?: string;
  artistId?: string;
  artistName?: string;
  images: IImage[];
}

export interface IAlbum {
  name: string;
  apiId: string;
  from: string;
  artistName?: string;
  artistId?: string;
  images: IImage[];
}

export interface IArtist {
  name: string;
  apiId: string;
  from: string;
  images: IImage[];
}

export interface IPlaylist {
  id?: string;
  name: string;
  songs: ISong[];
  apiId?: string;
  images?: IImage[];
  from?: string;
}

export interface IImage {
  url: string;
  height: number;
  width: number;
}

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

export interface Application {
  searchAll?: (request: SearchRequest) => Promise<SearchAllResult>;
  searchTracks?: (request: SearchRequest) => Promise<SearchTrackResult>;
  searchArtists?: (request: SearchRequest) => Promise<SearchArtistResult>;
  searchAlbums?: (request: SearchRequest) => Promise<SearchAlbumResult>;
  searchPlaylists?: (request: SearchRequest) => Promise<SearchPlaylistResult>;
  getTrackUrl?: (song: ISong) => Promise<void>;
  getPlaylistTracks?: (
    request: PlaylistTrackRequest
  ) => Promise<SearchTrackResult>;
  postUiMessage: (msg: any) => Promise<void>;
  onDeepLinkMessage: (message: string) => Promise<void>;
  onUiMessage?: (message: any) => void;
  endTrack: () => Promise<void>;
  setTrackTime: (currentTime: number) => Promise<void>;
  play?: (song: ISong) => Promise<void>;
  setVolume?: (volume: number) => Promise<void>;
  pause?: () => Promise<void>;
  resume?: () => Promise<void>;
  seek?: (time: number) => Promise<void>;
  getAlbumTracks?: (album: IAlbum) => Promise<ISong[]>;
  getArtistAlbums?: (artist: IArtist) => Promise<IAlbum[]>;
  setPlaybackRate?: (rate: number) => Promise<void>;
  getPluginId: () => Promise<string>;
  getUserPlaylists?: (
    request: UserPlaylistRequest
  ) => Promise<SearchPlaylistResult>;
}

export interface PageInfo {
  totalResults: number;
  resultsPerPage: number;
  offset: number;
  nextPage?: string;
  prevPage?: string;
}

export interface SearchAllResult {
  tracks?: SearchTrackResult;
  albums?: SearchAlbumResult;
  artists?: SearchArtistResult;
  playlists?: SearchPlaylistResult;
}

export interface SearchTrackResult {
  items: ISong[];
  pageInfo?: PageInfo;
}

export interface SearchArtistResult {
  items: IArtist[];
  pageInfo?: PageInfo;
}

export interface SearchAlbumResult {
  items: IAlbum[];
  pageInfo?: PageInfo;
}

export interface SearchPlaylistResult {
  items: IPlaylist[];
  pageInfo?: PageInfo;
}

export interface SearchRequest {
  query: string;
  page?: PageInfo;
}

export interface PlaylistTrackRequest {
  playlist: IPlaylist;
  page?: PageInfo;
}

export interface UserPlaylistRequest {
  page?: PageInfo;
}
