// Needs the seeded database (npm run seed): Acme is org_demo, Northwind is the second organisation.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { forOrg } from "../../src/server/tenant";
import { rootDb } from "../../src/server/db";

const ACME = "org_demo";
const NORTHWIND = "org_northwind";
after(() => rootDb.$disconnect());

test("reads only ever return the organisation's own rows", async () => {
  const nw = forOrg(NORTHWIND);
  const questions = await nw.question.findMany();
  assert.ok(questions.length > 0);
  assert.ok(questions.every((q) => q.orgId === NORTHWIND));
  assert.equal(await nw.question.findUnique({ where: { id: "q-excel" } }), null);
  assert.equal(await nw.project.findFirst({ where: { id: "p-ai-invoice" } }), null);
  assert.equal(await nw.question.count({ where: { id: "q-excel" } }), 0);
  const users = await nw.user.findMany();
  assert.ok(users.every((u) => u.orgId === NORTHWIND));
  // An explicit orgId in the query can't widen it.
  assert.equal(await nw.project.findFirst({ where: { id: "p-ai-invoice", orgId: ACME } }), null);
});

test("writes can't reach another organisation's rows", async () => {
  const nw = forOrg(NORTHWIND);
  await assert.rejects(nw.project.update({ where: { id: "p-ai-invoice" }, data: { title: "Hijacked" } }));
  const { count } = await nw.project.updateMany({ where: { id: "p-ai-invoice" }, data: { title: "Hijacked" } });
  assert.equal(count, 0);
  const { count: deleted } = await nw.question.deleteMany({ where: { id: "q-excel" } });
  assert.equal(deleted, 0);
  assert.equal((await rootDb.project.findUnique({ where: { id: "p-ai-invoice" } }))!.title, "AI Invoice Assistant");
});

test("creates are stamped with the organisation, even if another is passed", async () => {
  const nw = forOrg(NORTHWIND);
  const topic = await nw.topic.create({ data: { name: `Unit test ${Date.now()}`, orgId: ACME } as never });
  try {
    assert.equal(topic.orgId, NORTHWIND);
    assert.equal(await forOrg(ACME).topic.findUnique({ where: { id: topic.id } }), null);
  } finally {
    await rootDb.topic.delete({ where: { id: topic.id } });
  }
});

test("forOrg refuses an empty organisation", () => {
  assert.throws(() => forOrg(""));
});
