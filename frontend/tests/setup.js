// tests/setup.js
const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

let driver;

before(async function () {
  this.timeout(60000);
  const options = new chrome.Options(); // .headless() if needed
  driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  global.driver = driver;
});

after(async () => {
  if (driver) await driver.quit();
});
