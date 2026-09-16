/**
 * Kal Nidre Raffle — Google Sheet ticket auditor
 *
 * Paste this into your Google Sheet: Extensions → Apps Script (replace the
 * default code), set SECRET below to the same value you put in Railway as
 * SHEET_WEBHOOK_SECRET, then Deploy → New deployment → Web app with
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the Web app URL (ends in /exec) into Railway as SHEET_WEBHOOK_URL.
 *
 * The raffle app POSTs its complete current state after every change and
 * whenever an admin clicks "Push to Google Sheet". This script rewrites the
 * Tickets, Entries, and Summary tabs from that snapshot.
 */

var SECRET = "CHANGE-ME-to-match-SHEET_WEBHOOK_SECRET";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!body || body.secret !== SECRET) {
      return respond({ ok: false, error: "Bad secret" });
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    writeTable(ss, "Tickets", body.tickets.header, body.tickets.rows);
    writeTable(ss, "Entries", body.entries.header, body.entries.rows);
    writeTable(ss, "Summary", ["Item", "Value"], body.summary);
    return respond({ ok: true, tickets: body.tickets.rows.length, entries: body.entries.rows.length });
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** Lets you open the /exec URL in a browser to confirm the deployment works. */
function doGet() {
  return respond({ ok: true, message: "Kal Nidre raffle auditor is listening. Data arrives via POST from the app." });
}

function writeTable(ss, name, header, rows) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clearContents();
  var values = [header].concat(rows || []);
  if (values.length && header.length) {
    sheet.getRange(1, 1, values.length, header.length).setValues(
      values.map(function (row) {
        var out = row.slice(0, header.length);
        while (out.length < header.length) out.push("");
        return out;
      })
    );
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
