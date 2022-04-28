import axios from "axios";
import { API_KEY } from "./shared";
import {
  INapsterResult,
  INapsterAlbum,
  IAlbum,
  INapsterArtist,
  IArtist,
  IImage,
  INapsterTrack,
  ISong,
  INapsterData,
  IPlaylist,
  Application,
  NapsterAuthResponse,
} from "./types";

declare var Napster: any;
declare var application: Application;
let auth: NapsterAuthResponse | undefined;

const path = "https://api.napster.com/v2.2";

async function searchTracks(query: string) {
  const url = `${path}/search?apikey=${API_KEY}&query=${encodeURIComponent(
    query
  )}&type=track`;
  try {
    const results = await axios.get<INapsterResult>(url);
    const tracks = results.data.search.data.tracks;
    return trackResultToSong(tracks);
  } catch {
    return [];
  }
}

async function searchArtists(query: string) {
  const url = `${path}/search?apikey=${API_KEY}&query=${encodeURIComponent(
    query
  )}&type=artist`;
  try {
    const results = await axios.get<INapsterResult>(url);
    const artists = results.data.search.data.artists;
    return aristResultToArtist(artists);
  } catch {
    return [];
  }
}

async function searchAlbums(query: string) {
  const url = `${path}/search?apikey=${API_KEY}&query=${encodeURIComponent(
    query
  )}&type=album`;
  try {
    const results = await axios.get<INapsterResult>(url);
    const albums = results.data.search.data.albums;
    return albumResultToAlbum(albums);
  } catch {
    return [];
  }
}

function albumResultToAlbum(results: INapsterAlbum[]): IAlbum[] {
  return results.map(
    (r) =>
      ({
        apiId: r.id.toString(),
        artistId: r.contributingArtists.primaryArtist,
        artistName: r.artistName,
        from: "napster",
        name: r.name,
      } as IAlbum)
  );
}

function aristResultToArtist(results: INapsterArtist[]): IArtist[] {
  return results.map(
    (r) =>
      ({
        apiId: r.id.toString(),
        from: "napster",
        name: r.name,
      } as IArtist)
  );
}

function getImages(albumId: string): IImage[] {
  const sizes = [70, 170, 200, 300, 500];
  return sizes.map((s) => ({
    height: s,
    url: `https://api.napster.com/imageserver/v2/albums/${albumId}/images/${s}x${s}.jpg`,
    width: s,
  }));
}

function trackResultToSong(results: INapsterTrack[]): ISong[] {
  return results.map(
    (r) =>
      ({
        albumId: r.albumId,
        apiId: r.id,
        artistId: r.artistId,
        artistName: r.artistName,
        duration: r.playbackSeconds,
        from: "napster",
        images: getImages(r.albumId),
        name: r.name,
      } as ISong)
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

  public async play(song: ISong) {
    const id = song.apiId || "";
    Napster.player.play(id);
  }

  public pause() {
    try {
      Napster.player.pause();
    } catch {}
  }

  public resume() {
    Napster.player.resume();
  }

  public seek(time: number) {
    Napster.player.seek(time);
  }

  public setVolume(volume: number) {
    if (Napster && Napster.player) {
      Napster.player.setVolume(volume);
    }
  }

  public async searchAll(query: string) {
    const [tracks, albums, artists] = await Promise.all([
      searchTracks(query),
      searchAlbums(query),
      searchArtists(query),
    ]);
    return { tracks, albums, artists };
  }

  public async getAlbumTracks(album: IAlbum) {
    const url = `${path}/albums/${album.apiId}/tracks?apikey=${API_KEY}`;
    try {
      const results = await axios.get<INapsterData>(url);
      const tracks = results.data.tracks;
      return trackResultToSong(tracks);
    } catch {
      return [];
    }
  }

  public async getArtistAlbums(artist: IArtist) {
    const url = `${path}/artists/${artist.apiId}/albums/top?apikey=${API_KEY}`;
    try {
      const results = await axios.get<INapsterData>(url);
      const albums = results.data.albums;
      return albumResultToAlbum(albums);
    } catch {
      return [];
    }
  }

  public async getPlaylistTracks(_playlist: IPlaylist) {
    return [];
  }
}

const napsterPlayer = new NapsterPlayer();

const loadPlayer = () => {
  napsterPlayer.initalizePlayer(auth.access_token, auth.refresh_token);
  application.play = napsterPlayer.play.bind(napsterPlayer);
  application.pause = napsterPlayer.pause.bind(napsterPlayer);
  application.resume = napsterPlayer.resume.bind(napsterPlayer);
  application.setVolume = napsterPlayer.setVolume.bind(napsterPlayer);
  application.seek = napsterPlayer.seek.bind(napsterPlayer);
};

application.onUiMessage = (message: any) => {
  switch (message.type) {
    case "login":
      auth = message.auth;
      localStorage.setItem("auth", JSON.stringify(auth));
      loadPlayer();
      break;
    case "check-login":
      const authStr = localStorage.getItem("auth");
      if (authStr) {
        application.postUiMessage({ type: "login", auth: JSON.parse(authStr) });
      }
      break;
  }
};

const init = async () => {
  await napsterPlayer.loadScripts();
  const authString = localStorage.getItem("auth");
  if (authString) {
    auth = JSON.parse(authString);
    loadPlayer();
  }
  application.searchAll = napsterPlayer.searchAll.bind(napsterPlayer);
  application.getAlbumTracks = napsterPlayer.getAlbumTracks.bind(napsterPlayer);
  application.getArtistAlbums =
    napsterPlayer.getArtistAlbums.bind(napsterPlayer);
  application.getPlaylistTracks =
    napsterPlayer.getPlaylistTracks.bind(napsterPlayer);
};

init();
