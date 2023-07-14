const {
    Porcupine,
    getInt16Frames
} = require("@picovoice/porcupine-node");
const fs = require('fs');
const mic = require('mic');
const WaveFile = require('wavefile').WaveFile;
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
    apiKey: "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"
});

const openai = new OpenAIApi(configuration);

// Load the Porcupine model for "Hey Chat" (you would need to provide this)
const HEY_CHAT_MODEL_PATH = './Hey-Chat_en_mac_v2_2_0.ppn';
const ACCESS_KEY = '2e9j7ggYfXSD7uH1opmTd8CB04acEfR6GTmS0jDq35OVfOkCAzKimw==';
const keywordNames = ['heyChat'];
const promptBuffer = new Int16Array(16000*10);
let prompting = false;
let bufferOffset = 0;
let [promptStartTime, promptStopTime] = new Array(2).fill(null);

// Create a microphone instance
const micInstance = mic({
    rate: '16000', // Sample rate of 16kHz
    bitwidth: '16', // 16-bit samples
    encoding: 'signed-integer', // Linear PCM
    channels: '1', // Mono
    debug: false,
});

async function getPromptText(wavData) {
    try {
        const transcriptionResult = await openai.createTranscription(fs.createReadStream('./promptBuffer.wav'),'whisper-1');
        return transcriptionResult.data.text;
    } catch (error) {
        console.error(error);
    }
}

// Create a Porcupine instance
let porcupine;
try {
    porcupine = new Porcupine(ACCESS_KEY, [HEY_CHAT_MODEL_PATH], [0.5]);
} catch (error) {
    if (error) {
        console.error(`Argument error: ${error.message}`);
    } else {
        console.error(`Unknown error: ${error.message}`);
    }
    process.exit();
}

function frameIndexToSeconds(frameIndex, engineInstance) {
    return (frameIndex * porcupine.frameLength) / porcupine.sampleRate;
}

// Start listening for the wake word
const micInputStream = micInstance.getAudioStream();
micInputStream.on('data', async (data) => {
    const pcmData = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
    if (prompting && Date.now() < promptStopTime) {

        promptBuffer.set(pcmData, bufferOffset);
        bufferOffset = bufferOffset + data.length/2;

    } else {
        
        if (prompting) {
            let wav = new WaveFile();
            wav.fromScratch(1, 16000, '16', promptBuffer);
            fs.writeFileSync('./promptBuffer.wav', wav.toBuffer());
            console.log(await getPromptText(wav));
        }

        bufferOffset = 0;
        prompting = false;
        // Split the data into chunks of 512 samples
        let wav = new WaveFile();
        wav.fromScratch(1, 16000, '16', pcmData);
        let frames = getInt16Frames(wav, porcupine.frameLength);
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const keywordIndex = porcupine.process(frame);

            if (keywordIndex !== -1) {
                prompting = true;
                [promptStartTime, promptStopTime] = [Date.now(), Date.now() +10000];

                const timestamp = frameIndexToSeconds(i, porcupine);
                console.log(
                    `Detected keyword '${keywordNames[keywordIndex]}' @ ${timestamp}s`
                );
            };
        };
    };    
});

micInstance.start();
