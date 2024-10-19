var cachedData = null;
var lastFetchTime = null;
var SPREADSHEET_ID = '1InVJQMOs2qqoxp1ovFVp_gQQFnzvFR5EKwRsC1xBiBg';
var AUTHORIZED_USERS = ['ian.chen@aotter.net', 'cjay@aotter.net', 'coki.lu@aotter.net', 'john.chiu@aotter.net', 'phsu@aotter.net', 'robert.hsueh@aotter.net', 'smallmouth@aotter.net', 's6354@hotmail.com'];

Logger.log('doGet started');
Logger.log('Authorized Users: ' + JSON.stringify(AUTHORIZED_USERS));

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

function getPublishers(startIndex, batchSize) {
  // Default batch size to 100 if not provided
  batchSize = batchSize || 100;
  startIndex = startIndex || 1;  // Skip the header row

  try {
    Logger.log('Fetching data from spreadsheet');
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = spreadsheet.getSheetByName('Sheet1');
    if (!sheet) {
      Logger.log('Sheet1 not found in spreadsheet');
      throw new Error('在指定的 spreadsheet 中找不到 Sheet1');
    }
    var data = sheet.getDataRange().getValues();
    Logger.log('Data fetched');

    var headers = data[0];
    var publishers = data.slice(startIndex, startIndex + batchSize).reduce(function (acc, row) {
      var item = headers.reduce(function (obj, header, index) {
        obj[header] = row[index];
        return obj;
      }, {});

      var orgId = item['orgId'];
      var clientId = item['clientId'];
      var placeUid = item['placeUid'];

      if (!acc[orgId]) {
        acc[orgId] = {
          orgId: orgId,
          apps: {}
        };
      }

      if (!acc[orgId].apps[clientId]) {
        acc[orgId].apps[clientId] = {
          clientId: clientId,
          platform: item['platform'],
          places: {}
        };
      }

      if (!acc[orgId].apps[clientId].places[placeUid]) {
        var adsTxtSetupStatus = item['ads.txt 設置狀況'];  // Assuming this is the column header for AA

        acc[orgId].apps[clientId].places[placeUid] = {
          place: item['place'],
          placeType: item['place type'],
          placeUid: placeUid,
          size: (item['width'] && item['height']) ? item['width'] + 'x' + item['height'] : 'N/A',
          request: item['request'] || '0',
          adsTxtSetupStatus: adsTxtSetupStatus  // Include the ads.txt setup status
        };

        var dspStatus = {};
        var dspColumns = ['CRITEO', 'FREAKOUTBANNER', 'SMAATONATIVE', 'UCFUNNELNATIVE', 'UCFUNNELBANNER', 'FREAKOUTVASTXML', 'SMAATOBANNER'];
        dspColumns.forEach(function (dsp) {
          var index = headers.indexOf(dsp);
          if (index !== -1) {
            dspStatus[dsp] = row[index] === '✓' ? '正常' : '未串接';
          }
        });

        acc[orgId].apps[clientId].places[placeUid].dspStatus = dspStatus;
      }
      return acc;
    }, {});

    cachedData = publishers;
    lastFetchTime = new Date().getTime();

    return {
      publishers: Object.values(publishers),
      nextStartIndex: startIndex + batchSize < data.length ? startIndex + batchSize : null  // Return next batch start index if available
    };
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
    ANDROID: {  // 新增 Android 平台的 DSP 配置
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
