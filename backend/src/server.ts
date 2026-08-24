import "dotenv/config";
import app from "./app";
import { sweepNoShows } from "./services/noShowService";

const PORT = process.env.PORT || 4000;

const NO_SHOW_SWEEP_INTERVAL_MS = 60 * 1000;

async function runScheduledNoShowSweep() {
  try {
    const swept = await sweepNoShows();
    if (swept > 0) console.log(`No-show sweep marked ${swept} appointment(s).`);
  } catch (error) {
    console.error("Scheduled no-show sweep failed:", error);
  }
}

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
  void runScheduledNoShowSweep();
  const timer = setInterval(runScheduledNoShowSweep, NO_SHOW_SWEEP_INTERVAL_MS);
  timer.unref();
});
