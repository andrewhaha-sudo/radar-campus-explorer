import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, parseProgress, recordScore, learningPoints, progressExport } from '../src/lib/preparedness.ts';
test('repeat attempts preserve the best score without farming points',()=>{
 let p=recordScore(emptyProgress(),'earthquake',2);
 p=recordScore(p,'earthquake',1); p=recordScore(p,'earthquake',2);
 assert.equal(learningPoints(p),20);
 p=recordScore(p,'earthquake',3); assert.equal(learningPoints(p),30);
 assert.deepEqual(recordScore(p,'unknown',3),p);
 assert.deepEqual(recordScore(p,'fire',4),p);
});
test('stored progress sanitizes unknown scores and duplicate checklist entries',()=>{
 const p=parseProgress(JSON.stringify({version:1,best:{earthquake:300,fire:2,flood:-1,other:10},checked:['plan','plan','unknown']}));
 assert.deepEqual(p,{version:1,best:{fire:2},checked:['plan']});
 assert.equal(learningPoints(p),25);
 assert.throws(()=>parseProgress('{'));
 assert.throws(()=>parseProgress(JSON.stringify({version:2,best:{},checked:[]})));
});
test('export has self-reported scores and no account or location fields',()=>{
 const record=progressExport(recordScore(emptyProgress(),'flood',0));
 assert.equal(record.quizzes[1].bestScore,0);
 assert.equal(record.quizzes[0].bestScore,null);
 assert.equal(record.points,0);
 assert.match(record.notice,/not a safety certification/);
 assert.deepEqual(Object.keys(record).sort(),['application','drillChecklist','notice','points','quizzes','type','version']);
});
