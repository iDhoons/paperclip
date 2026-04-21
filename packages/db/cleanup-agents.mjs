import postgres from "postgres";

const sql = postgres({ host: "127.0.0.1", port: 54329, database: "paperclip", username: "paperclip", password: process.env.PGPASSWORD });

const ids = [
  "5480eaf6-627d-4df2-b31f-98b59c74a6bc",
  "963843e8-f3d5-4a27-8403-eae50cfb3218",
  "4099327c-5057-43e8-8b35-6ba78b325c3e",
  "ba6386aa-e161-4ff5-973d-def394826270",
];

for (const id of ids) {
  await sql`UPDATE issues SET assignee_agent_id = NULL WHERE assignee_agent_id = ${id}`;
  await sql`UPDATE issues SET created_by_agent_id = NULL WHERE created_by_agent_id = ${id}`;
  await sql`UPDATE issue_comments SET author_agent_id = NULL WHERE author_agent_id = ${id}`;
  await sql`UPDATE approvals SET requested_by_agent_id = NULL WHERE requested_by_agent_id = ${id}`;
  await sql`UPDATE approval_comments SET author_agent_id = NULL WHERE author_agent_id = ${id}`;
  await sql`UPDATE goals SET owner_agent_id = NULL WHERE owner_agent_id = ${id}`;
  await sql`UPDATE assets SET created_by_agent_id = NULL WHERE created_by_agent_id = ${id}`;
  await sql`UPDATE join_requests SET created_agent_id = NULL WHERE created_agent_id = ${id}`;
  await sql`UPDATE finance_events SET agent_id = NULL WHERE agent_id = ${id}`;
  await sql`UPDATE activity_log SET agent_id = NULL WHERE agent_id = ${id}`;
  await sql`UPDATE projects SET lead_agent_id = NULL WHERE lead_agent_id = ${id}`;
  await sql`DELETE FROM routine_runs WHERE routine_id IN (SELECT id FROM routines WHERE assignee_agent_id = ${id})`;
  await sql`DELETE FROM routine_triggers WHERE routine_id IN (SELECT id FROM routines WHERE assignee_agent_id = ${id})`;
  await sql`DELETE FROM routines WHERE assignee_agent_id = ${id}`;
  await sql`DELETE FROM cost_events WHERE agent_id = ${id}`;
  await sql`DELETE FROM heartbeat_run_events WHERE agent_id = ${id}`;
  await sql`DELETE FROM agent_task_sessions WHERE agent_id = ${id}`;
  await sql`UPDATE activity_log SET run_id = NULL WHERE run_id IN (SELECT id FROM heartbeat_runs WHERE agent_id = ${id})`;
  await sql`DELETE FROM heartbeat_runs WHERE agent_id = ${id}`;
  await sql`DELETE FROM agent_wakeup_requests WHERE agent_id = ${id}`;
  await sql`DELETE FROM agent_api_keys WHERE agent_id = ${id}`;
  await sql`DELETE FROM agent_runtime_state WHERE agent_id = ${id}`;
  await sql`UPDATE agents SET reports_to = NULL WHERE reports_to = ${id}`;
  const del = await sql`DELETE FROM agents WHERE id = ${id} RETURNING name`;
  console.log(`${del[0]?.name ?? "?"}: deleted`);
}

const left = await sql`SELECT name, status FROM agents ORDER BY name`;
console.log("\nRemaining:");
for (const r of left) console.log(`  ${r.name} (${r.status})`);
await sql.end();
