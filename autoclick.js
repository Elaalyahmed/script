require('dotenv').config();
const { remote } = require("webdriverio");

// Default configuration - embedded directly in script
const DEFAULT_CONFIG = {
  devices: [
    'Galaxy S23',
    'Galaxy S22', 
    'Pixel 7',
    'Pixel 6',
    'Galaxy S24'
  ],
  settings: {
    appToSearch: 'Google Chrome',
    timeout: 30000,
    platformVersion: '13',
    waitTime: 5000
  }
};

// Try to load external config, fallback to default
let config;
try {
  config = require('./config');
  console.log("config.js file loaded");
  
  // Ensure devices is an array
  if (!config.devices || !Array.isArray(config.devices) || config.devices.length === 0) {
    console.log(" Invalid config.devices, using default devices");
    config.devices = DEFAULT_CONFIG.devices;
  }
  
  // Ensure settings exist
  if (!config.settings) {
    config.settings = DEFAULT_CONFIG.settings;
  }
  
} catch (error) {
  console.log("⚠️ config.js not found, using default settings");
  config = DEFAULT_CONFIG;
}

// Device capabilities mapping
const DEVICE_MAP = {
  'Galaxy S24': { version: '14', reliable: true },
  'Galaxy S23': { version: '13', reliable: true },
  'Galaxy S22': { version: '12', reliable: true },
  'Pixel 7': { version: '13', reliable: true },
  'Pixel 6': { version: '12', reliable: true },
  'OnePlus 11': { version: '13', reliable: false },
  'Galaxy Note 20': { version: '11', reliable: false }
};

/**
 * Generates a random number for usernames.
 * @returns {number} A random number.
 */
function randomNumber() {
  return Math.floor(Math.random() * 10000);
}

/**
 * Performs the Play Store search and download flow.
 * @param {string} deviceName The name of the device to run the test on.
 * @returns {Promise<Object>} An object with the test results.
 */
