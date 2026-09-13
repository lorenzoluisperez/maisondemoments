import { ensureMediaBuckets } from "@/lib/media/storage";

await ensureMediaBuckets();
console.log("Private media buckets are configured");
