import { canScan } from "@/lib/admin";
import { getTicket } from "@/lib/storage";
import { parseTicketId } from "@/lib/tickets";

// Member photo for the admin dashboard and the gate scanner: /api/admin/photo?id=SAATH-XXXXXX-1
export async function GET(req: Request) {
  if (!(await canScan())) return new Response("Unauthorized", { status: 401 });
  const parsed = parseTicketId(new URL(req.url).searchParams.get("id") ?? "");
  if (!parsed) return new Response("Not found", { status: 404 });

  const ticket = await getTicket(parsed.registrationId, parsed.memberNo).catch(() => null);
  const match = ticket && /^data:([^;]+);base64,(.+)$/.exec(ticket.photo);
  if (!match) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(match[2], "base64"), {
    headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=3600" },
  });
}
