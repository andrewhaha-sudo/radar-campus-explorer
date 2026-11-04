import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { verifiedLamports } from "./verify.ts";
Deno.serve(async (request: Request) => {
  const origin = Deno.env.get("APP_ORIGIN");
  const headers = {
    "Access-Control-Allow-Origin": origin ?? "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!origin || request.headers.get("origin") !== origin)
    return reply(403, { error: "Origin is not configured or permitted." });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { error: "POST required." });
  try {
    const token = request.headers
      .get("authorization")
      ?.replace(/^Bearer /i, "");
    if (!token) return reply(401, { error: "Sign in required." });
    const url = Deno.env.get("SUPABASE_URL")!,
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const service = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await service.auth.getUser(token);
    if (authError || !auth.user)
      return reply(401, { error: "Sign in required." });
    const body = await request.text();
    if (body.length > 2048) return reply(413, { error: "Request too large." });
    const { campaignId, signature } = JSON.parse(body);
    if (
      typeof campaignId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(campaignId) ||
      typeof signature !== "string" ||
      !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)
    )
      return reply(400, {
        error: "Invalid campaign or transaction signature.",
      });
    const { data: campaign, error: campaignError } = await service
      .from("explorer_campaigns")
      .select("wallet,created_at")
      .eq("id", campaignId)
      .eq("active", true)
      .single();
    if (campaignError || !campaign)
      return reply(404, { error: "Campaign unavailable." });
    const endpoint =
      Deno.env.get("SOLANA_RPC_URL") ?? "https://api.mainnet-beta.solana.com";
    if (!endpoint.startsWith("https://"))
      return reply(503, { error: "Secure RPC endpoint required." });
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          {
            encoding: "jsonParsed",
            commitment: "finalized",
            maxSupportedTransactionVersion: 0,
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok)
      return reply(503, { error: "Verification provider unavailable." });
    const rpc = await upstream.json();
    if (rpc.error)
      return reply(422, {
        error: "Transfer is not available for verification.",
      });
    const lamports = verifiedLamports(rpc.result, campaign.wallet);
    if (rpc.result.transaction?.signatures?.[0] !== signature)
      return reply(422, { error: "Transaction signature does not match." });
    const confirmedAt = new Date(rpc.result.blockTime * 1000);
    if (confirmedAt.getTime() < Date.parse(campaign.created_at))
      return reply(422, { error: "Transfer predates this campaign." });
    const { error } = await service
      .from("explorer_donations")
      .insert({
        signature,
        user_id: auth.user.id,
        campaign_id: campaignId,
        lamports,
        confirmed_at: confirmedAt.toISOString(),
      });
    if (error)
      return reply(error.code === "23505" ? 409 : 500, {
        error:
          error.code === "23505"
            ? "This transfer receipt has already been recorded."
            : "Receipt could not be saved.",
      });
    return reply(200, { verified: true, lamports });
  } catch {
    return reply(422, {
      error:
        "Could not verify a successful finalized transfer to this recipient. Try again later.",
    });
  }
});
