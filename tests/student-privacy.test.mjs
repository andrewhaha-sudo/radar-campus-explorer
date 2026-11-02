import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";

test("student database enforces ownership, private defaults, field sharing and private photo access", async (t) => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth, storage to anon, authenticated;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id bigint generated always as identity primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant usage on sequence storage.objects_id_seq to authenticated;
    insert into auth.users values ('${alice}'),('${bob}');
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202611020001_student_profiles.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const privileges = await db.query(`select
    has_table_privilege('authenticated','public.explorer_profiles','TRUNCATE') as truncate,
    has_table_privilege('authenticated','public.explorer_profiles','DELETE') as delete,
    has_table_privilege('anon','public.explorer_profiles','SELECT') as anonymous_read`);
  assert.deepEqual(privileges.rows[0], { truncate: false, delete: false, anonymous_read: false });
  const asUser = async (id, run, role = "authenticated") => {
    await db.exec("begin");
    try {
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [
        id ?? "",
      ]);
      await db.exec(`set local role ${role}`);
      const result = await run();
      await db.exec("commit");
      return result;
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  };
  await asUser(alice, () =>
    db.query(
      "insert into public.explorer_profiles(user_id,name,grade,section,teacher,sex) values ($1,'Alice','Grade 10','Emerald','Ms. Santos','Female')",
      [alice],
    ),
  );
  await asUser(bob, () =>
    db.query(
      "insert into public.explorer_profiles(user_id,name) values ($1,'Bob')",
      [bob],
    ),
  );

  await t.test(
    "a different account cannot read or overwrite the raw student row",
    async () => {
      const read = await asUser(bob, () =>
        db.query("select * from public.explorer_profiles where user_id=$1", [
          alice,
        ]),
      );
      assert.equal(read.rows.length, 0);
      const update = await asUser(bob, () =>
        db.query(
          "update public.explorer_profiles set name='Impostor' where user_id=$1 returning user_id",
          [alice],
        ),
      );
      assert.equal(update.rows.length, 0);
      await assert.rejects(
        asUser(bob, () =>
          db.query(
            "insert into public.explorer_presence(user_id,scene,x,y,direction) values ($1,'campus',387,785,'down')",
            [alice],
          ),
        ),
        /row-level security/,
      );
      await assert.rejects(
        asUser(bob, () =>
          db.query(
            "update public.explorer_profiles set user_id=$1 where user_id=$2",
            [alice, bob],
          ),
        ),
        /row-level security/,
      );
    },
  );
  await t.test(
    "anonymous requests cannot call profile lookup or list students",
    async () => {
      await assert.rejects(
        asUser(
          null,
          () => db.query("select public.get_explorer_student($1)", [alice]),
          "anon",
        ),
        /permission denied/,
      );
      await assert.rejects(
        asUser(
          null,
          () => db.query("select * from public.list_explorer_students()"),
          "anon",
        ),
        /permission denied/,
      );
    },
  );
  await t.test(
    "profiles start hidden and photos are private even after character sharing",
    async () => {
      const hidden = await asUser(bob, () =>
        db.query("select public.get_explorer_student($1) as profile", [alice]),
      );
      assert.equal(hidden.rows[0].profile, null);
      await asUser(alice, () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values ('explorer-student-photos',$1)",
          [`${alice}/portrait.webp`],
        ),
      );
      await asUser(alice, () =>
        db.query(
          "update public.explorer_profiles set sharing=true,photo_available=true where user_id=$1",
          [alice],
        ),
      );
      const shared = await asUser(bob, () =>
        db.query("select public.get_explorer_student($1) as profile", [alice]),
      );
      for (const field of ["name", "grade", "section", "teacher", "sex"])
        assert.equal(shared.rows[0].profile[field], null);
      assert.equal(shared.rows[0].profile.photo_available, false);
      const privatePhoto = await asUser(bob, () =>
        db.query("select * from storage.objects"),
      );
      assert.equal(privatePhoto.rows.length, 0);
      const ownPhoto = await asUser(alice, () =>
        db.query("select * from storage.objects"),
      );
      assert.equal(ownPhoto.rows.length, 1);
    },
  );
  await t.test(
    "only selected fields and photos become readable; hiding revokes access",
    async () => {
      await asUser(alice, () =>
        db.query(
          `update public.explorer_profiles set visibility=jsonb_set(jsonb_set(visibility,'{name}','true'),'{photo}','true') where user_id=$1`,
          [alice],
        ),
      );
      const visible = await asUser(bob, () =>
        db.query("select public.get_explorer_student($1) as profile", [alice]),
      );
      assert.equal(visible.rows[0].profile.name, "Alice");
      assert.equal(visible.rows[0].profile.grade, null);
      assert.equal(visible.rows[0].profile.photo_available, true);
      assert.equal(
        Object.keys(visible.rows[0].profile).some((key) =>
          /url|path|visibility|email/.test(key),
        ),
        false,
      );
      assert.equal(
        (await asUser(bob, () => db.query("select * from storage.objects")))
          .rows.length,
        1,
      );
      await asUser(alice, () =>
        db.query(
          "update public.explorer_profiles set photo_available=false where user_id=$1",
          [alice],
        ),
      );
      assert.equal(
        (await asUser(bob, () => db.query("select * from storage.objects")))
          .rows.length,
        0,
      );
    },
  );
  await t.test(
    "photo writes and deletion are owner-only and allow only the single portrait object",
    async () => {
      await assert.rejects(
        asUser(bob, () =>
          db.query(
            "insert into storage.objects(bucket_id,name) values ('explorer-student-photos',$1)",
            [`${alice}/portrait.webp`],
          ),
        ),
        /row-level security/,
      );
      await assert.rejects(
        asUser(alice, () =>
          db.query(
            "insert into storage.objects(bucket_id,name) values ('explorer-student-photos',$1)",
            [`${alice}/private-extra.webp`],
          ),
        ),
        /row-level security/,
      );
      assert.equal(
        (
          await asUser(bob, () =>
            db.query("delete from storage.objects returning id"),
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await asUser(alice, () =>
            db.query("delete from storage.objects returning id"),
          )
        ).rows.length,
        1,
      );
      const bucket = await db.query(
        "select public,allowed_mime_types,file_size_limit from storage.buckets",
      );
      assert.equal(bucket.rows[0].public, false);
      assert.deepEqual(bucket.rows[0].allowed_mime_types, ["image/webp"]);
    },
  );
  await t.test(
    "other characters have real account IDs and stale presence disappears",
    async () => {
      await asUser(alice, () =>
        db.query(
          "insert into public.explorer_presence(user_id,scene,x,y,direction) values ($1,'campus',430,480,'down')",
          [alice],
        ),
      );
      const peers = await asUser(bob, () =>
        db.query("select * from public.list_explorer_students()"),
      );
      assert.equal(peers.rows.length, 1);
      assert.equal(peers.rows[0].user_id, alice);
      assert.equal(peers.rows[0].name, "Alice");
      assert.equal(
        (
          await asUser(alice, () =>
            db.query("select * from public.list_explorer_students()"),
          )
        ).rows.length,
        0,
      );
      await db.exec(
        "alter table public.explorer_presence disable trigger explorer_presence_timestamp",
      );
      await db.query(
        "update public.explorer_presence set updated_at=now()-interval '31 seconds' where user_id=$1",
        [alice],
      );
      assert.equal(
        (
          await asUser(bob, () =>
            db.query("select * from public.list_explorer_students()"),
          )
        ).rows.length,
        0,
      );
    },
  );
  await db.close();
});
