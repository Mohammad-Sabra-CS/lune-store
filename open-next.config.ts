import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";

const config = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: doShardedTagCache({ baseShardSize: 1 }),
});

// CF-0 only: compile local fixtures without invoking the deployment migrator.
// CF-1 must supply an isolated Neon branch and a reviewed migration pipeline.
config.buildCommand = "node node_modules/next/dist/bin/next build";

export default config;
