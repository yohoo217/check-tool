//拿 api 裡面的 ads.txt 填到 google sheet 裡面
function fetchAdsTxtData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  
  // 設定 API 請求時所使用的 Cookie
  var manualCookie = "AOTTERBD_SESSION=757418f543a95a889184e798ec5ab66d4fad04e5-lats=1724229220332&sso=PIg4zu/Vdnn/A15vMEimFlVAGliNhoWlVd5FTvtEMRAFpk/VvBGvAetanw8DLATSLexy9pee/t52uNojvoFS2Q==;aotter=eyJ1c2VyIjp7ImlkIjoiNjNkYjRkNDBjOTFiNTUyMmViMjk4YjBkIiwiZW1haWwiOiJpYW4uY2hlbkBhb3R0ZXIubmV0IiwiY3JlYXRlZEF0IjoxNjc1MzE2NTQ0LCJlbWFpbFZlcmlmaWVkIjp0cnVlLCJsZWdhY3lJZCI6bnVsbCwibGVnYWN5U2VxSWQiOjE2NzUzMTY1NDQ3ODI5NzQwMDB9LCJhY2Nlc3NUb2tlbiI6IjJkYjQyZTNkOTM5MDUzMjdmODgyZmYwMDRiZmI4YmEzZjBhNTlmMDQwYzhiN2Y4NGY5MmZmZTIzYTU0ZTQ2MDQiLCJ1ZWEiOm51bGx9; *Secure-1PSID=vlPPgXupFroiSjP1/A02minugZVZDgIG4K; *Secure-1PSIDCC=g.a000mwhavReSVd1vN09AVTswXkPAhyuW7Tgj8-JFhj-FZya9I_l1B6W2gqTIWAtQUTQMkTxoAwACgYKAW0SARISFQHGX2MiC--NJ2PzCzDpJ0m3odxHhxoVAUF8yKr8r49abq8oe4UxCA0t_QCW0076; *Secure-3PSID=AKEyXzUuXI1zywmFmkEBEBHfg6GRkRM9cJ9BiJZxmaR46x5im*krhaPtmL4Jhw8gQsz5uFFkfbc; _Secure-3PSIDCC=sidts-CjEBUFGohzUF6oK3ZMACCk2peoDBDp6djBwJhGc4Lxgu2zOlzbVFeVpXF4q1TYZ5ba6cEAA";

  for (var i = 2; i <= lastRow; i++) { // 從第二行開始處理，跳過標題行
    var appName = sheet.getRange(i, 5).getValue(); // E列，第5欄，App Name
    
    if (appName) {
      var apiUrl = 'https://trek.aotter.net/publisher.action_app/getadstxt/?appName=' + appName;
      
      try {
        var response = UrlFetchApp.fetch(apiUrl, {
          "headers": {
            "Cookie": manualCookie
          }
        });
        var content = response.getContentText();
        
        // 記錄 API 回傳的內容到日誌
        Logger.log('API Response for app: ' + appName + ' (row ' + i + '): ' + content);
        
        // 將回傳內容按行分割
        var lines = content.split('\n');
        
        // 初始化變數來儲存要填入的值
        var asealValue = '';
        var teadsValue = '';
        var ucfunnelValue = '';
        var smaatoValue = '';
        
        // 遍歷每一行
        lines.forEach(function(line) {
          if (line.startsWith('aseal')) {
            asealValue = line;
          } else if (line.startsWith('teads')) {
            teadsValue = line;
          } else if (line.startsWith('ucfunnel')) {
            ucfunnelValue = line;
          } else if (line.startsWith('smaato')) {
            smaatoValue = line;
          }
        });
        
        // 將結果寫回對應的 V, W, X, Y 列
        sheet.getRange(i, 22).setValue(asealValue);  // V列
        sheet.getRange(i, 23).setValue(teadsValue);  // W列
        sheet.getRange(i, 24).setValue(ucfunnelValue); // X列
        sheet.getRange(i, 25).setValue(smaatoValue); // Y列
        
        Logger.log('Processed app: ' + appName + ' (row ' + i + ')');
        
      } catch (error) {
        Logger.log('Error fetching data for app: ' + appName + ' at row ' + i + ' - ' + error);
      }
    } else {
      Logger.log('No app name found at row ' + i);
    }
  }
  
  Logger.log('Processing completed.');
}

function checkAdsTxtSetupStatus() {//判斷是否正確設置，會讀取 ads.txt 路徑下的檔案裡面是否有符合 google sheet 裡面的值
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  
  for (var i = 510; i <= lastRow; i++) { // 從第二行開始處理，跳過標題行
    var adsUrl = sheet.getRange(i, 21).getValue(); // U列，第21欄，ads.txt_url
    var asealValue = sheet.getRange(i, 22).getValue(); // V列，aseal_ads.txt
    var teadsValue = sheet.getRange(i, 23).getValue(); // W列，Teads_ads.txt
    var ucfunnelValue = sheet.getRange(i, 24).getValue(); // X列，ucfunnel_ads.txt
    var smaatoValue = sheet.getRange(i, 25).getValue(); // Y列，smaato_ads.txt
    var setupStatus = ''; // 用於記錄設置狀況
    
    // 記錄正在處理的行
    Logger.log('Processing row ' + i + ' for ads.txt_url: ' + adsUrl);
    
    if (adsUrl) {
      try {
        // 爬取 ads.txt 的內容
        var response = UrlFetchApp.fetch('https://' + adsUrl, {muteHttpExceptions: true});
        var responseCode = response.getResponseCode();
        
        if (responseCode === 200) {
          var content = response.getContentText();
          
          Logger.log('Fetched ads.txt content for row ' + i + ': ' + content);
          
          // 檢查是否包含對應的值，每個項目分行輸出
          if (asealValue && content.includes(asealValue)) {
            setupStatus += 'aseal 正確設置\n';
          } else {
            setupStatus += 'aseal 未設置\n';
          }
          
          if (teadsValue && content.includes(teadsValue)) {
            setupStatus += 'teads 正確設置\n';
          } else {
            setupStatus += 'teads 未設置\n';
          }
          
          if (ucfunnelValue && content.includes(ucfunnelValue)) {
            setupStatus += 'ucfunnel 正確設置\n';
          } else {
            setupStatus += 'ucfunnel 未設置\n';
          }
          
          if (smaatoValue && content.includes(smaatoValue)) {
            setupStatus += 'smaato 正確設置\n';
          } else {
            setupStatus += 'smaato 未設置\n';
          }
          
        } else {
          Logger.log('Failed to fetch ads.txt for row ' + i + '. Response code: ' + responseCode);
          setupStatus = '未設置 - 沒有 ads.txt\n';
        }
        
      } catch (error) {
        Logger.log('Error fetching ads.txt for URL: ' + adsUrl + ' at row ' + i + ' - ' + error);
        setupStatus = '未設置 - 沒有 ads.txt\n';
      }
    } else {
      Logger.log('No ads.txt_url found at row ' + i);
      setupStatus = '未設置 - 無 ads.txt_url\n';
    }
    
    // 將設置狀況寫入 AA 列
    sheet.getRange(i, 27).setValue(setupStatus); // AA列
    Logger.log('Setup status for row ' + i + ': ' + setupStatus);
  }

  // 批量標記“未設置”和“正確設置”的文字顏色
  batchHighlightText(sheet, '未設置', 'red', lastRow);
  batchHighlightText(sheet, '正確設置', 'green', lastRow);
  
  Logger.log('Processing completed.');
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
