import ExcelJS from "exceljs";
import { isAdmin } from "@/lib/admin";
import { listRegistrations } from "@/lib/storage";

export const maxDuration = 60;

// Admin-only Excel download: one row per student, like the old Google Sheet.
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Please sign in as admin.", { status: 401 });

  const regs = await listRegistrations();
  const site = new URL(req.url).origin;

  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Registrations", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Registration ID", key: "id", width: 16 },
    { header: "Submitted at", key: "submittedAt", width: 20 },
    { header: "Team type", key: "teamType", width: 10 },
    { header: "Member", key: "member", width: 9 },
    { header: "Name", key: "name", width: 24 },
    { header: "Admission no.", key: "admissionNo", width: 16 },
    { header: "Mobile", key: "phone", width: 13 },
    { header: "Course", key: "course", width: 10 },
    { header: "Branch", key: "branch", width: 16 },
    { header: "College email", key: "email", width: 30 },
    { header: "Amount (₹)", key: "amount", width: 11 },
    { header: "UPI transaction ID", key: "txnId", width: 20 },
    { header: "Status", key: "status", width: 10 },
    { header: "Approved at", key: "approvedAt", width: 20 },
    { header: "Checked in at", key: "checkedInAt", width: 20 },
    { header: "Photo", key: "photo", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  const when = (s: string) => (s ? new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "");
  for (const r of regs) {
    for (const m of r.members) {
      const row = sheet.addRow({
        id: r.registrationId,
        submittedAt: when(r.submittedAt),
        teamType: r.teamType,
        member: `${m.memberNo} of ${r.members.length}`,
        name: m.name,
        // Text, so Excel doesn't turn long numbers into 4.28917E+11 or drop leading zeros.
        admissionNo: m.admissionNo,
        phone: m.phone,
        course: m.course,
        branch: m.branch,
        email: m.email,
        amount: r.amount ? Number(r.amount) : "",
        txnId: r.txnId,
        status: r.status,
        approvedAt: when(r.approvedAt),
        checkedInAt: when(m.checkedInAt ?? ""),
        photo: { text: "View photo", hyperlink: `${site}/api/admin/photo?id=${r.registrationId}-${m.memberNo}` },
      });
      for (const key of ["admissionNo", "phone", "txnId"]) row.getCell(key).numFmt = "@";
      row.getCell("photo").font = { color: { argb: "FF1D4ED8" }, underline: true };
    }
  }
  sheet.autoFilter = { from: "A1", to: "P1" };

  const buffer = await book.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="saath-2.0-registrations-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
