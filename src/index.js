const { runDailyRadar } = require('./radarEngine');
const { getMasterStats, resetDatabase } = require('./utils/masterDb');

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--reset-db')) {
    resetDatabase();
    return;
  }

  if (args.includes('--stats')) {
    const stats = getMasterStats();
    console.log("\n============================================================");
    console.log("       NEW INDIE LIVE 24 — MASTER CATALOG STATS             ");
    console.log("============================================================");
    console.log(`Database Path:       ${stats.databasePath}`);
    console.log(`Total Unique Songs:  ${stats.totalUniqueSongs}`);
    console.log(`Total Sightings:     ${stats.totalSightings}`);
    console.log(`Consensus (2+ Heat): ${stats.consensusSongsCount}`);
    console.log("============================================================\n");
    return;
  }

  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  const isUS = args.includes('--us') || args.includes('-u');
  const market = isUS ? 'US' : 'GLOBAL';

  await runDailyRadar({ dryRun: isDryRun, market });
}

main().catch(err => {
  console.error("[Fatal Error]", err);
  process.exit(1);
});