async function runPlayStoreDownloadFlow(deviceName) {
  let driver;
  const startTime = Date.now();
  
  try {
    // Validate credentials from environment variables
    const username = process.env.LT_USERNAME;
    const accessKey = process.env.LT_ACCESS_KEY;
    
    if (!username || !accessKey) {
      throw new Error(" LambdaTest credentials missing! Check your .env file");
    }
    
    console.log(` Starting test on: ${deviceName}`);
    console.log(`User: ${username}`);
    console.log(` Access Key: ${accessKey.slice(0, 10)}...`);
    
    const deviceConfig = DEVICE_MAP[deviceName] || { version: '12', reliable: false };
    
    // Set up the capabilities for the device
    const capabilities = {
      platformName: "Android",
      "appium:appPackage": "com.android.vending",
      "appium:appActivity": "com.google.android.finsky.activities.MainActivity",
      "appium:automationName": "UiAutomator2",
      "LT:Options": {
        user: username,
        accessKey: accessKey,
        build: `PlayStore-Download-${Date.now()}`,
        name: `PlayStore Download Test - ${deviceName}`,
        deviceName: deviceName,
        platformVersion: deviceConfig.version,
        isRealMobile: true,
        w3c: true,
        visual: true,
        video: true,
        network: true,
        console: true,
        timezone: "UTC+01:00",
        location: "MA",
        timeout: 900,
        idleTimeout: 300,
        project: "Mobile Automation",
        tags: ["playstore", "download", deviceName.toLowerCase().replace(/\s+/g, '-')]
      }
    };

    console.log(` Device capabilities: ${JSON.stringify(capabilities, null, 2)}`);

    driver = await remote({
      protocol: "https",
      hostname: "mobile-hub.lambdatest.com",
      port: 443,
      path: "/wd/hub",
      capabilities,
      connectionRetryTimeout: 120000,
      connectionRetryCount: 5,
      logLevel: 'info'
    });

    console.log(`Successfully connected to ${deviceName}`);
    
    const sessionId = await driver.getSessionId();
    console.log(` Session ID: ${sessionId}`);

    console.log("Waiting for Play Store to load...");
    await driver.pause(10000);

    // Step 1: Find and click the search box
    console.log(" Searching for the search box...");
    const searchStrategies = [
      { name: "Main Search Box", selector: 'android=new UiSelector().resourceId("com.android.vending:id/search_box_idle_text")' },
      { name: "General Search Box", selector: 'android=new UiSelector().resourceId("com.android.vending:id/search_box")' },
      { name: "Search Text", selector: 'android=new UiSelector().textContains("Search")' },
      { name: "Search Description", selector: 'android=new UiSelector().descriptionContains("Search")' },
      { name: "XPath Resource ID", selector: '//*[@resource-id="com.android.vending:id/search_box_idle_text"]' }
    ];

    let searchElement = null;
    for (const strategy of searchStrategies) {
      try {
        searchElement = await driver.$(strategy.selector);
        if (await searchElement.isDisplayed()) {
          console.log(` Element found: ${strategy.name}`);
          await searchElement.click();
          console.log(" Search box clicked");
          break;
        }
      } catch (e) {
        console.log(`Attempt failed for ${strategy.name}: ${e.message.slice(0, 50)}...`);
      }
    }

    if (!searchElement) {
      throw new Error(" Search box not found.");
    }
    
    // Step 2: Type in the search query and press enter
    const appToSearch = config.settings?.appToSearch || "Google Chrome";
    console.log(`Typing "${appToSearch}" and searching...`);
    
    // Find the input field after clicking the search box
    const inputField = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    if (await inputField.isDisplayed()) {
      await inputField.setValue(appToSearch);
      await driver.pressKeyCode(66); // Enter key
      console.log(" Search successful");
    } else {
      throw new Error(" Text field not found.");
    }

    await driver.pause(5000); // Wait for search results to load

    // Step 3: Find and click on the app from the search results
    console.log(` Searching for "${appToSearch}" in results...`);
    const appResultStrategies = [
      // Find by text and a specific class name
      { name: "Text match", selector: `android=new UiSelector().textContains("${appToSearch}").className("android.widget.TextView")` },
      // Find by content description
      { name: "Description match", selector: `android=new UiSelector().descriptionContains("${appToSearch}").className("android.view.View")` }
    ];

    let appElement = null;
    for (const strategy of appResultStrategies) {
      try {
        appElement = await driver.$(strategy.selector);
        if (await appElement.isDisplayed()) {
          console.log(`App found: ${strategy.name}`);
          await appElement.click();
          console.log("App clicked");
          break;
        }
      } catch (e) {
        console.log(` Attempt failed for ${strategy.name}: ${e.message.slice(0, 50)}...`);
      }
    }
    
    if (!appElement) {
      throw new Error(`"${appToSearch}" not found in results.`);
    }

    await driver.pause(5000); // Wait for the app page to load

    // Step 4: Find and click the "Install" button
    console.log(" Searching for the 'Install' button...");
    
    // This is the "link" example the user requested
    const installButton = await driver.$('android=new UiSelector().text("Install").className("android.widget.Button")');
    const isInstallButtonVisible = await installButton.isDisplayed();
    
    if (isInstallButtonVisible) {
      console.log(" 'Install' button found");
      await installButton.click();
      console.log(" 'Install' button clicked. Download will start automatically.");
    } else {
      console.log(" 'Install' button not present or app is already installed.");
      console.log(" Searching for 'Open' or 'Update' button as an alternative...");
      
      const openOrUpdateButton = await driver.$('android=new UiSelector().textContains("Open").className("android.widget.Button")');
      const isButtonVisible = await openOrUpdateButton.isDisplayed();
      
      if (isButtonVisible) {
         console.log(" 'Open' or 'Update' button found.");
         await openOrUpdateButton.click();
         console.log(" Button clicked. The app will now open or update.");
      } else {
         console.log(" No valid button found.");
         throw new Error(" 'Install' or 'Open' button not found.");
      }
    }
    
    // Wait for the download to start and observe
    console.log("Observing results for 30 seconds...");
    await driver.pause(30000);

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`Test finished on ${deviceName} in ${duration} seconds`);
    
    return {
      device: deviceName,
      success: true, // Assuming the flow was successful up to the click
      duration: duration,
      sessionId: sessionId
    };

  } catch (error) {
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.error(` Error on ${deviceName} after ${duration} seconds:`);
    console.error(` ${error.message}`);
    
    if (error.message.includes('authentication') || error.message.includes('401')) {
      console.error(" Authentication error - check LambdaTest credentials");
    } else if (error.message.includes('device') || error.message.includes('Device not found')) {
      console.error("Device unavailable - try another device");
    } else if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
      console.error("Connection timeout - check your internet connection");
    } else if (error.message.includes('session') || error.message.includes('concurrent')) {
      console.error("Concurrent session limit exceeded");
    }
    
    return {
      device: deviceName,
      success: false,
      duration: duration,
      error: error.message,
      sessionId: null
    };

  } finally {
    if (driver) {
      try {
        await driver.deleteSession();
        console.log(` Session for ${deviceName} closed`);
      } catch (closeError) {
        console.log(` Problem closing session for ${deviceName}:`, closeError.message);
      }
    }
  }
}

