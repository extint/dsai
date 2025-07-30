const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');

describe('Empty Problem Statement Submission', function () {
  this.timeout(50000); // longer timeout for Selenium startup
  let driver;

  before(async () => {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.get('http://localhost:3000');
  });

  after(async () => {
    await driver.quit();
  });

  it('should display an error when submitting an empty problem', async () => {
    // Make sure we're in text mode
    const toggleButton = await driver.findElement(By.xpath("//button[contains(text(), 'Toggle Mode')]"));
    const toggleText = await toggleButton.getText();
    if (toggleText.toLowerCase().includes('code')) {
      await toggleButton.click(); // Switch to text mode if currently in code
    }

    // Find and click the Submit button
    const submitButton = await driver.findElement(By.xpath("//button[contains(text(), 'Submit')]"));
    await submitButton.click();

    // Wait for error message to appear
    const errorMessage = await driver.wait(
      until.elementLocated(By.css('.error')),
      5000
    );

    const text = await errorMessage.getText();
    expect(text).to.include('Problem statement is required');
  });
});
