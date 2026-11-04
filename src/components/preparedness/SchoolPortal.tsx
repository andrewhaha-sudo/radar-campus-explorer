import { useEffect, useState } from "react";
import { useStudentProfile } from "../student/student-context";
import {
  schoolRows,
  schoolWrite,
  removeSharedProgress,
  removeSchoolRow,
  verifyDonation,
  solanaPaymentLink,
} from "../../lib/school-services";
import type { SchoolRow } from "../../lib/school-services";
import {
  emptyProgress,
  parseProgress,
  learningPoints,
} from "../../lib/preparedness";
import { ConfirmAction } from "./ConfirmAction";

type Mode = "school" | "records" | "community" | "emergency" | "admin";
const tables: Record<Mode, string[]> = {
  school: [
    "notices",
    "drills",
    "drill_participants",
    "reports",
    "learning_records",
    "geo_zones",
  ],
  records: ["learning_records", "donations"],
  community: ["community", "campaigns"],
  emergency: ["school_settings", "reports"],
  admin: [
    "staff",
    "campaigns",
    "donations",
    "school_settings",
    "audit",
    "roster",
  ],
};
interface Field {
  name: string;
  label: string;
  type?: string;
  max?: number;
  options?: string[];
}
function EntryForm({
  title,
  fields,
  submit,
  pending,
}: {
  title: string;
  fields: Field[];
  submit: (v: Record<string, string>) => Promise<boolean>;
  pending: boolean;
}) {
  const [failure, setFailure] = useState("");
  return (
    <form
      className="school-form preparedness-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setFailure("");
        const values = Object.fromEntries(new FormData(form)) as Record<
          string,
          string
        >;
        try {
          if (await submit(values)) form.reset();
          else
            setFailure(
              "Nothing was saved. Review the service message above and try again.",
            );
        } catch {
          setFailure(
            "Check the entered values and try again. Nothing was saved.",
          );
        }
      }}
    >
      <h4>{title}</h4>
      {fields.map((field) => (
        <label key={field.name}>
          {field.label}
          {field.options ? (
            <select name={field.name}>
              {field.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              name={field.name}
              required
              maxLength={field.max ?? 2000}
            />
          ) : (
            <input
              name={field.name}
              type={field.type ?? "text"}
              step={field.type === "number" ? "any" : undefined}
              required
              maxLength={field.max ?? 120}
            />
          )}
        </label>
      ))}
      <button className="game-nav-button" disabled={pending}>
        {title}
      </button>
      {failure && <p role="alert">{failure}</p>}
    </form>
  );
}
export function SchoolPortal({
  mode,
  onSignIn,
}: {
  mode: Mode;
  onSignIn: () => void;
}) {
  const { user } = useStudentProfile();
  const userId = user?.id;
  const [now, setNow] = useState(() => Date.now());
  const [data, setData] = useState<Record<string, SchoolRow[]>>({});
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [local] = useState(() => {
    try {
      return {
        progress: parseProgress(
          localStorage.getItem(
            `campus-preparedness-v1:${user?.id ?? "device"}`,
          ),
        ),
        valid: true,
      };
    } catch {
      return { progress: emptyProgress(), valid: false };
    }
  });
  const staff = role === "teacher" || role === "admin";
  function refresh() {
    setLoading(true);
    setError("");
    setData({});
    setRole("");
    setRevision((x) => x + 1);
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = userId
          ? tables[mode]
          : tables[mode].filter(
              (t) => t === "notices" || t === "school_settings",
            );
        const results = await Promise.all(
          list.map(async (t) => [t, await schoolRows(t)] as const),
        );
        const members = userId
          ? list.includes("staff")
            ? (results.find(([t]) => t === "staff")?.[1] ?? [])
            : await schoolRows("staff")
          : [];
        if (active) {
          setNow(Date.now());
          setData(Object.fromEntries(results));
          setRole(members.find((r) => r.user_id === userId)?.role ?? "");
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "School service unavailable.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [mode, userId, revision]);
  async function perform(
    job: () => Promise<void>,
    success = "Saved to the school service.",
  ) {
    if (pending) return false;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await job();
      setNotice(success);
      refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      return false;
    } finally {
      setPending(false);
    }
  }
  const write = (
    table: string,
    values: Record<string, unknown>,
    id?: string,
    upsert = false,
  ) => perform(() => schoolWrite(table, values, id, upsert));
  const rows = (name: string) => data[name] ?? [];
  const contact = rows("school_settings")[0];
  return (
    <section className="school-portal" aria-label={`${mode} services`}>
      <div className="preparedness-actions">
        <button
          className="campus-secondary"
          disabled={loading || pending}
          onClick={refresh}
        >
          Refresh school data
        </button>
        {user && <span>Access: {role || "participant"}</span>}
      </div>
      {loading && <p role="status">Loading school data…</p>}
      {error && (
        <p className="preparedness-feedback" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!user && (
        <div className="preparedness-card">
          <p>
            Sign in with your standalone account to share records or use school
            services. Local learning remains available without an account.
          </p>
          <button className="game-nav-button" onClick={onSignIn}>
            Sign in to school services
          </button>
        </div>
      )}
      {mode === "school" && (
        <>
          <h3>School notices</h3>
          <p>
            School-authored notices, separate from government advisories. Use
            Refresh to check for updates; this is not an emergency
            push-notification service.
          </p>
          {!loading &&
            !error &&
            rows("notices").filter((n) => n.active).length === 0 && (
              <p>No active school notices.</p>
            )}
          {rows("notices")
            .filter((n) => n.active || staff)
            .map((n) => (
              <article className="preparedness-card" key={n.id}>
                <h4>{n.title}</h4>
                <p>
                  {n.severity} · {new Date(n.created_at).toLocaleString()} ·{" "}
                  {n.active ? "Active" : "Archived"}
                </p>
                <p>{n.body}</p>
                {staff && n.active && (
                  <ConfirmAction
                    label="Archive notice"
                    description="This removes the notice from the active school board."
                    disabled={pending}
                    onConfirm={() =>
                      void write("notices", { active: false }, n.id)
                    }
                  />
                )}
              </article>
            ))}
          {staff && (
            <EntryForm
              title="Publish school notice"
              pending={pending || loading}
              fields={[
                { name: "title", label: "Notice title" },
                { name: "body", label: "Notice text", type: "textarea" },
                {
                  name: "severity",
                  label: "Notice severity",
                  options: ["information", "advisory", "urgent"],
                },
              ]}
              submit={(v) => write("notices", v)}
            />
          )}
          <h3>Drill schedule</h3>
          {!loading && !error && !rows("drills").length && (
            <p>No drills scheduled.</p>
          )}
          {rows("drills")
            .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
            .map((d) => (
              <article className="preparedness-card" key={d.id}>
                <h4>{d.title}</h4>
                <p>
                  {new Date(d.scheduled_at).toLocaleString()} · {d.location}{" "}
                  {d.cancelled && "· Cancelled"}
                </p>
                {user && !d.cancelled && (
                  <>
                    <p>
                      Your participation:{" "}
                      {rows("drill_participants").find(
                        (p) => p.drill_id === d.id && p.user_id === user.id,
                      )?.status ?? "Not recorded"}
                      . Attendance is self-reported.
                    </p>
                    <button
                      className="game-nav-button"
                      disabled={pending}
                      onClick={() =>
                        void write(
                          "drill_participants",
                          {
                            user_id: user.id,
                            drill_id: d.id,
                            status: "planned",
                          },
                          undefined,
                          true,
                        )
                      }
                    >
                      Plan to attend
                    </button>
                    <button
                      className="campus-secondary"
                      disabled={pending || Date.parse(d.scheduled_at) > now}
                      onClick={() =>
                        void write(
                          "drill_participants",
                          {
                            user_id: user.id,
                            drill_id: d.id,
                            status: "attended",
                          },
                          undefined,
                          true,
                        )
                      }
                    >
                      Record my attendance
                    </button>
                  </>
                )}
                {staff && (
                  <p>
                    {
                      rows("drill_participants").filter(
                        (p) => p.drill_id === d.id,
                      ).length
                    }{" "}
                    participation records loaded
                  </p>
                )}
                {staff && !d.cancelled && (
                  <ConfirmAction
                    label="Cancel drill"
                    description="Participants will see this drill as cancelled on the school schedule."
                    disabled={pending}
                    onConfirm={() =>
                      void write("drills", { cancelled: true }, d.id)
                    }
                  />
                )}
              </article>
            ))}
          {staff && (
            <EntryForm
              title="Schedule drill"
              pending={pending || loading}
              fields={[
                { name: "title", label: "Drill title" },
                {
                  name: "location",
                  label: "Approved meeting location",
                  max: 200,
                },
                {
                  name: "scheduled_at",
                  label: "Drill date and time",
                  type: "datetime-local",
                },
              ]}
              submit={(v) =>
                write("drills", {
                  ...v,
                  scheduled_at: new Date(v.scheduled_at).toISOString(),
                })
              }
            />
          )}
          {staff && (
            <>
              <h3>Shared practice records</h3>
              <p>
                Campus practice ranking · self-reported, not verified
                competency. Only explicitly shared scores are shown.
              </p>
              <ol>
                {rows("learning_records")
                  .sort((a, b) => b.points - a.points)
                  .map((r) => (
                    <li key={r.user_id}>
                      {r.display_name}: {r.points} / 120 points
                    </li>
                  ))}
              </ol>
            </>
          )}
          {staff && (
            <>
              <h3>Geographic map notices</h3>
              <p>
                Publish a school-reported hazard area or assembly site on the
                geographic map. These do not certify safety or change
                illustration routes.
              </p>
              <EntryForm
                title="Publish map notice"
                pending={pending || loading}
                fields={[
                  { name: "label", label: "Map notice label" },
                  {
                    name: "kind",
                    label: "Map notice type",
                    options: ["hazard", "assembly"],
                  },
                  { name: "lat", label: "Notice latitude", type: "number" },
                  { name: "lon", label: "Notice longitude", type: "number" },
                  {
                    name: "radius",
                    label: "Area radius in metres",
                    type: "number",
                  },
                  {
                    name: "expires_at",
                    label: "Notice expiry",
                    type: "datetime-local",
                  },
                ]}
                submit={(v) =>
                  write("geo_zones", {
                    ...v,
                    lat: Number(v.lat),
                    lon: Number(v.lon),
                    radius: Number(v.radius),
                    expires_at: new Date(v.expires_at).toISOString(),
                  })
                }
              />
              {rows("geo_zones").map((z) => (
                <p key={z.id}>
                  {z.label} · {z.kind} · Expires{" "}
                  {new Date(z.expires_at).toLocaleString()}{" "}
                  <ConfirmAction
                    label="Remove map notice"
                    description="The area will disappear from the school geographic map after refresh."
                    disabled={pending}
                    onConfirm={() =>
                      void perform(() =>
                        removeSchoolRow("geo_zones", "id", z.id),
                      )
                    }
                  />
                </p>
              ))}
            </>
          )}
          {user && (
            <>
              <h3>{staff ? "School reports" : "My hazard reports"}</h3>
              <p>
                Reports go to authorized staff. They do not automatically change
                LifeRouter paths or trigger dispatch.
              </p>
              <EntryForm
                title="Submit hazard report"
                pending={pending || loading}
                fields={[
                  {
                    name: "location",
                    label: "Building, room or area",
                    max: 200,
                  },
                  {
                    name: "description",
                    label: "Observed hazard",
                    type: "textarea",
                  },
                ]}
                submit={(v) => write("reports", { ...v, kind: "hazard" })}
              />
            </>
          )}
        </>
      )}
      {mode === "records" && (
        <>
          <h3>My practice records</h3>
          <p>{learningPoints(local.progress)} / 120 points on this device.</p>
          {!local.valid && (
            <p role="alert">
              Saved practice could not be read. Open Learn to start again.
            </p>
          )}
          {user && (
            <div className="preparedness-card">
              <label className="school-field">
                Name to share with staff
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                />
              </label>
              <p>
                Sharing sends this name, quiz scores and checklist entries to
                authorized teachers and administrators. Photos and GPS positions
                are excluded.
              </p>
              <button
                className="game-nav-button"
                disabled={pending || !displayName.trim() || !local.valid}
                onClick={() =>
                  void write(
                    "learning_records",
                    {
                      user_id: user.id,
                      display_name: displayName.trim(),
                      earthquake: local.progress.best.earthquake ?? null,
                      flood: local.progress.best.flood ?? null,
                      fire: local.progress.best.fire ?? null,
                      checklist: local.progress.checked,
                    },
                    undefined,
                    true,
                  )
                }
              >
                Share practice with school staff
              </button>
              {rows("learning_records").some((r) => r.user_id === user.id) && (
                <ConfirmAction
                  label="Stop sharing practice"
                  description="This removes your shared record from staff reports. Your device progress remains."
                  disabled={pending}
                  onConfirm={() =>
                    void perform(
                      () => removeSharedProgress(user.id),
                      "Shared record removed.",
                    )
                  }
                />
              )}
            </div>
          )}
          <h3>Submitted transfer receipts</h3>
          <p>
            These confirm on-chain transfers, not the identity of the donor.
          </p>
          {rows("donations")
            .filter((d) => d.user_id === user?.id)
            .map((d) => (
              <p key={d.signature}>
                <a
                  href={`https://explorer.solana.com/tx/${d.signature}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {d.lamports / 1e9} SOL · View finalized transfer ↗
                </a>
              </p>
            ))}
        </>
      )}
      {mode === "community" && (
        <>
          <h3>Community support</h3>
          <p>
            Requests and offers become visible to signed-in school members after
            staff approval. Coordinate through school staff; do not post home
            addresses or private contact details.
          </p>
          {user && (
            <EntryForm
              title="Submit community post"
              pending={pending || loading}
              fields={[
                {
                  name: "kind",
                  label: "Post type",
                  options: ["offer", "request"],
                },
                {
                  name: "body",
                  label: "Support details",
                  type: "textarea",
                  max: 1000,
                },
              ]}
              submit={(v) => write("community", v)}
            />
          )}
          {rows("community").map((p) => (
            <article className="preparedness-card" key={p.id}>
              <h4>
                {p.kind} · {p.status}
              </h4>
              <p>{p.body}</p>
              {staff && p.status === "pending" && (
                <button
                  className="game-nav-button"
                  disabled={pending}
                  onClick={() =>
                    void write("community", { status: "approved" }, p.id)
                  }
                >
                  Approve post
                </button>
              )}
              {staff && p.status !== "closed" && (
                <ConfirmAction
                  label="Close post"
                  description="This post will no longer appear on the approved community board."
                  disabled={pending}
                  onConfirm={() =>
                    void write("community", { status: "closed" }, p.id)
                  }
                />
              )}
            </article>
          ))}
          <h3>School donation campaigns</h3>
          <p>
            Use only a recipient you have independently verified. Opening a
            wallet does not send funds automatically. No funds are handled by
            this website.
          </p>
          {!loading &&
            !error &&
            !rows("campaigns").filter((c) => c.active).length && (
              <p>
                No verified recipient has been configured by the school
                administrator. Donations are unavailable.
              </p>
            )}
          <label className="school-field">
            Donation amount (SOL)
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          {rows("campaigns")
            .filter((c) => c.active)
            .map((c) => {
              const link = solanaPaymentLink(c.wallet, amount, c.title);
              return (
                <article className="preparedness-card" key={c.id}>
                  <h4>{c.title}</h4>
                  <p>Recipient: {c.recipient}</p>
                  <p className="school-wallet">{c.wallet}</p>
                  {link ? (
                    <a className="campus-secondary" href={link}>
                      Review {amount} SOL in your wallet
                    </a>
                  ) : (
                    <p>
                      Enter a positive amount up to 1,000 SOL with at most nine
                      decimal places.
                    </p>
                  )}
                  <p>
                    <a
                      href={`https://explorer.solana.com/address/${c.wallet}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View public wallet transactions ↗
                    </a>
                  </p>
                  <EntryForm
                    title="Verify transfer receipt"
                    pending={pending || loading}
                    fields={[
                      {
                        name: "signature",
                        label: "Finalized transaction signature",
                        max: 88,
                      },
                    ]}
                    submit={(v) =>
                      perform(
                        () => verifyDonation(c.id, v.signature),
                        "Finalized transfer verified. View the receipt in Records.",
                      )
                    }
                  />
                </article>
              );
            })}
        </>
      )}
      {mode === "emergency" && (
        <>
          <h3>Emergency assistance</h3>
          <p>
            If there is immediate danger, contact local emergency services
            directly and follow school staff instructions. A message submitted
            here is not emergency dispatch and may not be seen promptly.
          </p>
          {contact ? (
            <a className="campus-primary" href={`tel:${contact.contact_phone}`}>
              Call {contact.contact_name}: {contact.contact_phone}
            </a>
          ) : (
            !loading && (
              <p>
                No verified school contact is configured. Use your phone to
                contact local emergency services.
              </p>
            )
          )}
          <p>
            Your GPS location is not attached or shared. Describe your location
            manually if you choose to send a school help request.
          </p>
          {user && (
            <EntryForm
              title="Send school help request"
              pending={pending || loading}
              fields={[
                {
                  name: "location",
                  label: "Your location for this request",
                  max: 200,
                },
                { name: "description", label: "Help needed", type: "textarea" },
              ]}
              submit={(v) =>
                perform(
                  () => schoolWrite("reports", { ...v, kind: "help" }),
                  "School help request stored for staff review. Emergency services have not been contacted.",
                )
              }
            />
          )}
        </>
      )}
      {(mode === "school" || mode === "emergency") &&
        rows("reports")
          .filter((r) => mode === "school" || r.kind === "help")
          .map((r) => (
            <article className="preparedness-card" key={r.id}>
              <h4>
                {r.kind} · {r.status}
              </h4>
              <p>
                {r.location} · {new Date(r.created_at).toLocaleString()}
              </p>
              <p>{r.description}</p>
              {staff && (
                <label>
                  Review status
                  <select
                    value={r.status}
                    disabled={pending}
                    onChange={(e) =>
                      void write("reports", { status: e.target.value }, r.id)
                    }
                  >
                    <option>submitted</option>
                    <option>reviewing</option>
                    <option>resolved</option>
                  </select>
                </label>
              )}
            </article>
          ))}
      {mode === "admin" &&
        (!loading && role !== "admin" ? (
          <p>
            Administrator access must be granted by the project owner. Changing
            your profile role does not grant staff permissions.
          </p>
        ) : (
          role === "admin" && (
            <>
              <h3>School administration</h3>
              <p>
                Manage this campus only. Private profile details and GPS history
                are not exposed here.
              </p>
              <EntryForm
                title="Save school contact"
                pending={pending || loading}
                fields={[
                  { name: "contact_name", label: "Verified contact name" },
                  {
                    name: "contact_phone",
                    label: "Phone with country code",
                    type: "tel",
                    max: 16,
                  },
                ]}
                submit={(v) =>
                  write("school_settings", { id: true, ...v }, undefined, true)
                }
              />
              <h4>Campus account roster</h4>
              <p>
                {rows("roster").length} account IDs loaded. Names, emails and
                private profiles are not exposed.
              </p>
              <ul>
                {rows("roster").map((r) => (
                  <li key={r.user_id}>
                    {r.user_id} · Joined{" "}
                    {new Date(r.created_at).toLocaleDateString()}
                  </li>
                ))}
              </ul>
              <EntryForm
                title="Grant staff access"
                pending={pending || loading}
                fields={[
                  { name: "user_id", label: "Existing account UUID", max: 36 },
                  { name: "label", label: "Staff label", max: 80 },
                  {
                    name: "role",
                    label: "Staff permission",
                    options: ["teacher", "admin"],
                  },
                ]}
                submit={(v) => write("staff", v, undefined, true)}
              />
              <ul>
                {rows("staff").map((s) => (
                  <li key={s.user_id}>
                    {s.label} · {s.role} · {s.user_id}
                    {s.user_id !== user?.id && (
                      <ConfirmAction
                        label="Revoke staff access"
                        description="This account will lose teacher and administrator permissions. Its personal profile remains."
                        disabled={pending}
                        onConfirm={() =>
                          void perform(() =>
                            removeSchoolRow("staff", "user_id", s.user_id),
                          )
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
              <EntryForm
                title="Add verified donation campaign"
                pending={pending || loading}
                fields={[
                  { name: "title", label: "Campaign title" },
                  { name: "recipient", label: "Verified recipient name" },
                  {
                    name: "wallet",
                    label: "Verified Solana mainnet wallet",
                    max: 44,
                  },
                ]}
                submit={(v) => write("campaigns", v)}
              />
              {rows("campaigns").map((c) => (
                <article className="preparedness-card" key={c.id}>
                  <h4>
                    {c.title} · {c.active ? "Active" : "Closed"}
                  </h4>
                  <p>{c.recipient}</p>
                  {c.active && (
                    <ConfirmAction
                      label="Close campaign"
                      description="This removes the campaign from the active donation list."
                      disabled={pending}
                      onConfirm={() =>
                        void write("campaigns", { active: false }, c.id)
                      }
                    />
                  )}
                </article>
              ))}
              <h4>Administrative audit</h4>
              <ul>
                {rows("audit").map((a) => (
                  <li key={a.id}>
                    {new Date(a.created_at).toLocaleString()} · {a.entity} ·{" "}
                    {a.operation}
                  </li>
                ))}
              </ul>
              <h4>Verified on-chain receipts</h4>
              <p>
                {rows("donations").length} receipts loaded. Submission account
                is not proof of donor identity.
              </p>
              {rows("donations").map((d) => (
                <p key={d.signature}>
                  <a
                    href={`https://explorer.solana.com/tx/${d.signature}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {d.lamports / 1e9} SOL · View transfer ↗
                  </a>
                </p>
              ))}
            </>
          )
        ))}
      {user && !loading && !error && (
        <p className="radar-muted">Showing up to 100 records per section.</p>
      )}
    </section>
  );
}
