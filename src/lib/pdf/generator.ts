import puppeteer from "puppeteer";

/**
 * Generate PDF from HTML string using Puppeteer
 * 
 * @param html - HTML content to convert to PDF
 * @param options - PDF generation options
 * @returns PDF buffer
 */
export async function generatePDFFromHTML(
  html: string,
  options: {
    format?: "A4" | "Letter";
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    printBackground?: boolean;
    displayHeaderFooter?: boolean;
    preferCSSPageSize?: boolean;
  } = {}
): Promise<Buffer> {
  let browser;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();
    
    // Ensure HTML is properly encoded as UTF-8
    // Convert to Buffer and back to ensure proper encoding
    const htmlBuffer = Buffer.from(html, 'utf8');
    const htmlString = htmlBuffer.toString('utf8');
    
    // Set content with UTF-8 encoding to handle special characters
    await page.setContent(htmlString, {
      waitUntil: "networkidle0", // Wait for all network requests to finish
    });

    // Generate PDF
    const pdf = await page.pdf({
      format: options.format || "A4",
      margin: {
        top: options.margin?.top || "1cm",
        right: options.margin?.right || "1cm",
        bottom: options.margin?.bottom || "1cm",
        left: options.margin?.left || "1cm",
      },
      printBackground: options.printBackground ?? true,
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      preferCSSPageSize: options.preferCSSPageSize ?? true,
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate PDF from HTML with custom page size (for labels)
 * 
 * @param html - HTML content to convert to PDF
 * @param width - Page width in millimeters
 * @param height - Page height in millimeters
 * @returns PDF buffer
 */
export async function generatePDFFromHTMLCustomSize(
  html: string,
  width: number,
  height: number
): Promise<Buffer> {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();
    
    // Ensure HTML is properly encoded as UTF-8
    // Convert to Buffer and back to ensure proper encoding
    const htmlBuffer = Buffer.from(html, 'utf8');
    const htmlString = htmlBuffer.toString('utf8');
    
    // Set content with UTF-8 encoding to handle special characters
    await page.setContent(htmlString, {
      waitUntil: "networkidle0",
    });

    // Convert mm to inches (1 inch = 25.4mm)
    const widthInches = width / 25.4;
    const heightInches = height / 25.4;

    const pdf = await page.pdf({
      width: `${widthInches}in`,
      height: `${heightInches}in`,
      printBackground: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
