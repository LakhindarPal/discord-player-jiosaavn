# Discord Player Jiosaavn

discord-player-jiosaavn is a Jiosaavn platform plugin for discord-player

# Installation

```bash
$ npm install discord-player-jiosaavn
```

# Register the extractor

```ts
import { JiosaavnExtractor } from "discord-player-jiosaavn"
import { Player } from "discord-player"

const player = new Player(...)

await player.extractors.register(JiosaavnExtractor)
```
