const Porcupine = require('@picovoice/porcupine-node');
const mic = require('mic');

// Load the Porcupine model for "Hey Chat" (you would need to provide this)
const HEY_CHAT_MODEL_PATH = './Hey-Chat_en_mac_v2_2_0.ppn';

// Create a microphone instance
const micInstance = mic({
  rate: '16000',
  channels: '1',
  debug: true,
});

// Create a Porcupine instance
let porcupine;
try {
  porcupine = new Porcupine([HEY_CHAT_MODEL_PATH], [0.5]);
} catch (error) {
  if (error) {
    console.error(`Argument error: ${error.message}`);
  } else {
    console.error(`Unknown error: ${error.message}`);
  }
  process.exit();
}

// Start listening for the wake word
const micInputStream = micInstance.getAudioStream();
micInputStream.on('data', (data) => {
  const pcmData = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const keywordIndex = porcupine.process(pcmData);
  if (keywordIndex !== -1) {
    console.log('Heard "Hey Chat"');
  }
});

micInstance.start();
