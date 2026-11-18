/**
 * CNW WORKFORCE — GOOGLE APPS SCRIPT WEBHOOK
 * 
 * Paste this script into your Google Sheet:
 * 1. Open: https://docs.google.com/spreadsheets/d/1AFXJ4m4aws1-s9mUbdf_UxrMmN_4xyJJIjo17RikV1c/edit
 * 2. In the top menu, click: Extensions > Apps Script
 * 3. Delete any default code and paste this entire code.
 * 4. Click 'Save' (floppy disk icon).
 * 5. Click 'Deploy' > 'New deployment'
 * 6. Select type: 'Web app'
 * 7. Set:
 *    - Description: CNW Workforce Attendance Webhook
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone
 * 8. Click 'Deploy' and copy the Web App URL!
 * 
 * FEATURES:
 * - Automatically records all START, MOVING, and END / OFF events.
 * - Automatically creates a new sheet tab for every month (e.g. "2026-11", "2026-12", "2027-01").
 * - Formats headers with CNW Dark Green (#02353C) and bold white text.
 */

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Determine Sheet Tab Name from Event Date (e.g. "2026-11")
    var eventDateStr = data.effectiveEventTime || new Date().toISOString();
    var eventDate = new Date(eventDateStr);

    // Format Year and Month tab name in Sri Lanka timezone
    var yearMonth = Utilities.formatDate(eventDate, "Asia/Colombo", "yyyy-MM");

    // Check if sheet tab for this month exists; if not, create it!
    var sheet = ss.getSheetByName(yearMonth);
    if (!sheet) {
      sheet = ss.insertSheet(yearMonth);

      // Create Header Row
      var headers = [
        "Record ID",
        "Employee Name",
        "Employee Code",
        "Site Name",
        "Event Type",
        "Effective Date & Time (SL)",
        "Time Adjusted?",
        "Adjustment Reason",
        "Submission Time (UTC)"
      ];
      sheet.appendRow(headers);

      // Format Header with CNW colors
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#02353C");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);

      // Auto-fit column widths
      for (var col = 1; col <= headers.length; col++) {
        sheet.setColumnWidth(col, 160);
      }
    }

    // Format Sri Lankan local time string
    var formattedLocalTime = Utilities.formatDate(eventDate, "Asia/Colombo", "yyyy-MM-dd HH:mm:ss");

    // Append attendance row to the monthly tab
    sheet.appendRow([
      data.id || ("REC-" + new Date().getTime()),
      data.employeeName || data.employeeId || "",
      data.employeeCode || "",
      data.siteName || data.siteId || "",
      data.eventType || "",
      formattedLocalTime,
      data.wasTimeAdjusted ? "YES" : "NO",
      data.adjustmentReason || "-",
      data.deviceTimestamp || new Date().toISOString()
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", sheet: yearMonth }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function to verify script execution directly in Apps Script editor
function testRecord() {
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        id: "test-001",
        employeeName: "Kamal Perera",
        employeeCode: "CNW-E001",
        siteName: "Colombo High-Rise (Site A)",
        eventType: "START",
        effectiveEventTime: new Date().toISOString(),
        wasTimeAdjusted: false,
        adjustmentReason: ""
      })
    }
  };
  var res = doPost(mockEvent);
  Logger.log(res.getContent());
}
