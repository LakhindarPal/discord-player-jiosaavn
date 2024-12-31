import { BaseExtractor, Track, ExtractorSearchContext, ExtractorInfo, ExtractorStreamable } from 'discord-player';

declare class JiosaavnExtractor extends BaseExtractor {
    static identifier: string;
    createBridgeQuery: (track: Track) => string;
    activate(): Promise<void>;
    deactivate(): Promise<void>;
    validate(query: string): Promise<boolean>;
    handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo>;
    stream(track: Track): Promise<ExtractorStreamable | string>;
    getRelatedTracks(track: Track): Promise<ExtractorInfo>;
    bridge(track: Track): Promise<ExtractorStreamable | null>;
    private parseURL;
    private fetchAPI;
    private buildTrack;
}

export { JiosaavnExtractor };
