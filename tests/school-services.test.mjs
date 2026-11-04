import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const student='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222',teacher='33333333-3333-4333-8333-333333333333',admin='44444444-4444-4444-8444-444444444444';
test('school services enforce server-side permissions and private sharing',async t=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create table public.explorer_profiles(user_id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;create function public.explorer_touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;insert into auth.users(id) values('${student}'),('${other}'),('${teacher}'),('${admin}');insert into public.explorer_profiles values('${student}'),('${other}');`);
 await db.exec(await readFile(new URL('../supabase/migrations/202611040001_preparedness_school.sql',import.meta.url),'utf8'));
 await db.exec(`insert into explorer_staff values('${admin}','admin','Owner'),('${teacher}','teacher','Teacher');`);
 async function asUser(id,sql,params=[],role='authenticated'){await db.exec('begin');try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']);await db.exec(`set local role ${role}`);const result=await db.query(sql,params);await db.exec('commit');return result;}catch(e){await db.exec('rollback');throw e;}}
 await t.test('students cannot grant themselves staff access or publish notices',async()=>{
  await assert.rejects(asUser(student,'insert into explorer_staff values($1,\'admin\',\'Fake\')',[student]),/row-level security/);
  await assert.rejects(asUser(student,"insert into explorer_notices(title,body,severity) values('Fake','Unsafe claim','urgent')"),/row-level security/);
  await assert.rejects(asUser(teacher,'insert into explorer_staff values($1,\'admin\',\'Fake\')',[other]),/row-level security/);
 });
 await t.test('published notices are public and archived notices are staff-only',async()=>{
  const {rows}=await asUser(teacher,"insert into explorer_notices(title,body,severity) values('Drill','Follow staff','information') returning id");
  assert.equal((await asUser(null,'select * from explorer_notices',[],'anon')).rows.length,1);
  await asUser(teacher,'update explorer_notices set active=false where id=$1',[rows[0].id]);
  assert.equal((await asUser(null,'select * from explorer_notices',[],'anon')).rows.length,0);
 });
 await t.test('reports are private; only staff can change review status',async()=>{
  const {rows}=await asUser(student,"insert into explorer_reports(kind,description,location) values('help','Need staff assistance','Library') returning id");
  assert.equal((await asUser(other,'select * from explorer_reports')).rows.length,0);
  assert.equal((await asUser(teacher,'select * from explorer_reports')).rows.length,1);
  assert.equal((await asUser(student,"update explorer_reports set status='resolved' returning id")).rows.length,0);
  await assert.rejects(asUser(student,"insert into explorer_reports(kind,description,location,status) values('help','Bad','Room','resolved')"),/permission denied/);
  await asUser(teacher,"update explorer_reports set status='reviewing' where id=$1",[rows[0].id]);
 });
 await t.test('shared learning is owner-writable and visible only to staff or owner',async()=>{
  await asUser(student,"insert into explorer_learning_records(user_id,display_name,earthquake,checklist) values($1,'Learner',3,array['plan']) on conflict(user_id) do update set user_id=excluded.user_id,earthquake=excluded.earthquake",[student]);
  assert.equal((await asUser(other,'select * from explorer_learning_records')).rows.length,0);
  assert.equal((await asUser(teacher,'select points from explorer_learning_records')).rows[0].points,35);
  await assert.rejects(asUser(student,"update explorer_learning_records set checklist=array['plan','plan']"),/check constraint/);
  await assert.rejects(asUser(student,'update explorer_learning_records set user_id=$1',[other]),/row-level security/);
  await asUser(student,'delete from explorer_learning_records');assert.equal((await asUser(teacher,'select * from explorer_learning_records')).rows.length,0);
 });
 await t.test('students cannot approve their own community posts',async()=>{
  await asUser(student,"insert into explorer_community(kind,body) values('offer','School supplies')");
  assert.equal((await asUser(other,'select * from explorer_community')).rows.length,0);
  assert.equal((await asUser(student,"update explorer_community set status='approved' returning id")).rows.length,0);
  await asUser(teacher,"update explorer_community set status='approved'");assert.equal((await asUser(other,'select * from explorer_community')).rows.length,1);
 });
 await t.test('participants cannot forge another account attendance',async()=>{
  const {rows}=await asUser(teacher,"insert into explorer_drills(title,location,scheduled_at) values('Drill','Approved assembly','2026-12-01T10:00:00Z') returning id");
  await asUser(student,"insert into explorer_drill_participants(user_id,drill_id,status) values($1,$2,'planned') on conflict(user_id,drill_id) do update set user_id=excluded.user_id,drill_id=excluded.drill_id,status=excluded.status",[student,rows[0].id]);
  await assert.rejects(asUser(student,"insert into explorer_drill_participants(user_id,drill_id,status) values($1,$2,'attended')",[other,rows[0].id]),/row-level security/);
 });
 await t.test('only admins configure recipients; clients cannot invent verified donations',async()=>{
  await assert.rejects(asUser(teacher,"insert into explorer_campaigns(title,recipient,wallet) values('Campaign','School','11111111111111111111111111111111')"),/row-level security/);
  await asUser(admin,"insert into explorer_campaigns(title,recipient,wallet) values('Campaign','School','11111111111111111111111111111111')");
  await assert.rejects(asUser(admin,"insert into explorer_donations(signature,user_id,campaign_id,lamports,confirmed_at) select repeat('1',88),$1,id,100,now() from explorer_campaigns",[admin]),/permission denied/);
  assert.ok((await asUser(admin,'select * from explorer_audit')).rows.length>0);
  assert.equal((await asUser(student,'select * from explorer_audit')).rows.length,0);
  assert.equal((await asUser(student,'select * from explorer_admin_roster()')).rows.length,0);
  assert.equal((await asUser(admin,'select * from explorer_admin_roster()')).rows.length,2);
 });
 await t.test('contacts and geographic map notices require staff authority and expire for students',async()=>{
  await assert.rejects(asUser(student,"insert into explorer_school_settings(contact_name,contact_phone) values('Fake','123456789')"),/row-level security/);
  await asUser(admin,"insert into explorer_school_settings(contact_name,contact_phone) values('School office','+639123456789')");
  assert.equal((await asUser(null,'select * from explorer_school_settings',[],'anon')).rows.length,1);
  await assert.rejects(asUser(admin,"update explorer_school_settings set contact_phone='javascript:alert(1)'"),/check constraint/);
  await assert.rejects(asUser(student,"insert into explorer_geo_zones(label,kind,lat,lon,radius,expires_at) values('Fake','hazard',14,121,100,now()+interval '1 day')"),/row-level security/);
  await db.exec("insert into explorer_geo_zones(label,kind,lat,lon,radius,created_at,expires_at) values('Expired','hazard',14,121,100,now()-interval '2 days',now()-interval '1 day')");
  assert.equal((await asUser(student,'select * from explorer_geo_zones')).rows.length,0);
  assert.equal((await asUser(teacher,'select * from explorer_geo_zones')).rows.length,1);
 });
 await t.test('verified receipts are unique and visible only to submitter and administrators',async()=>{
  await asUser(null,"insert into explorer_donations(signature,user_id,campaign_id,lamports,confirmed_at) select repeat('1',88),$1,id,100,now() from explorer_campaigns",[student],'service_role');
  assert.equal((await asUser(student,'select * from explorer_donations')).rows.length,1);
  assert.equal((await asUser(other,'select * from explorer_donations')).rows.length,0);
  assert.equal((await asUser(teacher,'select * from explorer_donations')).rows.length,0);
  assert.equal((await asUser(admin,'select * from explorer_donations')).rows.length,1);
  await assert.rejects(asUser(null,"insert into explorer_donations(signature,user_id,campaign_id,lamports,confirmed_at) select repeat('1',88),$1,id,100,now() from explorer_campaigns",[other],'service_role'),/duplicate key/);
 });
 await db.close();
});
