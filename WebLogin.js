import http from "k6/http";
import { check, sleep } from "k6";
import { loginUrl, sessionTransferUrl,sessionReportUrl } from "./Logindata/LoginConstatnt.js";
import { SharedArray } from "k6/data";
import { parseHTML } from "k6/html";
// Load CSV data
const users = new SharedArray("users", function () {
  // Remove header line and parse CSV
  return open("./Logindata/Weblink.csv")
    .split("\n")
    .slice(1)
    .map(line => {
      const cols = line.split(",");
      return {
        Terminal: cols[0],
        Username: cols[1],
        Password: cols[2],
        Type: cols[3]
      };
    });
});

export const options = {
  stages: [
    { duration: "90s", target: 1 },
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
   check(loginRes, { "login status was 200": (r) => r.status === 200 });
   
   // Check session transfer and Home page landing 
     let sessionRes = http.get(sessionTransferUrl, { headers: { "Referer": loginUrl } });
     check(sessionRes, { "session transfer status was 200": (r) => r.status === 200 && r.url.includes("APC/Actions/Home") });

    // Extract cookies from sessionRes and check Session transfer 
    let cookieHeader = "";
    for (const [name, cookieArr] of Object.entries(sessionRes.request.cookies)) {
      // Use the first cookie value if multiple are present
      
      cookieHeader += `${name}=${cookieArr[0].value}; `;
      
    }

       console.warn("Final Cookie Header for 200: " + cookieHeader);


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


       console.warn("Final Cookie Header for 200: " + cookieHeader);
   }
    sleep(12);
  }
}