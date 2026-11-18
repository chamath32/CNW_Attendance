/**
 * CNW WORKFORCE — MATRIX-STYLE MONTHLY GOOGLE APPS SCRIPT WEBHOOK
 * 
 * SPECIFICATIONS:
 * 1. Each tab represents one Month: "YYYY-MM" (e.g. "2026-11", "2026-12")
 * 2. Main Column: Employee Full Name (e.g. "Kamal Perera")
 * 3. Sub-columns:
 *    - Start at: Green (#2EAF7D)
 *    - OFF at: Light Red (#F87171)
 *    - Site: Light Blue (#60A5FA)
 *    - Total Hours: Light Orange (#FB923C)
 * 4. Data Alignment: All attendance data right-aligned.
 * 5. Total Hours Format: "Total(OT)" e.g. 10(2) means 10 total paid hours with 2 OT hours.
 * 6. Rows after Row 33 (Monthly Summary):
 *    - Row 35: Total Working Hours
 *    - Row 36: Total OT Hours
 *    - Row 37: Total Salary (LKR)
 */

function doGet(e) {
  return ContentService.createTextOutput("CNW Workforce Matrix Google Sheet Webhook is active and running!")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Determine Event Date in Sri Lanka timezone (Asia/Colombo)
    var eventDateStr = data.effectiveEventTime || new Date().toISOString();
    var eventDate = new Date(eventDateStr);
    
    // Tab name formatted as YYYY-MM
    var yearMonth = Utilities.formatDate(eventDate, "Asia/Colombo", "yyyy-MM");
    var dayOfMonth = parseInt(Utilities.formatDate(eventDate, "Asia/Colombo", "d"), 10);
    var formattedTime = Utilities.formatDate(eventDate, "Asia/Colombo", "hh:mm a");

    // Display employee full name as Main Header (e.g. "Kamal Perera")
    var empName = data.employeeName || data.fullName || "Kamal Perera";
    var siteName = data.siteName || "CNW Site";
    var eventType = (data.eventType || "").toUpperCase();

    // Check or create monthly sheet tab
    var sheet = ss.getSheetByName(yearMonth);
    if (!sheet) {
      sheet = initializeMonthlySheet(ss, yearMonth);
    }

    // Locate or create the 4-column group for this employee
    var colStart = getOrCreateEmployeeColumns(sheet, empName);

    // Target row for this day of the month (Days 1 to 31 are Rows 3 to 33)
    var targetRow = 2 + dayOfMonth;

    // Sub-columns:
    // colStart: START at
    // colStart + 1: OFF at
    // colStart + 2: Site
    // colStart + 3: Total Hours
    var startCell = sheet.getRange(targetRow, colStart);
    var offCell = sheet.getRange(targetRow, colStart + 1);
    var siteCell = sheet.getRange(targetRow, colStart + 2);
    var hoursCell = sheet.getRange(targetRow, colStart + 3);

    if (eventType === "START") {
      startCell.setValue(formattedTime).setHorizontalAlignment("right");
      siteCell.setValue(siteName).setHorizontalAlignment("right");
    } else if (eventType === "MOVE") {
      var currentSite = siteCell.getValue();
      siteCell.setValue(currentSite ? (currentSite + " -> " + siteName) : siteName).setHorizontalAlignment("right");
    } else if (eventType === "OFF") {
      offCell.setValue(formattedTime).setHorizontalAlignment("right");
      if (!siteCell.getValue()) {
        siteCell.setValue(siteName).setHorizontalAlignment("right");
      }
      
      // Calculate formatted hours string: Total(OT) e.g. 10(2)
      var startVal = startCell.getValue();
      if (startVal) {
        var hourStats = calculateWorkedHoursStats(startVal.toString(), formattedTime);
        hoursCell.setValue(hourStats.displayStr).setHorizontalAlignment("right");
      }

      // Recompute Monthly Summary Totals for this employee (Rows 35, 36, 37)
      recalculateEmployeeMonthlySummary(sheet, colStart, data.dailyRate || 2000, data.otRate || 300);
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      sheet: yearMonth, 
      day: dayOfMonth, 
      employee: empName 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Initialize a new monthly sheet with Date rows (1 to 31) and Summary rows (35 to 37)
 */
function initializeMonthlySheet(ss, yearMonth) {
  var sheet = ss.insertSheet(yearMonth);
  
  // Date & Day Header (Row 1 & 2 merged)
  sheet.getRange(1, 1, 2, 1).merge().setValue("Date").setBackground("#02353C").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.getRange(1, 2, 2, 1).merge().setValue("Day").setBackground("#02353C").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 90);
  sheet.setFrozenColumns(2);
  sheet.setFrozenRows(2);

  // Determine days in this month (28 to 31)
  var parts = yearMonth.split("-");
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var daysInMonth = new Date(year, month, 0).getDate();

  var dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Populate Days 1 to daysInMonth (Rows 3 to 2 + daysInMonth)
  var dateRows = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var curDate = new Date(year, month - 1, d);
    var dateString = year + "-" + (month < 10 ? "0" + month : month) + "-" + (d < 10 ? "0" + d : d);
    var dayOfWeek = dayNames[curDate.getDay()];
    dateRows.push([dateString, dayOfWeek]);
  }

  var dateRange = sheet.getRange(3, 1, daysInMonth, 2);
  dateRange.setValues(dateRows);
  dateRange.setHorizontalAlignment("center");

  // Alternate row shading for days 1 to 31
  for (var r = 3; r <= 2 + daysInMonth; r++) {
    if (r % 2 === 0) {
      sheet.getRange(r, 1, 1, 2).setBackground("#F8FAFC");
    }
  }

  // Row 34: Separator
  sheet.getRange(34, 1, 1, 2).merge().setValue("").setBackground("#E2E8F0");

  // Summary Labels in Columns A & B: Rows 35, 36, 37
  var summaryLabels = [
    ["Total Working Hours", ""],
    ["Total Overtime (OT) Hours", ""],
    ["Total Estimated Salary (LKR)", ""]
  ];
  var sumRange = sheet.getRange(35, 1, 3, 2);
  sumRange.setValues(summaryLabels);
  sheet.getRange(35, 1, 1, 2).merge().setBackground("#02353C").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("right");
  sheet.getRange(36, 1, 1, 2).merge().setBackground("#02353C").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("right");
  sheet.getRange(37, 1, 1, 2).merge().setBackground("#02353C").setFontColor("#C1F6ED").setFontWeight("bold").setHorizontalAlignment("right");

  return sheet;
}

