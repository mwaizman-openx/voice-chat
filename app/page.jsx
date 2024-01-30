"use client";

import { WavyBackground } from './components/wavy-background';
// Import necessary libraries
import styles from './page.module.css'
import { useState, useEffect } from "react";

// This is the main component of our application
export default function Home() {
  // Define state variables for the result, recording status, and media recorder
  const [result, setResult] = useState();
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  // This array will hold the audio data
  let chunks = [];

  // This useEffect hook sets up the media recorder when the component mounts
  useEffect(async () => {
    if (typeof window !== 'undefined') {

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const newMediaRecorder = new MediaRecorder(stream);
          newMediaRecorder.onstart = () => {
            chunks = [];
          };
          newMediaRecorder.ondataavailable = e => {
            chunks.push(e.data);
          };
          newMediaRecorder.onstop = async () => {
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onerror = function (err) {
              console.error('Error playing audio:', err);
            };
            //audio.play();
            try {
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = async function () {
                const base64Audio = reader.result.split(',')[1]; // Remove the data URL prefix

                const response = await fetch("/api/speechToText", {
                  method: "POST",
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ audio: base64Audio }),
                });

                const data = await response.json();
                if (response.status !== 200) {
                  throw data.error || new Error(`Request failed with status ${response.status}`);
                }
                setResult(data.result);
                speakText(data.result);



              }
            } catch (error) {
              console.error(error);
              alert(error.message);
            }
          };

          setMediaRecorder(newMediaRecorder);

        })
        .catch(err => console.error('Error accessing microphone:', err));
    }
  }, []);
  function speakText(text) {
    // Check if speech synthesis is supported
    if ('speechSynthesis' in window) {
      // Create a new instance of SpeechSynthesisUtterance
      var speech = new SpeechSynthesisUtterance(text);

      // Optionally, you can customize the properties of the speech
      speech.lang = 'en-US'; // Language
      speech.pitch = 1;      // Pitch, range between 0 and 2
      speech.rate = 2;       // Speed, range between 0.1 and 10

      // Speak the text
      window.speechSynthesis.speak(speech);

    } else {
      alert("Your browser does not support text-to-speech.");
    }
  }

  // Function to start recording
  const startRecording = () => {
    if (mediaRecorder !== null) {
      mediaRecorder.start();
      setRecording(true);
    }
  };

  // Function to stop recording
  const stopRecording = () => {
    if (mediaRecorder !== null) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  // Render the component
  return (
    <WavyBackground className="max-w-6xl mx-auto pb-40 text-white flex justify-center">
      <div className="w-fit relative">
        <h2 className="text-4xl w-full text-center">
          Talk to Podcast AI
        </h2>
        <div className="w-full relative  flex justify-center my-5">
          <button className={`${!recording ? 'bg-zinc-950/50 hover:bg-red-700/50' : 'bg-red-500/50 hover:bg-red-600/50'}  border border-zinc-600 px-3 py-3 rounded-md mx-auto  relative mt-10 flex text-xl `} onClick={recording ? stopRecording : startRecording} >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
            {recording ? 'Stop Recording' : 'Start Recording'}
          </button>

        </div>
        <div className="mt-10 text-xl mx-auto container text-center max-w-2xl">{result}</div>
      </div>
    </WavyBackground>

  )
}

