import { closeDb } from "@/db";
import { cleanupMediaStorage, runMediaWorker } from "@/lib/media/worker";

try {
  const worker = await runMediaWorker("manual-media-worker", 2);
  const cleanup = await cleanupMediaStorage(new Date(), 20);
  console.log(JSON.stringify({ worker, cleanup }));
} finally {
  await closeDb();
}
