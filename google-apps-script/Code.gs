/**
 * Azen funnel — Google Sheets backup.
 *
 * Every lead lands here, including the ones who never finished. A row is
 * created the moment we have an email and updated in place after that, so one
 * person is one row no matter how many times the funnel pushes.
 *
 * Setup is in the project README under "Google Sheet backup".
 */

// Must match SHEETS_SHARED_SECRET in the app's environment. Leave empty to
// disable the check (not recommended: the URL is public by design).
var SHARED_SECRET = 'CHANGE_ME';

var SHEET_NAME = 'Leads';

// A lead only ever moves forward. A partial arriving late (network reordering,
// or someone reopening the funnel) must never demote a finished row.
var STAGE_RANK = { test: -1, partial: 0, abandoned: 1, complete: 2, booked: 3 };

// Column order. Add one here and to the sheet's header row to capture more;
// anything the app sends that isn't listed is ignored.
var COLUMNS = [
  'leadId', 'stage', 'firstSeen', 'updatedAt', 'lastStep', 'seq',
  'score', 'tier', 'signals',
  'firstName', 'email', 'phone', 'businessName', 'website',
  'industry', 'teamSize', 'revenue', 'bottleneck', 'tried',
  'timeline', 'budget', 'authority',
  'recommendedSystems', 'estimatedHours',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid', 'referrer', 'landingPath'
];

function doPost(e) {
  var lock = LockService.getScriptLock();

  // Concurrent pushes from the same person are normal; serialise them so two
  // writes can't land on the same row at once.
  try {
    lock.waitLock(30000);
  } catch (err) {
    return respond({ ok: false, error: 'busy' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respond({ ok: false, error: 'empty body' });
    }

    var body = JSON.parse(e.postData.contents);

    if (SHARED_SECRET && SHARED_SECRET !== 'CHANGE_ME' && body.secret !== SHARED_SECRET) {
      return respond({ ok: false, error: 'bad secret' });
    }

    var flat = body.flat || {};
    if (!flat.leadId) return respond({ ok: false, error: 'missing leadId' });

    var sheet = getSheet();
    var headers = getHeaders(sheet);
    var rowIndex = findRow(sheet, flat.leadId);
    var now = new Date();

    flat.seq = body.seq || 0;
    flat.updatedAt = now;

    if (rowIndex > 0) {
      var existing = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
      var existingSeq = Number(existing[headers.indexOf('seq')]) || 0;

      // A late-arriving older push must not overwrite newer answers.
      if (flat.seq && flat.seq < existingSeq) {
        return respond({ ok: true, skipped: 'stale' });
      }

      flat.firstSeen = existing[headers.indexOf('firstSeen')] || now;

      // Keep the furthest stage this lead ever reached.
      var priorStage = String(existing[headers.indexOf('stage')] || '');
      var priorRank = STAGE_RANK[priorStage];
      var nextRank = STAGE_RANK[String(flat.stage || '')];
      if (priorRank !== undefined && nextRank !== undefined && nextRank < priorRank) {
        flat.stage = priorStage;
        flat.lastStep = existing[headers.indexOf('lastStep')] || flat.lastStep;
      }

      // Never blank a field we already hold: a partial push carries fewer
      // answers than the completion that came before it.
      var merged = existing.slice();
      for (var i = 0; i < headers.length; i++) {
        var value = flat[headers[i]];
        if (value !== undefined && value !== null && value !== '') merged[i] = value;
      }
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([merged]);
      return respond({ ok: true, updated: rowIndex });
    }

    flat.firstSeen = now;
    var row = headers.map(function (key) {
      var value = flat[key];
      return value === undefined || value === null ? '' : value;
    });
    sheet.appendRow(row);
    return respond({ ok: true, appended: true });
  } catch (err) {
    // Keep the raw payload so nothing is ever lost to a mapping bug.
    logFailure(e, err);
    return respond({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return respond({ ok: true, service: 'azen-funnel-sheet' });
}

function getSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function findRow(sheet, leadId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(leadId)) return i + 2;
  }
  return -1;
}

function logFailure(e, err) {
  try {
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName('Errors') || book.insertSheet('Errors');
    sheet.appendRow([new Date(), String(err), e && e.postData ? e.postData.contents : '']);
  } catch (ignored) {
    // Nothing else we can do from in here.
  }
}

function respond(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
