import http from "k6/http";
import { check, sleep } from "k6";
import { loginUrl, sessionTransferUrl,sessionReportUrl } from "./Logindata/LoginConstatnt.js";
import { SharedArray } from "k6/data";

// Load CSV data
const users = new SharedArray("users", function () {
  // Remove header line and parse CSV, filter out empty lines
  const csvContent = open("./Logindata/Weblink.csv");
  console.log("Raw CSV content:", csvContent);
  
  const rows = csvContent
    .split("\n")
    .map(line => line.replace(/\r/g, '').trim()) // Remove carriage returns and trim
    .filter(line => line.length > 0) // Filter out empty lines
    .slice(1); // Remove header row
    
  console.log("Filtered rows:", rows);
  
  const parsedUsers = rows.map(line => {
      const cols = line.split(",");
      const user = {
        Terminal: cols[0] ? cols[0].trim() : "",
        Username: cols[1] ? cols[1].trim() : "",
        Password: cols[2] ? cols[2].trim() : "",
        Type: cols[3] ? cols[3].trim() : ""
      };
      console.log("Parsed user:", user);
      return user;
    })
    .filter(user => user.Username && user.Password); // Filter out incomplete entries
    
  console.log("Final users array:", parsedUsers);
  return parsedUsers;
});

export const options = {
  stages: [
    { duration: "120s", target: 25 },
    { duration: "80s", target: 25 },
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  for (const user of users) {
    const payload = {
      username: user.Username,
      password: user.Password,
      submit: "Customer Login",
    };

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": loginUrl,
    };


    // Check Login for different Users
    let loginRes = http.post(
      loginUrl + "?Post=True",
      payload,
      { headers }
    );
    
    // Debug login response
    console.log(`Login attempt for ${user.Username} - Status: ${loginRes.status}`);
    
    check(loginRes, { "login status was 200": (r) => r.status === 200 });
    
    // Only proceed if login was successful
    if (loginRes.status !== 200) {
      console.error(`Login failed for ${user.Username} with status ${loginRes.status}`);
      continue; // Skip to next user
    }
   
   // Check session transfer and Home page landing 
     let sessionRes = http.get(sessionTransferUrl, { headers: { "Referer": loginUrl } });
     
     // Debug logging for session transfer
     console.log(`Session transfer for ${user.Username} - Status: ${sessionRes.status}, URL: ${sessionRes.url}`);
     
     check(sessionRes, { 
       "session transfer status was 200": (r) => r.status === 200,
       "session transfer URL contains APC/Actions/Home": (r) => r.url.includes("APC/Actions/Home"),
       "session transfer combined check": (r) => r.status === 200 && r.url.includes("APC/Actions/Home")
     });

     // Only proceed if session transfer was successful
     if (sessionRes.status !== 200) {
       console.error(`Session transfer failed for ${user.Username} with status ${sessionRes.status}`);
       continue; // Skip to next user
     }

    // Extract cookies from sessionRes and check Session transfer 
    let cookieHeader = "";
    if (sessionRes.request && sessionRes.request.cookies) {
      for (const [name, cookieArr] of Object.entries(sessionRes.request.cookies)) {
        // Use the first cookie value if multiple are present
        if (cookieArr && cookieArr.length > 0) {
          cookieHeader += `${name}=${cookieArr[0].value}; `;
        }
      }
    } else {
      console.warn(`No cookies found in session response for ${user.Username}`);
    }


    // Only proceed to reporting if we have cookies
    if (!cookieHeader.trim()) {
      console.warn(`No valid session cookies for ${user.Username}, skipping reporting page`);
      continue; // Skip to next user
    }


    // Example: Set cookies and headers as needed
    const reportingHeaders = {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
      "Cache-Control": "max-age=0",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "Upgrade-Insecure-Requests": "1",
      "Referer": sessionTransferUrl,
      "Cookie": cookieHeader
    };

    // GET request to Reporting page
    let reportingRes = http.get(sessionReportUrl, { headers: reportingHeaders });
    check(reportingRes, {
      "Reporting page status is 200": (r) => r.status === 200,
      "Reporting URL is correct": (r) => r.url.includes("APC/Reporting/SessionResults"),
    });
    
    if(reportingRes.status === 200){
      console.log(`Successfully accessed reporting page for ${user.Username}`);
    } else {
      console.error(`Failed to access reporting page for ${user.Username} - Status: ${reportingRes.status}`);
    }
    
    sleep(12);
  }
}