//拿 api 裡面的 ads.txt 填到 google sheet 裡面
function fetchAdsTxtData() {
  var spreadsheetId = '1InVJQMOs2qqoxp1ovFVp_gQQFnzvFR5EKwRsC1xBiBg';
  var sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();
  var lastRow = sheet.getLastRow();
  
  // 取出上次處理的行數，並使用 parseInt 確保它是整數
  var startRow = parseInt(PropertiesService.getScriptProperties().getProperty('lastProcessedRow')) || 2;
  var batchSize = 300; // 調整批次處理大小
  var endRow = Math.min(startRow + batchSize - 1, lastRow);
  
  var manualCookie = "AOTTERBD_SESSION=...";
  
  for (var i = startRow; i <= endRow; i++) {
    var appName = sheet.getRange(i, 5).getValue(); // E列，App Name
    
    if (appName) {
      var apiUrl = 'https://trek.aotter.net/publisher.action_app/getadstxt/?appName=' + appName;
      
      try {
        var response = UrlFetchApp.fetch(apiUrl, {
          "headers": {
            "Cookie": manualCookie
          }
        });
        var content = response.getContentText();
        var lines = content.split('\n');
        
        var asealValue = '', teadsValue = '', ucfunnelValue = '', smaatoValue = '';
        
        lines.forEach(function(line) {
          if (line.startsWith('aseal')) asealValue = line;
          else if (line.startsWith('teads')) teadsValue = line;
          else if (line.startsWith('ucfunnel')) ucfunnelValue = line;
          else if (line.startsWith('smaato')) smaatoValue = line;
        });
        
        sheet.getRange(i, 22).setValue(asealValue);
        sheet.getRange(i, 23).setValue(teadsValue);
        sheet.getRange(i, 24).setValue(ucfunnelValue);
        sheet.getRange(i, 25).setValue(smaatoValue);
        
        Logger.log('Processed app: ' + appName + ' (row ' + i + ')');
        
      } catch (error) {
        Logger.log('Error fetching data for app: ' + appName + ' at row ' + i + ' - ' + error);
      }
    } else {
      Logger.log('No app name found at row ' + i);
    }
  }
  
  // 確保保存的行數是整數
  if (endRow < lastRow) {
    PropertiesService.getScriptProperties().setProperty('lastProcessedRow', (endRow + 1).toString());
    ScriptApp.newTrigger('fetchAdsTxtData').timeBased().after(5000).create(); // 5秒後繼續執行
  } else {
    PropertiesService.getScriptProperties().deleteProperty('lastProcessedRow');
    Logger.log('Processing completed.');
  }
}

function checkAdsTxtSetupStatus() {
  var spreadsheetId = '1InVJQMOs2qqoxp1ovFVp_gQQFnzvFR5EKwRsC1xBiBg';
  var sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();
  var lastRow = sheet.getLastRow();
  
  // 從 PropertiesService 中取出上次處理的行數，如果沒有則從第 2 行開始
  var startRow = parseInt(PropertiesService.getScriptProperties().getProperty('lastProcessedRow')) || 2;
  var batchSize = 300; // 每次處理 30 行，根據需要調整
  var endRow = Math.min(startRow + batchSize - 1, lastRow);
  
  for (var i = startRow; i <= endRow; i++) {
    var adsUrl = sheet.getRange(i, 21).getValue(); // U列，第21欄，ads.txt_url
    var asealValue = sheet.getRange(i, 22).getValue(); // V列，aseal_ads.txt
    var teadsValue = sheet.getRange(i, 23).getValue(); // W列，Teads_ads.txt
    var ucfunnelValue = sheet.getRange(i, 24).getValue(); // X列，ucfunnel_ads.txt
    var smaatoValue = sheet.getRange(i, 25).getValue(); // Y列，smaato_ads.txt
    var setupStatus = ''; // 記錄設置狀況
    
    Logger.log('Processing row ' + i + ' for ads.txt_url: ' + adsUrl);
    
    if (adsUrl) {
      try {
        var response = UrlFetchApp.fetch('https://' + adsUrl, {muteHttpExceptions: true});
        var responseCode = response.getResponseCode();
        
        if (responseCode === 200) {
          var content = response.getContentText();
          
          // 檢查每個項目的值
          setupStatus += asealValue && content.includes(asealValue) ? 'aseal 正確設置\n' : 'aseal 未設置\n';
          setupStatus += teadsValue && content.includes(teadsValue) ? 'teads 正確設置\n' : 'teads 未設置\n';
          setupStatus += ucfunnelValue && content.includes(ucfunnelValue) ? 'ucfunnel 正確設置\n' : 'ucfunnel 未設置\n';
          setupStatus += smaatoValue && content.includes(smaatoValue) ? 'smaato 正確設置\n' : 'smaato 未設置\n';
        } else {
          setupStatus = '未設置 - 沒有 ads.txt\n';
        }
      } catch (error) {
        setupStatus = '未設置 - 沒有 ads.txt\n';
      }
    } else {
      setupStatus = '未設置 - 無 ads.txt_url\n';
    }
    
    // 設置狀況寫入 AA 列
    sheet.getRange(i, 27).setValue(setupStatus); // AA列
  }
  
  // 批量標記顏色
  batchHighlightText(sheet, '未設置', 'red', endRow);
  batchHighlightText(sheet, '正確設置', 'green', endRow);
  
  // 儲存進度並設定下一次觸發
  if (endRow < lastRow) {
    PropertiesService.getScriptProperties().setProperty('lastProcessedRow', (endRow + 1).toString());
    ScriptApp.newTrigger('checkAdsTxtSetupStatus').timeBased().after(5000).create(); // 5 秒後觸發
  } else {
    PropertiesService.getScriptProperties().deleteProperty('lastProcessedRow');
    Logger.log('Processing completed.');
  }
}


function batchHighlightText(sheet, text, color, endRow) {
  var range = sheet.getRange(2, 27, endRow - 1); // 假設從第二行開始
  var textFinder = range.createTextFinder(text).matchEntireCell(true);
  var cells = textFinder.findAll();
  
  cells.forEach(function(cell) {
    cell.setFontColor(color);
  });
}


// 用來批量標記文字顏色
function batchHighlightText(sheet, searchText, color, lastRow) {
  Logger.log('Start highlighting "' + searchText + '" with color ' + color);
  
  var range = sheet.getRange(2, 27, lastRow - 1, 1); // AA列從第2行開始
  var values = range.getValues();
  var richTextValues = range.getRichTextValues();
  
  for (var i = 0; i < values.length; i++) {
    var cellText = values[i][0];
    if (cellText.includes(searchText)) {
      Logger.log('Checking row ' + (i + 2) + ' for "' + searchText + '"');
      
      var startIndex = cellText.indexOf(searchText);
      while (startIndex !== -1) {
        var endIndex = startIndex + searchText.length;
        var richText = richTextValues[i][0];
        
        var richTextStyle = SpreadsheetApp.newTextStyle()
          .setForegroundColor(color)
          .build();
        
        var newRichText = richText.copy()
          .setTextStyle(startIndex, endIndex, richTextStyle)
          .build();
        
        richTextValues[i][0] = newRichText;
        
        Logger.log('Highlighted "' + searchText + '" at row ' + (i + 2) + ' from index ' + startIndex + ' to ' + endIndex);
        
        // 繼續尋找下一個出現的索引
        startIndex = cellText.indexOf(searchText, endIndex);
      }
    }
  }
  
  // 批量更新RichText
  range.setRichTextValues(richTextValues);
  Logger.log('Finished highlighting "' + searchText + '" with color ' + color);
}
