import { readFile, writeFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
// This parses a trusted, checked-in JS constant, never a Drive file or imported text.
const literal = source.match(/export const SEED_QUESTIONS = (\[[\s\S]*?\n {4}\]);/);
if (!literal) throw new Error('Legacy seed array not found');
const seed = runInNewContext(literal[1], Object.create(null), { timeout: 100 });
const external = JSON.parse(await readFile(new URL('../questions.json', import.meta.url), 'utf8'));
const approved = JSON.parse(await readFile(new URL('../data/approved-content.json', import.meta.url), 'utf8'));
const publication = JSON.parse(await readFile(new URL('../docs/content-publication-report.json', import.meta.url), 'utf8'));
const all = [...seed, ...external];
const groups = new Map();
for (const q of all) {
  // Candidate detection only: matching answer/options is not a completed semantic audit.
  const key = JSON.stringify([q.topic, [...q.opts].sort(), q.opts[q.ans]]);
  groups.set(key, [...(groups.get(key) || []), q.id]);
}
const report = {
  schemaVersion: 1, status: approved.questions.length ? 'PartialContentAvailable' : 'Prototype',
  legacySeedRecords: seed.length, externalRecords: external.length,
  combinedRecordsById: new Set(all.map(q => String(q.id))).size,
  originalQuestionTarget: 5400, generatedThisPhase: publication.generated,
  sourceVerifiedQuestions: publication.approved, approvedQuestions: approved.questions.length,
  pendingNewQuestions: publication.pending,
  rejectedQuestions: 0, pendingLegacyRecords: all.length,
  duplicateCandidates: [...groups.values()].filter(ids => ids.length > 1),
  semanticAudit: 'NotCompletedForWholeBank', newPackageIndependentReview: { status: 'CompletedForPublishedPreparationContent', count: publication.approved }, historicalAccepted: 0, historicalReview: '9OfficialBooklets480AnswerMatchesRightsScopePending',
  finalContentAcceptance: false,
};
await writeFile(new URL('../docs/content-audit.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
