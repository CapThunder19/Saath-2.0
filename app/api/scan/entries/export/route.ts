import ExcelJS from "exceljs";
import { canScan } from "@/lib/admin";
import { listEntries } from "@/lib/storage";

export const maxDuration = 60;

// Admin-only Excel of everyone who has entered, built fresh from the database.
export async function GET() {
  if (!(await canScan())) return new Response("Please sign in as scanner or admin.", { status: 401 });

  const entries = (await listEntries()).slice().reverse(); // first entry at the top
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Entry log", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "#", key: "n", width: 6 },
    { header: "Entry time", key: "time", width: 22 },
    { header: "Name", key: "name", width: 26 },
    { header: "Admission no.", key: "admissionNo", width: 16 },
    { header: "Registration ID", key: "id", width: 16 },
    { header: "Member", key: "member", width: 9 },
    { header: "Team type", key: "teamType", width: 10 },
    { header: "Course", key: "course", width: 10 },
    { header: "Branch", key: "branch", width: 16 },
    { header: "Mobile", key: "phone", width: 13 },
  ];
  sheet.getRow(1).font = { bold: true };

  entries.forEach((e, i) => {
    const row = sheet.addRow({
      n: i + 1,
      time: new Date(e.enteredAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      name: e.name,
      admissionNo: e.admissionNo,
      id: e.registrationId,
      member: e.memberNo,
      teamType: e.teamType,
      course: e.course,
      branch: e.branch,
      phone: e.phone,
    });
    for (const key of ["admissionNo", "phone"]) row.getCell(key).numFmt = "@";
  });
  sheet.autoFilter = { from: "A1", to: "J1" };

  const buffer = await book.xlsx.writeBuffer();
  const stamp = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(/[^0-9]+/g, "-").slice(0, 16);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="saath-2.0-entries-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
