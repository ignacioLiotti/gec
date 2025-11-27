import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
	vus: 10,
	duration: "1m",
	thresholds: {
		http_req_duration: ["p(95)<500"],
		http_req_failed: ["rate<0.01"],
	},
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const HEALTH_TOKEN = __ENV.HEALTHCHECK_TOKEN || "";

export default function () {
	const headers = HEALTH_TOKEN
		? {
				"X-Health-Token": HEALTH_TOKEN,
		  }
		: undefined;
	const res = http.get(`${BASE_URL}/api/health`, { headers });
	check(res, {
		"is healthy": (r) => r.status === 200 && r.json("ok") === true,
	});
	sleep(1);
}