/**
 * Find or append a 4-column block for an employee with custom colors & right alignment
 */
function getOrCreateEmployeeColumns(sheet, empName) {
  var lastCol = sheet.getLastColumn();
  
  // Search existing employees in Row 1 (starting from Column 3)
  if (lastCol >= 3) {
    var row1Values = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var c = 2; c < lastCol; c += 4) {
      if (row1Values[c] && row1Values[c].toString().trim().toLowerCase() === empName.trim().toLowerCase()) {
        return c + 1; // 1-based column index
      }
    }
  }

  // Employee not found -> append new 4-column group
  var newCol = Math.max(3, lastCol + 1);

  // Main Header (Row 1): Employee Full Name merged across 4 sub-columns
  sheet.getRange(1, newCol, 1, 4).merge()
    .setValue(empName)
    .setBackground("#02353C")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  // Sub-Headers (Row 2) with requested colors:
  // 1. Start at: Green (#2EAF7D)
  // 2. OFF at: Light Red (#F87171)
  // 3. Site: Light Blue (#60A5FA)
  // 4. Total Hours: Light Orange (#FB923C)
  var headers = [["Start at", "OFF at", "Site", "Total Hours"]];
  var subHeaderRange = sheet.getRange(2, newCol, 1, 4);
  subHeaderRange.setValues(headers);
  subHeaderRange.setFontColor("#FFFFFF");
  subHeaderRange.setFontWeight("bold");
  subHeaderRange.setHorizontalAlignment("center");

  sheet.getRange(2, newCol).setBackground("#2EAF7D");     // Green
  sheet.getRange(2, newCol + 1).setBackground("#F87171"); // Light Red
  sheet.getRange(2, newCol + 2).setBackground("#60A5FA"); // Light Blue
  sheet.getRange(2, newCol + 3).setBackground("#FB923C"); // Light Orange

  // Column Widths
  sheet.setColumnWidth(newCol, 95);     // Start
  sheet.setColumnWidth(newCol + 1, 95); // Off
  sheet.setColumnWidth(newCol + 2, 140);// Site
  sheet.setColumnWidth(newCol + 3, 105);// Total Hours

  // Right-align all data rows for this employee
  sheet.getRange(3, newCol, 31, 4).setHorizontalAlignment("right");

  // Summary cells styling (Rows 35, 36, 37)
  sheet.getRange(34, newCol, 1, 4).setBackground("#E2E8F0");
  sheet.getRange(35, newCol, 1, 4).setBackground("#F8FAFC").setHorizontalAlignment("right").setFontWeight("bold");
  sheet.getRange(36, newCol, 1, 4).setBackground("#F8FAFC").setHorizontalAlignment("right").setFontWeight("bold");
  sheet.getRange(37, newCol, 1, 4).setBackground("#ECFDF5").setHorizontalAlignment("right").setFontWeight("bold").setFontColor("#065F46");

  return newCol;
}

