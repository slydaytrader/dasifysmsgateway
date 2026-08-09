const express = require('express');
const mqtt = require('mqtt');
const app = express();
app.use(express.json());

// EMQX Cloud Connection Details
const MQTT_URL = 'mqtts://m518b210.ala.us-east-1.emqxsl.com:8883';
const options = {
  clientId: 'Render_Middleman_' + Math.random().toString(16.substring(2, 8)),
  // If your EMQX deployment requires username/password, add them here:
  // username: 'your_username',
  // password: 'your_password',
  rejectUnauthorized: true // Validates EMQX SSL certificate
};

console.log('Connecting to EMQX Cloud...');
const client = mqtt.connect(MQTT_URL, options);

client.on('connect', () => {
  console.log('Connected to EMQX Broker successfully!');
  client.subscribe('gateway/ack', (err) => {
    if (!err) console.log('Subscribed to gateway/ack topic');
  });
});

// Listen for ACKs coming back from the STM32 Gateway
client.on('topic', (topic, payload) => {
  if (topic === 'gateway/ack') {
    console.log('Received ACK from gateway:', payload.toString());
    // Optional: Here you can forward the ACK via HTTP back to your restricted server if needed
  }
});

// Webhook endpoint for your restricted main server to push outgoing SMS
app.post('/send-sms', (req, res) => {
  const { id, phone, message } = req.body;
  
  if (!phone || !message) {
    return res.status(400).send({ error: 'Missing phone or message' });
  }

  const payload = JSON.stringify({ id: id || "0", phone, message });
  
  // Publish payload to EMQX. The STM32 will catch it instantly via subscription.
  client.publish('gateway/tx', payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('Publish error:', err);
      return res.status(500).send({ success: false, error: err.message });
    }
    console.log(`Dispatched SMS for ${phone} to EMQX broker.`);
    res.status(200).send({ success: true, message: 'Dispatched to gateway' });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Middleman running on port ${PORT}`);
});
