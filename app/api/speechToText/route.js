import { Configuration, OpenAI } from "openai";
import { exec } from "child_process";
import fs from "fs";
import { NextResponse } from "next/server";
import util from "util";

// Convert exec to use promises
const execAsync = util.promisify(exec);

// Configure OpenAI with environment variable for API key
const openai = new OpenAI({
  apiKey: "", // Use environment variable for API key
});
let messageHistory = []; // Store message history

export async function POST(request) {
  const requestBody = await request.json();
  const base64Audio = requestBody.audio;
  const audioBuffer = Buffer.from(base64Audio, "base64");

  try {
    const transcribedText = await processAudioAndGenerateResponse(audioBuffer);
    return NextResponse.json({ result: transcribedText });
  } catch (error) {
    console.error("Error during processing:", error);
    return NextResponse.json(
      { error: "An error occurred during your request." },
      { status: 500 }
    );
  }
}

async function processAudioAndGenerateResponse(audioBuffer) {
  const mp3AudioBuffer = await convertAudioToMp3(audioBuffer);
  const tempFilePath = "/tmp/audio.mp3";
  fs.writeFileSync(tempFilePath, mp3AudioBuffer);

  try {
    if (!fs.existsSync(tempFilePath)) {
      throw new Error("Temporary MP3 file does not exist");
    }

    const transcriptionResponse = await transcribeAudio(tempFilePath);
    updateMessageHistory({
      role: "user",
      content:
        "Give me a short 10-50 word answer to the following prompt:" +
        transcriptionResponse,
    });
    const { content: chatResponse, fullResponse } =
      await generateChatResponse();
    updateMessageHistory({ role: "assistant", content: chatResponse });
    return chatResponse;
  } finally {
    cleanUpFile(tempFilePath);
  }
}

async function convertAudioToMp3(audioBuffer) {
  const inputPath = "/tmp/input.webm";
  const outputPath = "/tmp/output.mp3";

  fs.writeFileSync(inputPath, audioBuffer);

  try {
    const { stdout, stderr } = await execAsync(
      `ffmpeg -i ${inputPath} ${outputPath}`
    );
    console.log("FFmpeg stdout:", stdout);
    if (stderr) {
      console.error("FFmpeg stderr:", stderr);
    }
    return fs.readFileSync(outputPath);
  } catch (error) {
    console.error("Error during audio conversion:", error);
    throw error;
  } finally {
    cleanUpFiles(inputPath, outputPath);
  }
}

async function transcribeAudio(filePath) {
  const transcriptionResponse = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: fs.createReadStream(filePath),
    response_format: "text",
  });
  return transcriptionResponse;
}

async function generateChatResponse() {
  // Function to calculate the total number of tokens in messageHistory
  function calculateTotalTokens(messages) {
    return messages.reduce(
      (total, message) => total + message.content.split(" ").length,
      0
    );
  }

  // Function to summarize messages if total tokens exceed the limit
  async function summarizeMessages(messages) {
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: `Please summarize the following message history so it has less than 16,000 tokens:
      
        ${JSON.stringify(messages, null, 2)}
      
      `,
      temperature: 1,
      max_tokens: 2000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
    return summaryResponse.choices[0].message.content;
  }

  let totalTokens = calculateTotalTokens(messageHistory);
  const maxTokensLimit = 16000;

  // Loop to summarize messages until the total token count is within the limit
  while (totalTokens > maxTokensLimit) {
    const summary = await summarizeMessages(messageHistory);
    messageHistory = [{ content: summary }].concat(messageHistory.slice(-5)); // Keep the most recent 5 messages
    totalTokens = calculateTotalTokens(messageHistory);
  }

  // Generate the chat response with the modified messageHistory
  const chatResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-16k",
    messages: messageHistory,
    temperature: 1,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  const responseContent = chatResponse.choices[0].message.content;
  return { content: responseContent, fullResponse: chatResponse };
}

function updateMessageHistory(message) {
  messageHistory.push(message);
}

function cleanUpFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
    console.error("Error deleting file:", e);
  }
}

function cleanUpFiles(...filePaths) {
  filePaths.forEach((filePath) => cleanUpFile(filePath));
}
