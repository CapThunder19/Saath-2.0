/**
 * Saath 2.0 registrations → Google Sheet + Drive.
 *
 * Paste this into the Apps Script editor of your registrations Google Sheet
 * (Extensions → Apps Script), set SECRET below, then Deploy → New deployment →
 * Web app, Execute as: Me, Who has access: Anyone. Copy the web app URL into
 * the website's .env.local as GOOGLE_SCRIPT_URL.
 */

// Must match GOOGLE_SCRIPT_SECRET in the website's .env.local.
const SECRET = "PASTE_THE_SECRET_HERE";

const SHEET_NAME = "Registrations";
const FOLDER_NAME = "Saath 2.0 – Member Photos";
const HEADERS = [
  "Registration ID", "Submitted at", "Team type", "Member", "Name", "Admission no.",
  "Mobile", "Course", "Branch", "College email", "Photo",
];
const ADMISSION_COL = 6;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // one registration at a time, so duplicate checks are reliable
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json({ ok: false, error: "unauthorized" });

    const sheet = getSheet();
    const last = sheet.getLastRow();
    const taken = new Set(
      last > 1 ? sheet.getRange(2, ADMISSION_COL, last - 1, 1).getValues().map((r) => String(r[0]).toUpperCase()) : [],
    );
    const duplicates = body.members
      .map((m, i) => (taken.has(m.admissionNo.toUpperCase()) ? i : -1))
      .filter((i) => i >= 0);
    if (duplicates.length) return json({ ok: false, duplicates });

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
        m.name, m.admissionNo, m.phone, m.course, m.branch, m.email, file.getUrl(),
      ];
    });

    const start = sheet.getLastRow() + 1;
    // Store text columns as plain text so admission and phone numbers aren't turned into numbers.
    sheet.getRange(start, 3, rows.length, HEADERS.length - 2).setNumberFormat("@");
    sheet.getRange(start, 1, rows.length, HEADERS.length).setValues(rows);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
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
// and create the sheet tab and Drive folder before going live.
function setup() {
  getSheet();
  getFolder();
}
