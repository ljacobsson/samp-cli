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
      const payload = JSON.parse(message.toString());
      if (payload.error) {
        console.log('Error: ', payload.error);
        reject(payload.error);
      }
      if (payload.event === 'exit') {
        console.log('Debug session ended');
        client.end();
        resolve('exit');
      }
      resolve(message.toString());
    });
  });

  const message = await promise;
  return JSON.parse(message);
};

function publishEvent(event, context) {
  const sessionId = new Date().getTime() + '-' + Math.floor((Math.random() * 1000000) + 1); // Unique ID for this debug session
  client.subscribe(`lambda-debug/callback/${config.mac}/${sessionId}`);
  client.publish('lambda-debug/event/' + config.mac, JSON.stringify({ event, context, envVars: process.env, sessionId }));
}

