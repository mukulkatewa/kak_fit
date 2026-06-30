import { config } from "dotenv";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../../.env") });

import { createHevyClient } from "./hevy-api-client";
import { loadSyncState } from "./sync-log";

async function main() {
  const { prisma } = await import("../../src/index");
  const client = createHevyClient();

  const hevyTemplates = await client.paginate<{
    id: string;
    title: string;
    is_custom: boolean;
  }>("/v1/exercise_templates", "exercise_templates", 100);

  const globalHevy = hevyTemplates.filter((t) => !t.is_custom);
  const customCount = hevyTemplates.length - globalHevy.length;
  const hevyIdsInApi = new Set(globalHevy.map((t) => t.id));

  const withHevyId = await prisma.exercise.findMany({
    where: { hevyId: { not: null }, isCustom: false },
    include: { muscles: true, category: true },
  });

  const dbHevyIds = new Set(withHevyId.map((e) => e.hevyId!));
  const missingFromDb = globalHevy.filter((t) => !dbHevyIds.has(t.id));

  const linkedOnWger = await prisma.exercise.count({
    where: { hevyId: { not: null }, wgerId: { not: null }, isCustom: false },
  });
  const hevyOnly = await prisma.exercise.count({
    where: { hevyId: { not: null }, wgerId: null, isCustom: false },
  });

  const issues: string[] = [];

  for (const ex of withHevyId) {
    if (!ex.name?.trim()) issues.push(`${ex.hevyId}: missing name`);
    if (ex.muscles.length === 0) issues.push(`${ex.hevyId} "${ex.name}": no muscles linked`);
    if (!ex.categoryId) issues.push(`${ex.hevyId} "${ex.name}": no category`);
  }

  const syncState = await loadSyncState();
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Hevy Import Report</title>
<style>body{font-family:system-ui;max-width:720px;margin:2rem auto;padding:0 1rem}
.ok{color:green}.warn{color:#b45309}.err{color:#dc2626}table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body>
<h1>Hevy Catalog Verification</h1>
<p>Generated ${new Date().toISOString()}</p>
<table>
<tr><th>Metric</th><th>Value</th></tr>
<tr><td>Hevy API (all)</td><td>${hevyTemplates.length}</td></tr>
<tr><td>Hevy global templates</td><td>${globalHevy.length}</td></tr>
<tr><td>Hevy custom (skipped)</td><td>${customCount}</td></tr>
<tr><td>DB rows with hevyId</td><td>${withHevyId.length}</td></tr>
<tr><td>Linked on Wger rows</td><td>${linkedOnWger}</td></tr>
<tr><td>Hevy-only rows</td><td>${hevyOnly}</td></tr>
<tr><td>Distinct hevyIds in DB</td><td>${dbHevyIds.size}</td></tr>
<tr><td>Missing from DB</td><td class="${missingFromDb.length ? "warn" : "ok"}">${missingFromDb.length}</td></tr>
<tr><td>Data issues</td><td class="${issues.length ? "err" : "ok"}">${issues.length}</td></tr>
</table>
${missingFromDb.length ? `<p class="warn">${missingFromDb.length} Hevy templates not stored as hevyId — usually duplicate names merged onto one Wger row after <code>pnpm merge:hevy</code>.</p>` : ""}
<h2>Sync state</h2>
<pre>${JSON.stringify(syncState, null, 2)}</pre>
${issues.length ? `<h2>Issues</h2><ul>${issues.map((i) => `<li>${i}</li>`).join("")}</ul>` : "<p class='ok'>No data issues.</p>"}
</body></html>`;

  const reportPath = resolve(__dirname, "../../../../hevy-import-report.html");
  await writeFile(reportPath, html, "utf8");

  console.log("=== Hevy catalog verification ===\n");
  console.log(`Hevy API global:       ${globalHevy.length} (${customCount} custom skipped)`);
  console.log(`DB with hevyId:         ${withHevyId.length} (${linkedOnWger} on Wger, ${hevyOnly} Hevy-only)`);
  console.log(`Distinct hevyIds in DB: ${dbHevyIds.size}`);
  console.log(`Missing from DB:         ${missingFromDb.length}`);
  console.log(`Data issues:           ${issues.length}`);
  console.log(`Report:                ${reportPath}`);

  if (issues.length > 0) {
    issues.slice(0, 15).forEach((i) => console.log(`  - ${i}`));
    process.exit(1);
  }

  const coverage = dbHevyIds.size / globalHevy.length;
  if (coverage < 0.9) {
    console.log(`\n⚠ Low hevyId coverage (${Math.round(coverage * 100)}%). Run: pnpm import:hevy -- --force && pnpm merge:hevy`);
    process.exit(1);
  }

  if (missingFromDb.length > 0) {
    console.log(`\nNote: ${missingFromDb.length} Hevy IDs merged away (duplicate names → one Wger row).`);
  }

  console.log("\n✓ Hevy catalog verified.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
