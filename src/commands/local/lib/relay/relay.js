import fs from 'fs';
import mqtt from 'mqtt';
import { clearInterval } from 'timers';

const config = JSON.parse(fs.readFileSync('config.json'));

const cert = fs.readFileSync("cert.pem");
const key = fs.readFileSync("key.pem");
const ca = fs.readFileSync("AmazonRootCA1.pem");

const connectOptions = {
  connectTimeout: 4000,
  ca: ca,
  key: key,
  cert: cert,
  keepalive: 0,
  clientId: 'mqtt-client-' + Math.floor((Math.random() * 1000000) + 1),
  protocol: 'mqtts',
  port: 8883,
  host: config.endpoint
};
const client = mqtt.connect(connectOptions);
let connected = false;

export const handler = async (event, context) => {
  const promise = new Promise((resolve, reject) => {
    let interval;
    interval = setInterval(() => {
      if (context.getRemainingTimeInMillis() < 1000) {
        console.log('Function is about to time out, making clean exit');
        clearInterval(interval);
        resolve('exit');
      }
    }, 500);
    client.on('error', function (err) {
      console.log('Connection Error: ' + err);
      reject(err);
    });

    if (connected) {
      publishEvent(event, context);
    }

    client.on('connect', function () {
      connected = true;
      console.log('Connected to AWS IoT broker');
      publishEvent(event, context);
    });

    client.on('message', function (topic, message) {
      let payload;
      try {
        payload = JSON.parse(message.toString());
        if (payload.error) {
          console.log('Error: ', payload.error);
          reject(payload.error);
        }
        if (payload.event === 'exit') {
          console.log('Debug session ended');
          client.end();
          resolve('exit');
        }
      } catch (e) {
        // non-json payload
      }

      resolve(message.toString());
    });
  });

  const message = await promise;
  try {
    return JSON.parse(message);
  } catch (e) {
    return message;
  }
};

function publishEvent(event, context) {
  const sessionId = new Date().getTime() + '-' + Math.floor((Math.random() * 1000000) + 1); // Unique ID for this rounndtrip
  const totalPayload = JSON.stringify({ event, context, envVars: process.env, sessionId });
  if (totalPayload.length > 64000) {
    const chunks = totalPayload.match(/.{1,100000}/g);
    chunks.forEach((chunk, index) => {
      const payload = JSON.stringify({ event: 'chunk', chunk, index, totalChunks: chunks.length, sessionId });
      publish(payload, sessionId);
    });
  } else {
    publish(totalPayload, sessionId);
  }
}

function publish(payload, sessionId) {
  client.subscribe(`lambda-debug/callback/${config.uuid}/${sessionId}`);
  client.publish('lambda-debug/event/' + config.uuid, payload);
}

