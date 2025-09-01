import http from "k6/http";
import { check, sleep } from "k6";
import { loginUrl, sessionUrl1 } from "./Logindata/LoginConstatnt.js";
import { SharedArray } from "k6/data";

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
    { duration: "120s", target: 1 },
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
      "Referer": "https://cm.claimsmgmt-qual.aws53.inovalon.global/mdonline/default.asp",
    };

    // POST login
    let loginRes = http.post(
      loginUrl + "?Post=True",
      payload,
      { headers }
    );

    console.log("user.Username,:", user.Username);
    

    check(loginRes, { "login status was 200": (r) => r.status === 200 });

    sleep(1);

    // GET session transfer
    let sessionRes = http.get(sessionUrl1);
    check(sessionRes, { "session transfer status was 200": (r) => r.status === 200 && r.url.includes("APC/Actions/Home") });

    sleep(1);
  }
}