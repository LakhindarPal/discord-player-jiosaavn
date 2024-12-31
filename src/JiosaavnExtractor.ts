import {
  BaseExtractor,
  ExtractorInfo,
  ExtractorSearchContext,
  ExtractorStreamable,
  Playlist,
  Track,
  Util,
} from "discord-player";

export class JiosaavnExtractor extends BaseExtractor {
  public static identifier = "dp.lpal.jiosaavn";

  public createBridgeQuery = (track: Track): string => `${track.title} by ${track.author}`;

  public async activate(): Promise<void> {
    this.protocols = ["jssearch", "jiosaavn"];
  }

  public async deactivate(): Promise<void> {
    this.protocols = [];
  }

  public async validate(query: string): Promise<boolean> {
    const { type } = this.parseURL(query);
    return Boolean(type);
  }

  public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    const { type, token } = this.parseURL(query);

    if (context.protocol === "jssearch" || type === "song") {
      let data;
      if (type === "song") {
        const raw = await this.fetchAPI({
          __call: "webapi.get",
          token,
          type,
        });
        data = raw?.songs[0];
      } else {
        const raw = await this.fetchAPI({
          __call: "search.getResults",
          n: 1,
          p: 1,
          q: query,
        });
        data = raw?.results[0];
      }
      if (!data) {
        return this.createResponse();
      }
      const track: Track = this.buildTrack(data, context.requestedBy);
      return this.createResponse(null, [track]);
    } else {
      let params: Record<string, string | number> = {
        __call: "webapi.get",
        token,
        type: type === "featured" ? "playlist" : type,
      };

      if (type === "artist") {
        params = {
          ...params,
          category: "",
          n_album: 1,
          n_song: 50,
          p: 0,
          sort_order: "",
          sub_type: "",
        };
      }
      if (type === "featured") {
        params = {
          ...params,
          n: 50,
          p: 1,
        };
      }
      const data = await this.fetchAPI(params);
      if (!data) {
        return this.createResponse();
      }
      const artistsData =
        type === "playlist" ? data.more_info.artists : data.more_info.artistMap.primary_artists;
      const playlist = new Playlist(this.context.player, {
        author: {
          name: type === "artist" ? data.name : artistsData.map((a: any) => a.name).join(", "),
          url: "",
        },
        description: data.header_desc || "",
        id: type === "artist" ? data.artistId : data.id,
        rawPlaylist: data,
        source: "arbitrary",
        thumbnail: data.image?.replace(/\b(50x50|150x150)\b/, "500x500"),
        title: type === "artist" ? data.name : data.title,
        tracks: [],
        type: data.type,
        url: type === "artist" ? data.urls.overview : data.perma_url,
      });

      const trackList = type === "artist" ? data.topSongs : data.list || [];
      playlist.tracks = trackList.map((info: any) =>
        this.buildTrack(info, context.requestedBy, playlist)
      );

      return this.createResponse(playlist, playlist.tracks);
    }
  }

  public async stream(track: Track): Promise<ExtractorStreamable | string> {
    const data = await this.fetchAPI({
      __call: "song.generateAuthToken",
      bitrate: 128,
      url: (track.raw as any).more_info.encrypted_media_url,
    });

    if (!data || !data.auth_url) {
      return "";
    }
    const stream = data.auth_url.split("?")[0].replace("ac.cf.saavncdn.com", "aac.saavncdn.com");
    return stream;
  }

  public async getRelatedTracks(track: Track): Promise<ExtractorInfo> {
    const data = await this.fetchAPI({
      __call: "reco.getreco",
      pid: (track.raw as any).id,
    });

    if (!data) {
      return this.createResponse();
    }

    const tracks: Track[] = data.map((info: any) => this.buildTrack(info, track.requestedBy));
    return this.createResponse(null, tracks);
  }

  public async bridge(track: Track): Promise<ExtractorStreamable | null> {
    const query = `${track.author} ${track.source === "youtube" ? track.cleanTitle : track.title}`;
    const raw = await this.fetchAPI({
      __call: "search.getResults",
      n: 1,
      p: 1,
      q: query,
    });
    const data = raw?.results[0];

    if (!data) {
      return null;
    }

    const bridgedTrack = this.buildTrack(data, track.requestedBy);
    const stream = await this.stream(bridgedTrack);
    return stream;
  }

  private parseURL(link: string): { token: string; type: string } {
    const regex = /https?:\/\/(?:www\.)?jiosaavn\.com\/(featured|artist|song|album)\/([^/?#]+)/;
    const match = regex.exec(link);
    if (!match) {
      return { token: "", type: "" };
    }
    return { type: match[1], token: match[2] };
  }

  private async fetchAPI(params: Record<string, string | number>): Promise<any | null> {
    const apiBase = "https://www.jiosaavn.com/api.php";
    const defaultParams = "includeMetaTags=0&ctx=wap6dot0&api_version=4&_format=json&_marker=0";
    const url = `${apiBase}?${Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&")}&${defaultParams}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        return null;
      }
      return await resp.json();
    } catch {
      return null;
    }
  }

  private buildTrack(data: any, requestedBy: any, playlist?: Playlist): Track {
    const track = new Track(this.context.player, {
      author: data.more_info.artistMap.primary_artists.map((a: any) => a.name).join(", "),
      duration: Util.formatDuration(data.more_info.duration),
      playlist,
      raw: data,
      requestedBy,
      source: "arbitrary",
      thumbnail: data.image?.replace(/\b(50x50|150x150)\b/, "500x500"),
      title: data.title,
      url: data.perma_url,
      views: data.play_count,
    });

    return track;
  }
}
