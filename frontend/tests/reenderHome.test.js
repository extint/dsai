const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { expect } = require("chai");

describe("Output Section Rendering", function () {
  this.timeout(300000); // Extended timeout

  let driver;

  before(async () => {
    const options = new chrome.Options();
    // options.addArguments("--headless=new");
  
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();
  
    await driver.get("http://localhost:3000");
  });
  

  after(async () => {
    if (driver) {
      await driver.quit();
    }
  });

  it("should generate and display output after valid submission", async () => {
    const textarea = await driver.findElement(By.css("textarea.problem-input"));
    const submitButton = await driver.findElement(By.css("button.submit-button"));

    await textarea.sendKeys("Given an array, find the maximum subarray sum using Kadane's algorithm.");
    await submitButton.click();

    const outputTitle = await driver.wait(
      until.elementLocated(By.css(".output-section .title")),
      20000
    );

    const titleText = await outputTitle.getText();
    expect(titleText).to.include("Generated Output");

    const codeBlock = await driver.findElement(By.css(".code-content pre"));
    const codeText = await codeBlock.getText();
    expect(codeText.length).to.be.greaterThan(10);

    const logicSection = await driver.findElement(By.xpath("//h3[contains(text(),'Logic')]/../../div[@class='analysis-content']"));
    
    const logicText = await logicSection.getText();
    // expect(logicText).to.include("logic") || include("Logic") || include("array");
    expect(logicText).to.satisfy(text =>
        text.includes("logic") || text.includes("Logic") || text.includes("array")
      );
      
});
it("should display the DoubtDialogue when text is selected", async () => {
    const codeElement = await driver.findElement(By.className("code-content"));
  
    await driver.executeScript(() => {
        const range = document.createRange();
        const selection = window.getSelection();
        const element = document.querySelector(".code-content");
      
        if (!element) {
          console.log("Element not found.");
          return;
        }
      
        const textNode = element.childNodes[0];
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
          console.log("No valid text node found.");
          return;
        }
      
        range.setStart(textNode, 0);
        range.setEnd(textNode, 10); // select first 10 characters
        selection.removeAllRanges();
        selection.addRange(range);
      
        // Log the selected text
        console.log("Selected Text:", selection.toString());
      
        // Log the coordinates
        const rect = range.getBoundingClientRect();
        console.log("Selection Position:", {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      
        // Manually trigger mouseup
        const mouseUp = new MouseEvent("mouseup", { bubbles: true });
        element.dispatchEvent(mouseUp);
      });
      
  
    const dialogue = await driver.wait(
      until.elementLocated(By.className("doubt-dialogue")),
      50000
    );
  
    expect(await dialogue.isDisplayed()).to.be.true;
  });
    
});