/**
 * Calculate working hours and format as "Total(OT)" e.g. "10(2)"
 */
function calculateWorkedHoursStats(startStr, offStr) {
  try {
    var parseTime = function(tStr) {
      var match = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return null;
      var h = parseInt(match[1], 10);
      var m = parseInt(match[2], 10);
      var ampm = match[3].toUpperCase();
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return h + m / 60;
    };

    var s = parseTime(startStr);
    var o = parseTime(offStr);
    if (s === null || o === null) return { totalPaid: 0, otHours: 0, displayStr: "" };

    var elapsed = o - s;
    if (elapsed < 0) elapsed += 24; // Handled midnight rollover

    // Deduct 1 hr lunch break if worked > 5 hours
    var paid = elapsed > 5.0 ? Math.max(0, elapsed - 1.0) : elapsed;
    paid = Math.round(paid * 10) / 10;

    // Overtime is hours in excess of 8 standard hours
    var ot = Math.max(0, paid - 8.0);
    ot = Math.round(ot * 10) / 10;

    // Format strictly as Total(OT) e.g. 10(2)
    var display = paid + "(" + ot + ")";
    return { totalPaid: paid, otHours: ot, displayStr: display };
  } catch (e) {
    return { totalPaid: 0, otHours: 0, displayStr: "" };
  }
}

/**
 * Recompute Monthly Summary Totals for an employee (Rows 35, 36, 37)
 */
function recalculateEmployeeMonthlySummary(sheet, colStart, dailyRate, otRate) {
  try {
    var hoursCol = colStart + 3; // 4th sub-column
    var values = sheet.getRange(3, hoursCol, 31, 1).getValues();

    var sumTotalPaid = 0;
    var sumOT = 0;
    var daysWorked = 0;

    for (var i = 0; i < values.length; i++) {
      var cellVal = values[i][0] ? values[i][0].toString() : "";
      var match = cellVal.match(/([\d.]+)\(([\d.]+)\)/);
      if (match) {
        var p = parseFloat(match[1]);
        var o = parseFloat(match[2]);
        sumTotalPaid += p;
        sumOT += o;
        daysWorked++;
      }
    }

    sumTotalPaid = Math.round(sumTotalPaid * 10) / 10;
    sumOT = Math.round(sumOT * 10) / 10;

    // Estimated Salary = (Days Worked * Daily Rate) + (Total OT * OT Rate)
    var totalSalary = (daysWorked * dailyRate) + (sumOT * otRate);

    // Row 35: Total Working Hours
    sheet.getRange(35, hoursCol).setValue(sumTotalPaid + " hrs");
    // Row 36: Total OT Hours
    sheet.getRange(36, hoursCol).setValue(sumOT + " hrs");
    // Row 37: Total Salary
    sheet.getRange(37, hoursCol).setValue("Rs. " + totalSalary.toLocaleString());
  } catch (e) {}
}
