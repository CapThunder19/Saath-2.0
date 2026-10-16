/**
 * Saath 2.0 registrations → Google Sheet + Drive, with admin approval.
 *
 * Paste this into the Apps Script editor of your registrations Google Sheet
 * (Extensions → Apps Script), set SECRET below, save, then publish it:
 * Deploy → Manage deployments → Edit → Version: New version → Deploy.
 * (First time only: Deploy → New deployment → Web app, Execute as: Me,
 * Who has access: Anyone, and copy the URL into .env.local as GOOGLE_SCRIPT_URL.)
 */

// Must match GOOGLE_SCRIPT_SECRET in the website's .env.local.
const SECRET = "PASTE_THE_SECRET_HERE";

const SHEET_NAME = "Registrations";
const FOLDER_NAME = "Saath 2.0 – Member Photos";
const HEADERS = [
  "Registration ID", "Submitted at", "Team type", "Member", "Name", "Admission no.",
  "Mobile", "Course", "Branch", "College email", "Photo", "Status", "Approved at",
  "Amount", "Transaction ID",
];
// Columns (0-based) in each data row.
const COL = {
  id: 0, submittedAt: 1, teamType: 2, member: 3, name: 4, admission: 5, phone: 6,
  course: 7, branch: 8, email: 9, photo: 10, status: 11, approvedAt: 12,
  amount: 13, txnId: 14,
};

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json({ ok: false, error: "unauthorized" });
    // Read-only actions don't need to wait for the lock.
    if (body.action === "lookup") return json({ ok: true, result: lookup(body.admissionNo) });
    if (body.action === "ticket") return json({ ok: true, result: ticket(body.registrationId, body.memberNo) });
    if (body.action === "list") return json({ ok: true, result: list() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // one write at a time, so duplicate checks are reliable
  try {
    if (body.action === "approve") return json({ ok: true, result: approve(body.registrationId) });
    return register(body);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function register(body) {
  const sheet = getSheet();
  const rowsNow = dataRows();
  const taken = new Set(rowsNow.map((r) => r[COL.admission].trim().toUpperCase()));
  const duplicates = body.members
    .map((m, i) => (taken.has(m.admissionNo.toUpperCase()) ? i : -1))
    .filter((i) => i >= 0);
  if (duplicates.length) return json({ ok: false, duplicates });
  // One payment can only be used for one registration.
  if (rowsNow.some((r) => r[COL.txnId].trim().toUpperCase() === body.txnId)) return json({ ok: false, duplicateTxn: true });

  const folder = getFolder();
  const submittedAt = new Date();
  const rows = body.members.map((m, i) => {
    const blob = Utilities.newBlob(
      Utilities.base64Decode(m.photo.data),
      m.photo.mimeType,
      `${body.registrationId}-${i + 1}-${m.admissionNo}.${m.photo.ext}`,
    );
    const file = folder.createFile(blob);
    return [
      body.registrationId, submittedAt, body.teamType, `${i + 1} of ${body.members.length}`,
      m.name, m.admissionNo, m.phone, m.course, m.branch, m.email, file.getUrl(), "Pending", "",
      body.amount, body.txnId,
    ];
  });

  const start = sheet.getLastRow() + 1;
  // Store text columns as plain text so admission and phone numbers aren't turned into numbers.
  sheet.getRange(start, 3, rows.length, HEADERS.length - 2).setNumberFormat("@");
  sheet.getRange(start, 1, rows.length, HEADERS.length).setValues(rows);
  return json({ ok: true });
}

function dataRows() {
  const sheet = getSheet();
  const last = sheet.getLastRow();
  return last > 1 ? sheet.getRange(2, 1, last - 1, HEADERS.length).getDisplayValues() : [];
}

// "2 of 3" → [2, 3]
const memberParts = (s) => String(s).split(" of ").map(Number);
const statusOf = (row) => (row[COL.status] === "Approved" ? "Approved" : "Pending");

function lookup(admissionNo) {
  const want = String(admissionNo).trim().toUpperCase();
  const row = dataRows().find((r) => r[COL.admission].trim().toUpperCase() === want);
  if (!row) return null;
  const [memberNo, teamSize] = memberParts(row[COL.member]);
  return { registrationId: row[COL.id], memberNo, teamSize, name: row[COL.name], status: statusOf(row) };
}

function ticket(registrationId, memberNo) {
  const row = dataRows().find((r) => r[COL.id] === registrationId && memberParts(r[COL.member])[0] === Number(memberNo));
  if (!row) return null;
  const fileId = (/[-\w]{25,}/.exec(row[COL.photo]) || [])[0];
  let photo = "";
  if (fileId) {
    const blob = DriveApp.getFileById(fileId).getBlob();
    photo = `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`;
  }
  return {
    name: row[COL.name], branch: row[COL.branch], teamSize: memberParts(row[COL.member])[1],
    status: statusOf(row), photo,
  };
}

// All registrations grouped by registration ID, in sheet order.
function list() {
  const byId = {};
  const order = [];
  dataRows().forEach((r) => {
    const id = r[COL.id];
    if (!id) return;
    if (!byId[id]) {
      byId[id] = {
        registrationId: id, submittedAt: r[COL.submittedAt], teamType: r[COL.teamType],
        status: statusOf(r), approvedAt: r[COL.approvedAt], amount: r[COL.amount], txnId: r[COL.txnId], members: [],
      };
      order.push(id);
    }
    byId[id].members.push({
      memberNo: memberParts(r[COL.member])[0], name: r[COL.name], admissionNo: r[COL.admission],
      phone: r[COL.phone], course: r[COL.course], branch: r[COL.branch], email: r[COL.email],
    });
  });
  return order.map((id) => byId[id]);
}

// Marks every row of the registration approved.
function approve(registrationId) {
  const sheet = getSheet();
  const approvedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  let found = false;
  dataRows().forEach((r, i) => {
    if (r[COL.id] !== registrationId) return;
    found = true;
    sheet.getRange(i + 2, COL.status + 1, 1, 2).setValues([["Approved", approvedAt]]);
  });
  return found ? { approvedAt } : null;
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  // Creates the header row, or adds the Status / Approved at columns to an older sheet.
  const header = sheet.getRange(1, 1, 1, HEADERS.length);
  if (header.getValues()[0].join("|") !== HEADERS.join("|")) {
    header.setValues([HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("FOLDER_ID");
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (err) {
      // folder was deleted; make a new one below
    }
  }
  const folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty("FOLDER_ID", folder.getId());
  return folder;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run this once from the editor (select "setup" → Run) to grant permissions
// and create the sheet tab and Drive folder.
function setup() {
  getSheet();
  getFolder();
}
