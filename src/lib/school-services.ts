import { studentCloud } from "./student-cloud";
export interface SchoolRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  description: string;
  location: string;
  role: "teacher" | "admin";
  label: string;
  severity: string;
  active: boolean;
  cancelled: boolean;
  created_at: string;
  scheduled_at: string;
  status: string;
  kind: string;
  drill_id: string;
  display_name: string;
  points: number;
  earthquake: number | null;
  flood: number | null;
  fire: number | null;
  checklist: string[];
  contact_name: string;
  contact_phone: string;
  wallet: string;
  recipient: string;
  lat: number;
  lon: number;
  radius: number;
  expires_at: string;
  entity: string;
  operation: string;
  actor: string;
  record_id: string;
  signature: string;
  lamports: number;
  confirmed_at: string;
}
function client() {
  if (!studentCloud) throw new Error("School accounts are not configured.");
  return studentCloud;
}
function failure(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (["42P01", "PGRST205", "PGRST202"].includes(error.code ?? ""))
    throw new Error(
      "School services are not activated yet. The project owner must apply the school-services database migration.",
    );
  throw new Error(
    "The school service could not complete this request. Check your connection and account permissions; no success has been recorded.",
  );
}
export async function schoolRows(table: string): Promise<SchoolRow[]> {
  if (table === "roster") {
    const { data, error } = await client().rpc("explorer_admin_roster");
    failure(error);
    return (data ?? []) as SchoolRow[];
  }
  const order =
    table === "learning_records"
      ? "points"
      : ["staff", "school_settings", "drill_participants"].includes(table)
        ? undefined
        : "created_at";
  const query = client().from(`explorer_${table}`).select("*").limit(100);
  const { data, error } = await (order
    ? query.order(order, { ascending: false })
    : query);
  failure(error);
  return (data ?? []) as SchoolRow[];
}
export async function schoolWrite(
  table: string,
  values: Record<string, unknown>,
  id?: string,
  upsert = false,
) {
  const query = client().from(`explorer_${table}`);
  const result = await (
    id
      ? query.update(values).eq("id", id)
      : upsert
        ? query.upsert(values)
        : query.insert(values)
  ).select();
  failure(result.error);
  if (!result.data?.length)
    throw new Error(
      "No change was saved. Check your account permissions and refresh.",
    );
}
export async function removeSharedProgress(userId: string) {
  const { error } = await client()
    .from("explorer_learning_records")
    .delete()
    .eq("user_id", userId);
  failure(error);
}
export async function verifyDonation(campaign: string, signature: string) {
  const { data, error } = await client().functions.invoke(
    "verify-school-donation",
    { body: { campaignId: campaign, signature } },
  );
  if (error || !data?.verified)
    throw new Error(
      "Transfer could not be verified. Check the transaction signature and try again after it is finalized. The verification service may need activation.",
    );
}
export function solanaPaymentLink(
  wallet: string,
  amount: string,
  label: string,
) {
  if (
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet) ||
    !/^\d+(\.\d{1,9})?$/.test(amount) ||
    Number(amount) <= 0 ||
    Number(amount) > 1000
  )
    return null;
  return `solana:${wallet}?${new URLSearchParams({ amount, label, message: "School community support" })}`;
}

export async function removeSchoolRow(
  table: "staff" | "geo_zones",
  column: "user_id" | "id",
  id: string,
) {
  const { data, error } = await client()
    .from(`explorer_${table}`)
    .delete()
    .eq(column, id)
    .select();
  failure(error);
  if (!data?.length)
    throw new Error("No record was removed. Check your permissions.");
}
