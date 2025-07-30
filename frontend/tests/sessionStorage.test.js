const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { expect } = require("chai");

describe("Session Management", function () {
  this.timeout(80000); // Increased timeout for reliability

  let driver;

  beforeEach(async () => {
    const options = new chrome.Options();
    driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    await driver.get("http://localhost:3000");
  });

  afterEach(async () => {
    await driver.quit();
  });

  it("should initialize sessionId after submission", async () => {
    await driver.wait(until.elementLocated(By.css("textarea.problem-input")), 20000);

    const textarea = await driver.findElement(By.css("textarea.problem-input"));
    const submitButton = await driver.findElement(By.css("button.submit-button"));

    await textarea.sendKeys("Sample question");
    await submitButton.click();

    await driver.wait(until.elementLocated(By.css(".output-section .title")), 20000);

    const sessionId = await driver.executeScript(() => {
      return localStorage.getItem("dsaChat_sessionId");
    });

    expect(sessionId).to.be.a("string").with.length.greaterThan(5);
  });

  it("should restore the same session after refresh", async () => {
    // Submit a question
    const textarea = await driver.findElement(By.css("textarea.problem-input"));
    const submitButton = await driver.findElement(By.css("button.submit-button"));

    await textarea.sendKeys("Check session restoration.");
    await submitButton.click();

    await driver.wait(until.elementLocated(By.css(".output-section .title")), 20000);

    // Get current session ID
    const sessionIdBefore = await driver.executeScript(() => {
      return localStorage.getItem("dsaChat_sessionId");
    });

    // Refresh the page
    await driver.navigate().refresh();

    await driver.wait(until.elementLocated(By.css(".output-section")), 20000);

    // Check sessionId is still same
    const sessionIdAfter = await driver.executeScript(() => {
      return localStorage.getItem("dsaChat_sessionId");
    });

    expect(sessionIdAfter).to.equal(sessionIdBefore);

    // Ensure some previous output still exists
    const outputText = await driver.findElement(By.css(".output-section")).getText();
    expect(outputText.toLowerCase()).to.include("output");
  });

  it("should have different sessionIds in separate tabs (isolated sessions)", async () => {
    // Open Tab A
    const driverA = driver;
    await driverA.wait(until.elementLocated(By.css("textarea.problem-input")), 20000);
    const textareaA = await driverA.findElement(By.css("textarea.problem-input"));
    const submitButtonA = await driverA.findElement(By.css("button.submit-button"));
    await textareaA.sendKeys("First tab question");
    await submitButtonA.click();
    await driverA.wait(until.elementLocated(By.css(".output-section")), 20000);

    const sessionIdA = await driverA.executeScript(() => {
      return localStorage.getItem("dsaChat_sessionId");
    });

    // Open Tab B (new driver)
    const options = new chrome.Options();
    const driverB = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    await driverB.get("http://localhost:3000");

    const textareaB = await driverB.findElement(By.css("textarea.problem-input"));
    const submitButtonB = await driverB.findElement(By.css("button.submit-button"));
    await textareaB.sendKeys("Second tab question");
    await submitButtonB.click();
    await driverB.wait(until.elementLocated(By.css(".output-section")), 20000);

    const sessionIdB = await driverB.executeScript(() => {
      return localStorage.getItem("dsaChat_sessionId");
    });

    // Check session IDs are not equal
    expect(sessionIdA).to.not.equal(sessionIdB);

    await driverB.quit(); // Clean up second driver
  });
});
