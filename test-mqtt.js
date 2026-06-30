const mqtt = require("mqtt");

const client = mqtt.connect(
  "mqtt://localhost:1883"
);

client.on("connect", () => {

  client.publish(
    "farm/6a250ee737f8160a96ecd7f6/especd7f6/status",
    JSON.stringify({
      status: "online",
      authToken: "4b67cbe902a1894c042ac118d578662d2e38149a56812f69be42aab1346c115d"
    })
  );

  console.log("Sent");

  process.exit();
});