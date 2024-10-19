//Code.gs
var cachedData = null;
var lastFetchTime = null;
var SPREADSHEET_ID = '1InVJQMOs2qqoxp1ovFVp_gQQFnzvFR5EKwRsC1xBiBg';
var AUTHORIZED_USERS = ['ian.chen@aotter.net', 'cjay@aotter.net', 'coki.lu@aotter.net', 'john.chiu@aotter.net', 'phsu@aotter.net', 'robert.hsueh@aotter.net', 'smallmouth@aotter.net', 's6354@hotmail.com'];

function doGet(e) {
  Logger.log('Authorized Users: ' + JSON.stringify(AUTHORIZED_USERS));
  
  var user = 'Unknown';
  var errorMessage = '';
  
  try {
    user = Session.getActiveUser().getEmail();
    Logger.log('User email retrieved: ' + user);
  } catch (error) {
    errorMessage = 'Error getting user email: ' + error.toString();
    Logger.log(errorMessage);
  }
  
  var isAuthorized = AUTHORIZED_USERS.includes(user);
  Logger.log('Is user authorized: ' + isAuthorized);
  
  if (isAuthorized) {
    Logger.log('Access granted. Returning main page.');
    return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('DSP 監控系統，看串接狀況')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else {
    Logger.log('Access denied. Returning error page.');
    var output = HtmlService.createHtmlOutput(`
      <h1>對不起，您沒有權限訪問此頁面。</h1>
      <script>
        function checkManualAuth() {
          var email = document.getElementById('email').value;
          google.script.run.withSuccessHandler(function(result) {
            if (result) {
              window.location.reload();
            } else {
              alert('驗證失敗，您沒有權限訪問此頁面。');
            }
          }).checkManualAuth(email);
        }
      </script>
    `)
    .setTitle('訪問被拒絕')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
    return output;
  }
}

function checkManualAuth(email) {
  Logger.log('Checking manual auth for email: ' + email);
  var isAuthorized = AUTHORIZED_USERS.includes(email);
  Logger.log('Manual auth result: ' + isAuthorized);
  return isAuthorized;
}

function getPublishers() {
  if (cachedData && lastFetchTime && (new Date().getTime() - lastFetchTime < 60000)) {
    return cachedData;
  }

  try {
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = spreadsheet.getSheetByName('Sheet1');
    if (!sheet) throw new Error('在指定的 spreadsheet 中找不到 Sheet1');

    var data = sheet.getDataRange().getValues();

    // Normalize headers (trim spaces and convert to lowercase)
    var headers = data[0].map(function(header) {
      return header.trim().toLowerCase();
    });

    // Get index for ads.txt status column
    var adsTxtStatusIndex = headers.indexOf('ads.txt 設置狀況');
    if (adsTxtStatusIndex === -1) {
      throw new Error('找不到 "ads.txt 設置狀況" 列');
    }
    
    // DSP columns (例如: CRITEO, FREAKOUTBANNER 等)
    var dspColumns = ['criteo', 'freakoutbanner', 'smaatonative', 'ucfunnelnative', 'ucfunnelbanner', 'freakoutvastxml', 'smaatobanner'];

    var publishers = data.slice(1).reduce(function(acc, row) {
      var item = headers.reduce(function(obj, header, index) {
        obj[header] = row[index];
        return obj;
      }, {});

      var orgId = item['org id'];
      var clientId = item['client id'];
      var placeUid = item['place uid'];

      if (!acc[orgId]) {
        acc[orgId] = {
          orgName: item['org name'],
          orgId: orgId,
          apps: {}
        };
      }

      if (!acc[orgId].apps[clientId]) {
        acc[orgId].apps[clientId] = {
          appName: item['app name'],
          clientId: clientId,
          platform: item['platform'],
          places: {}
        };
      }

      if (!acc[orgId].apps[clientId].places[placeUid]) {
        // 檢查 ads.txt 狀態
        var adsTxtStatus = item['ads.txt 設置狀況'] || '';
        var adsTxtLines = adsTxtStatus.split('\n');
        var hasAsealSellerJson = adsTxtLines.some(line => line.includes('aseal 正確設置'));
        var hasTeadsSellerJson = adsTxtLines.some(line => line.includes('teads 正確設置'));
        var hasUcfunnelSellerJson = adsTxtLines.some(line => line.includes('ucfunnel 正確設置'));
        var hasSmaatoSellerJson = adsTxtLines.some(line => line.includes('smaato 正確設置'));

        // 列出所有 DSP 項目並檢查串接狀況
        var dspSettingList = dspColumns.map(function(dspName) {
          var status = 'not_connected'; // 預設為未串接

          // 確認該 DSP 的狀態是否是有效的
          if (item[dspName]) {
            var dspStatus = item[dspName].trim().toLowerCase();
            if (dspStatus === '✓' || dspStatus === 'connected') { // 檢查 '✓' 或其他可能的標記
              status = 'normal';
            } else if (dspStatus === 'paused') {
              status = 'paused';
            } else if (dspStatus === 'abnormal') {
              status = 'abnormal';
            }
          }

          return {
            dspName: dspName.toUpperCase(),
            status: status,
            fillRate: item[dspName + ' fill rate'] || 0
          };
        });

        // 根據 compatibilityMap 標註 DSPs 是否兼容，但不過濾
        const compatibleDsps = getCompatibleDsps(item['platform'], item['place type'], `${item['width']}x${item['height']}`);

        dspSettingList = dspSettingList.filter(dsp => compatibleDsps.includes(dsp.dspName)); // 只保留兼容的 DSP

        acc[orgId].apps[clientId].places[placeUid] = {
          place: item['place'],
          placeType: item['place type'],
          placeUid: placeUid,
          width: item['width'] || 'N/A',
          height: item['height'] || 'N/A',
          size: (item['width'] && item['height']) ? item['width'] + 'x' + item['height'] : 'N/A',
          request: item['request'] || '0',
          dspSettingList: dspSettingList,
          hasAsealSellerJson: hasAsealSellerJson,
          hasTeadsSellerJson: hasTeadsSellerJson,
          hasUcfunnelSellerJson: hasUcfunnelSellerJson,
          hasSmaatoSellerJson: hasSmaatoSellerJson
        };
      }
      return acc;
    }, {});

    var result = { publishers: Object.values(publishers) };

    cachedData = result;
    lastFetchTime = new Date().getTime();

    return result;
  } catch (error) {
    Logger.log('Error in getPublishers: ' + error.toString());
    throw new Error('獲取發布商數據失敗: ' + error.message);
  }
}

// 定義 getCompatibleDsps 函數
function getCompatibleDsps(platform, placeType, size) {
const compatibilityMap = {
  IOS: {
    NATIVE: ["CRITEO", "SMAATONATIVE", "UCFUNNELNATIVE"],
    BANNER: {
      "320x50": ["FREAKOUTBANNER", "UCFUNNELBANNER"],
      "300x250": ["UCFUNNELBANNER"],
    },
    SUPR_AD: {
      "1200x628": ["FREAKOUTBANNER", "SMAATONATIVE", "UCFUNNELBANNER"],
    },
  },
  WEB: {
    NATIVE: ["UCFUNNELNATIVE"],
    BANNER: {
      "320x50": ["CRITEO", "UCFUNNELBANNER"],
      "300x250": ["CRITEO", "UCFUNNELBANNER"],
    },
    SUPR_AD: {
      "336x280": ["FREAKOUTBANNER", "CRITEO"],
      "300x250": ["FREAKOUTBANNER", "CRITEO", "UCFUNNELBANNER"],
    },
  },
  ANDROID: {
    NATIVE: ["CRITEO", "SMAATONATIVE", "UCFUNNELNATIVE"],
    BANNER: {
      "320x50": ["FREAKOUTBANNER", "UCFUNNELBANNER"],
      "300x250": ["UCFUNNELBANNER"],
    },
    SUPR_AD: {
      "1200x628": ["FREAKOUTBANNER", "SMAATONATIVE", "UCFUNNELBANNER"],
    },
  }
};

  // 根據 platform 和 placeType 選擇符合的 DSPs
  if (!platform || !compatibilityMap[platform]) return [];
  const platformMap = compatibilityMap[platform];
  if (!platformMap[placeType]) return [];
  if (size && platformMap[placeType][size]) {
    return platformMap[placeType][size]; // 返回符合 size 的 DSPs
  }
  return Object.values(platformMap[placeType]).flat(); // 返回所有相關 DSPs
}