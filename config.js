// config.js - Enhanced version
module.exports = {
  // Environment variables - a7san o amn aktar
  username: process.env.LT_USERNAME || 'l_shipilov',
  accessKey: process.env.LT_ACCESS_KEY || 'your-key-here',
  tunnelName: process.env.LT_TUNNEL || 'cacd17af-2f7f-4aab-886f-b6b5c907957e',
  
  // Device categories - organized a7san
  devices: {
    samsung: [
      'Samsung Galaxy S20',
      'Samsung Galaxy S21',
      'Samsung Galaxy Note 20',
      'Samsung Galaxy S20+',
      'Samsung Galaxy S25'
    ],
    premium: [
      'OnePlus 9',
      'iPhone 12', 
      'iPhone 13'
    ],
    others: [
      'Huawei P40'
    ]
  },
  
  // Test settings
  settings: {
    appToSearch: 'Google Chrome',
    timeout: 30000,
    retries: 3,
    platformVersion: '12'
  }
};