/**
 * Runs the test flow on all devices specified in the config.
 * @returns {Promise<Array<Object>>} An array of results for each device.
 */
async function runAllDevices() {
  const startTime = Date.now();
  
  // Get devices list (guaranteed to be array)
  const devices = config.devices || DEFAULT_CONFIG.devices;
  
  console.log(`🚀 Starting test on ${devices.length} devices...`);
  console.log(`📋 Device list: ${devices.join(', ')}`);
  console.log(`⏰ Start time: ${new Date().toLocaleDateString()}`);
  console.log(`${'='.repeat(80)}`);

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    const deviceNumber = i + 1;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(` Device ${deviceNumber}/${devices.length}: ${device}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      // Changed from runPlayStoreSignInFlow to runPlayStoreDownloadFlow
      const result = await runPlayStoreDownloadFlow(device);
      results.push(result);
      
      if (result.success) {
        successCount++;
        console.log(` ${device}: Succeeded in ${result.duration}s`);
      } else {
        failureCount++;
        console.log(` ${device}: Failed in ${result.duration}s`);
      }
      
      // Wait between tests (except for last one)
      if (i < devices.length - 1) {
        const waitTime = 15; // seconds
        console.log(`⏳ Waiting for ${waitTime} seconds before next test...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
      
    } catch (error) {
      failureCount++;
      const failedResult = {
        device: device,
        success: false,
        duration: 0,
        error: error.message,
        sessionId: null
      };
      results.push(failedResult);
      console.error(` ${device}: Completely failed - ${error.message.slice(0, 100)}...`);
    }
  }

  // Final summary
  const endTime = Date.now();
  const totalDuration = Math.round((endTime - startTime) / 1000);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(` Final Results Report`);
  console.log(`${'='.repeat(80)}`);
  console.log(` Total Duration: ${totalDuration} seconds (${Math.round(totalDuration/60)} minutes)`);
  console.log(` Total Devices: ${devices.length}`);
  console.log(` Success: ${successCount}`);
  console.log(` Failure: ${failureCount}`);
  console.log(` Success Rate: ${Math.round((successCount/devices.length)*100)}%`);
  
  console.log(` Device details:`);
  results.forEach((result, index) => {
    const status = result.success ? 'yes' : 'no';
    const duration = result.duration || 0;
    console.log(`${status} ${index + 1}. ${result.device}: ${duration}s ${result.error ? `(${result.error.slice(0, 50)}...)` : ''}`);
  });
  
  console.log(`${'='.repeat(80)}`);
  console.log(`🎉 Test completed! Check LambdaTest Dashboard for results`);
  
  return results;
}

// Export for use in other modules
module.exports = { 
  runPlayStoreDownloadFlow, // Export the new function
  runAllDevices, 
  DEVICE_MAP,
  config 
};

// Auto-run if this is the main module
if (require.main === module) {
  console.log(" Running Play Store Automation test");
  console.log(` Date: ${new Date().toLocaleDateString()}`);
  console.log(` Time: ${new Date().toLocaleTimeString()}`);
  
  runAllDevices()
    .then((results) => {
      const successCount = results.filter(r => r.success).length;
      console.log(` All tests finished: ${successCount}/${results.length} succeeded`);
      process.exit(successCount > 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error(" General error during execution:", error.message);
      console.error("Check settings and try again");
      process.exit(1);
    });
}
