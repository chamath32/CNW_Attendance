/**
 * CNW WORKFORCE — MATRIX-STYLE MONTHLY GOOGLE APPS SCRIPT WEBHOOK
 * 
 * SPREADSHEET STRUCTURE:
 * - Each tab represents one Month: "YYYY-MM" (e.g., "2026-11", "2026-12")
 * - Rows 3 to 33: Each row represents one Date of the month (Day 1 to 31).
 * - Columns A & B: Date and Day of Week.
 * - Columns C onward: Each employee gets a Main Column with 4 Sub-columns:
 *     1. START at
 *     2. OFF at
 *     3. Site
 *     4. Total Working Hours
 * - If a new employee logs in, it automatically creates a new 4-column group!
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

    // Determine Event Date in Sri Lanka timezone
    var eventDateStr = data.effectiveEventTime || new Date().toISOString();
    var eventDate = new Date(eventDateStr);
    
    // YYYY-MM tab name
    var yearMonth = Utilities.formatDate(eventDate, "Asia/Colombo", "yyyy-MM");
    var dayOfMonth = parseInt(Utilities.formatDate(eventDate, "Asia/Colombo", "d"), 10);
    var formattedTime = Utilities.formatDate(eventDate, "Asia/Colombo", "hh:mm a");

    // Employee and Site identifiers
    var empName = data.employeeName || data.employeeId || "Employee";
    var empCode = data.employeeCode || "";
    var empLabel = empCode ? (empName + " (" + empCode + ")") : empName;
    var siteName = data.siteName || data.siteId || "";
    var eventType = (data.eventType || "").toUpperCase();

    // Check or create monthly sheet tab
    var sheet = ss.getSheetByName(yearMonth);
    if (!sheet) {
      sheet = initializeMonthlySheet(ss, yearMonth, eventDate);
    }

    // Locate or create the 4-column block for this employee
    var colStart = getOrCreateEmployeeColumns(sheet, empLabel);

    // Target row for this day of the month: Row = 2 + dayOfMonth
    var targetRow = 2 + dayOfMonth;

    // Sub-columns:
    // colStart: START
    // colStart + 1: OFF
    // colStart + 2: SITE
    // colStart + 3: TOTAL HOURS
    var startCell = sheet.getRange(targetRow, colStart);
    var offCell = sheet.getRange(targetRow, colStart + 1);
    var siteCell = sheet.getRange(targetRow, colStart + 2);
    var hoursCell = sheet.getRange(targetRow, colStart + 3);

    if (eventType === "START") {
      startCell.setValue(formattedTime);
      siteCell.setValue(siteName);
    } else if (eventType === "MOVE") {
      var currentSite = siteCell.getValue();
      siteCell.setValue(currentSite ? (currentSite + " -> " + siteName) : siteName);
    } else if (eventType === "OFF") {
      offCell.setValue(formattedTime);
      if (!siteCell.getValue()) {
        siteCell.setValue(siteName);
      }
      
      // Calculate working hours if start time exists
      var startVal = startCell.getValue();
      if (startVal) {
        hoursCell.setValue(calculateWorkedHours(startVal.toString(), formattedTime));
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      sheet: yearMonth, 
      day: dayOfMonth, 
      employee: empLabel 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Initialize a new monthly sheet with Date rows (1 to 31)
 */
function initializeMonthlySheet(ss, yearMonth, dateInMonth) {
  var sheet = ss.insertSheet(yearMonth);
  
  // Header Row 1 & 2 for Date & Day
  sheet.getRange(1, 1, 2, 1).merge().setValue("Date").setBackground("#02353C").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.getRange(1, 2, 2, 1).merge().setValue("Day").setBackground("#02353C").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 90);
  sheet.setFrozenColumns(2);
  sheet.setFrozenRows(2);

  // Determine days in this month
  var parts = yearMonth.split("-");
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var daysInMonth = new Date(year, month, 0).getDate();

  var dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Populate Days 1 to daysInMonth
  var dateRows = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var curDate = new Date(year, month - 1, d);
    var dateString = year + "-" + (month < 10 ? "0" + month : month) + "-" + (d < 10 ? "0" + d : d);
    var dayOfWeek = dayNames[curDate.getDay()];
    dateRows.push([dateString, dayOfWeek]);
  }

  sheet.getRange(3, 1, daysInMonth, 2).setValues(dateRows);

  // Alternate row shading for readability
  for (var r = 3; r < 3 + daysInMonth; r++) {
    if (r % 2 === 0) {
      sheet.getRange(r, 1, 1, 2).setBackground("#F8FAFC");
    }
  }

  return sheet;
}

/**
 * Find or append a 4-column group for an employee
 */
function getOrCreateEmployeeColumns(sheet, empLabel) {
  var lastCol = sheet.getLastColumn();
  
  // Search existing employees in Row 1 (starting from Column 3)
  if (lastCol >= 3) {
    var row1Values = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var c = 2; c < lastCol; c += 4) {
      if (row1Values[c] && row1Values[c].toString().trim() === empLabel.trim()) {
        return c + 1; // 1-based column index
      }
    }
  }

  // Employee not found -> append new 4-column block
  var newCol = Math.max(3, lastCol + 1);

  // Main Header (Row 1): Employee Name merged across 4 sub-columns
  sheet.getRange(1, newCol, 1, 4).merge()
    .setValue(empLabel)
    .setBackground("#02353C")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  // Sub-Headers (Row 2): START, OFF, Site, Total Hours
  var subHeaders = [["Start at", "OFF at", "Site", "Total Hours"]];
  sheet.getRange(2, newCol, 1, 4).setValues(subHeaders)
    .setBackground("#2EAF7D")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  // Format column widths
  sheet.setColumnWidth(newCol, 95);     // Start
  sheet.setColumnWidth(newCol + 1, 95); // Off
  sheet.setColumnWidth(newCol + 2, 130);// Site
  sheet.setColumnWidth(newCol + 3, 90); // Hours

  return newCol;
}

/**
 * Approximate elapsed hours between two "hh:mm a" time strings
 */
function calculateWorkedHours(startStr, offStr) {
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
    if (s === null || o === null) return "";

    var diff = o - s;
    if (diff < 0) diff += 24; // Handled midnight crossing
    // Deduct 1 hour lunch break if worked > 5 hours
    var paid = diff > 5.0 ? Math.max(0, diff - 1.0) : diff;
    return Math.round(paid * 10) / 10 + " hrs";
  } catch (e) {
    return "";
  }
}
