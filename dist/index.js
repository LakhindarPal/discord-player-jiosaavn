"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  JiosaavnExtractor: () => JiosaavnExtractor
});
module.exports = __toCommonJS(index_exports);

// src/JiosaavnExtractor.ts
var import_discord_player = require("discord-player");
var JiosaavnExtractor = class extends import_discord_player.BaseExtractor {
  constructor() {
    super(...arguments);
    this.createBridgeQuery = (track) => `${track.title} by ${track.author}`;
  }
  async activate() {
    this.protocols = ["jssearch", "jiosaavn"];
  }
  async deactivate() {
    this.protocols = [];
  }
  async validate(query) {
    const { type } = this.parseURL(query);
    return Boolean(type);
  }
  async handle(query, context) {
    const { type, token } = this.parseURL(query);
    if (context.protocol === "jssearch" || type === "song") {
      let data;
      if (type === "song") {
        const raw = await this.fetchAPI({
          __call: "webapi.get",
          token,
          type
        });
        data = raw?.songs[0];
      } else {
        const raw = await this.fetchAPI({
          __call: "search.getResults",
          n: 1,
          p: 1,
          q: query
        });
        data = raw?.results[0];
      }
      if (!data) {
        return this.createResponse();
      }
      const track = this.buildTrack(data, context.requestedBy);
      return this.createResponse(null, [track]);
    } else {
      let params = {
        __call: "webapi.get",
        token,
        type: type === "featured" ? "playlist" : type
      };
      if (type === "artist") {
        params = {
          ...params,
          category: "",
          n_album: 1,
          n_song: 50,
          p: 0,
          sort_order: "",
          sub_type: ""
        };
      }
      if (type === "featured") {
        params = {
          ...params,
          n: 50,
          p: 1
        };
      }
      const data = await this.fetchAPI(params);
      if (!data) {
        return this.createResponse();
      }
      const artistsData = type === "playlist" ? data.more_info.artists : data.more_info.artistMap.primary_artists;
      const playlist = new import_discord_player.Playlist(this.context.player, {
        author: {
          name: type === "artist" ? data.name : artistsData.map((a) => a.name).join(", "),
          url: ""
        },
        description: data.header_desc || "",
        id: type === "artist" ? data.artistId : data.id,
        rawPlaylist: data,
        source: "arbitrary",
        thumbnail: data.image?.replace(/\b(50x50|150x150)\b/, "500x500"),
        title: type === "artist" ? data.name : data.title,
        tracks: [],
        type: data.type,
        url: type === "artist" ? data.urls.overview : data.perma_url
      });
      const trackList = type === "artist" ? data.topSongs : data.list || [];
      playlist.tracks = trackList.map(
        (info) => this.buildTrack(info, context.requestedBy, playlist)
      );
      return this.createResponse(playlist, playlist.tracks);
    }
  }
  async stream(track) {
    const data = await this.fetchAPI({
      __call: "song.generateAuthToken",
      bitrate: 128,
      url: track.raw.more_info.encrypted_media_url
    });
    if (!data || !data.auth_url) {
      return "";
    }
    const stream = data.auth_url.split("?")[0].replace("ac.cf.saavncdn.com", "aac.saavncdn.com");
    return stream;
  }
  async getRelatedTracks(track) {
    const data = await this.fetchAPI({
      __call: "reco.getreco",
      pid: track.raw.id
    });
    if (!data) {
      return this.createResponse();
    }
    const tracks = data.map((info) => this.buildTrack(info, track.requestedBy));
    return this.createResponse(null, tracks);
  }
  async bridge(track) {
    const query = `${track.author} ${track.source === "youtube" ? track.cleanTitle : track.title}`;
    const raw = await this.fetchAPI({
      __call: "search.getResults",
      n: 1,
      p: 1,
      q: query
    });
    const data = raw?.results[0];
    if (!data) {
      return null;
    }
    const bridgedTrack = this.buildTrack(data, track.requestedBy);
    const stream = await this.stream(bridgedTrack);
    return stream;
  }
  parseURL(link) {
    const regex = /https?:\/\/(?:www\.)?jiosaavn\.com\/(featured|artist|song|album)\/([^/?#]+)/;
    const match = regex.exec(link);
    if (!match) {
      return { token: "", type: "" };
    }
    return { type: match[1], token: match[2] };
  }
  async fetchAPI(params) {
    const apiBase = "https://www.jiosaavn.com/api.php";
    const defaultParams = "includeMetaTags=0&ctx=wap6dot0&api_version=4&_format=json&_marker=0";
    const url = `${apiBase}?${Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}&${defaultParams}`;
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
  buildTrack(data, requestedBy, playlist) {
    const track = new import_discord_player.Track(this.context.player, {
      author: data.more_info.artistMap.primary_artists.map((a) => a.name).join(", "),
      duration: import_discord_player.Util.formatDuration(data.more_info.duration),
      playlist,
      raw: data,
      requestedBy,
      source: "arbitrary",
      thumbnail: data.image?.replace(/\b(50x50|150x150)\b/, "500x500"),
      title: data.title,
      url: data.perma_url,
      views: data.play_count
    });
    return track;
  }
};
JiosaavnExtractor.identifier = "dp.lpal.jiosaavn";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  JiosaavnExtractor
});
