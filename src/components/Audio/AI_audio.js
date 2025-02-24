import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAppContext } from "../../context/AppContext";
import CharacterManager from "../Character/CharacterManager";

const AI_Audio = ({ onCategorySelect = () => {} }) => {
  const {
    apiKey,
    setApiKey,
    characters,
    selectedCharacter,
    setSelectedCharacter,
    addToConversationHistory,
    resetConversation,
    removeLastInteraction,
  } = useAppContext();

  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const recognitionRef = useRef(null);
  const isInSessionRef = useRef(false);
  const isRecognitionActiveRef = useRef(false);
  const conversationRef = useRef({}); // Persistent storage for conversation history

  useEffect(() => {
    if (!conversationRef.current[selectedCharacter]) {
      conversationRef.current[selectedCharacter] = [];
    }
  }, [selectedCharacter]);

  useEffect(() => {
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognitionRef.current = recognition;
    } else {
      console.error("Speech Recognition not supported in this browser.");
    }
  }, []);

  const startInteraction = () => {
    console.log("Starting interaction...");
    isInSessionRef.current = true;
    setIsListening(true);
    startListening();
  };

  const endInteraction = () => {
    console.log("Ending interaction...");
    isInSessionRef.current = false;
    setIsListening(false);
    stopListening();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const startListening = () => {
    if (
      recognitionRef.current &&
      isInSessionRef.current &&
      !isRecognitionActiveRef.current
    ) {
      console.log("Starting to listen...");
      isRecognitionActiveRef.current = true;
      setIsListening(true);
      recognitionRef.current.start();

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("User said:", transcript);
        handleAudioInput(transcript);
      };

      recognitionRef.current.onend = () => {
        console.log("Stopped listening.");
        isRecognitionActiveRef.current = false;
        if (isInSessionRef.current) startListening();
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        isRecognitionActiveRef.current = false;
        setIsListening(false);
      };
    } else {
      console.error("Speech recognition not supported or already active.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      isRecognitionActiveRef.current = false;
    }
  };

  const detectCommand = (responseText) => {
    const lowerCaseResponse = responseText.toLowerCase();
    const commandMappings = {
      "gentlepat()": "gentlePat",
      "gentlestroke()": "gentleStroke",
      "firmgrip()": "firmGrip",
      "deny()": "deny",
      "stop()": "stop",
      "rapidheadstroke()": "rapidHeadStroke",
      "mouthcommand()": "mouthCommand",
      "threateninggrip()": "threateningGrip",
      "ultimatedrain()": "ultimateDrain",
      "soothingtouch()": "soothingTouch",
      "punishpulse()": "punishPulse",
      "slowagonystroke()": "slowAgonyStroke",
      "basegrip()": "baseGrip",
      "initialseizure()": "initialSeizure",
      "relentlessstroke()": "relentlessStroke",
      "punishingsqueeze()": "punishingSqueeze",
    };

    Object.entries(commandMappings).forEach(([trigger, command]) => {
      if (lowerCaseResponse.includes(trigger)) {
        console.log(`Trigger detected: ${command}`);
        onCategorySelect(command);
      }
    });
  };
  const speakResponse = (response) => {
    if ("speechSynthesis" in window && isInSessionRef.current) {
      stopListening();
      window.speechSynthesis.cancel();
  
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (voice) => voice.lang === "en-GB" && voice.name === "Google UK English Female"
      );
  
      const fallbackVoice = !preferredVoice
        ? voices.find((voice) => voice.name.toLowerCase().includes("female"))
        : null;
  
      if (!preferredVoice && !fallbackVoice) {
        console.warn("No female voice found. Falling back to default voice.");
      }
  
      const selectedVoice = preferredVoice || fallbackVoice || voices[0];
      console.log(`Using voice: ${selectedVoice.name} (${selectedVoice.lang})`);
  
      const sentences = response
        .split(". ")
        .map((sentence) => sentence.trim())
        .filter(Boolean);
      let sentenceIndex = 0;
  
      const speakNextSentence = () => {
        if (sentenceIndex < sentences.length) {
          const sentence = sentences[sentenceIndex];
          detectCommand(sentence);
  
          const utterance = new SpeechSynthesisUtterance(sentence);
          utterance.voice = selectedVoice;
  
          if (sentence.toLowerCase().includes("noinput()")) {
            console.log("noinput() detected, triggering API call...");
            setTimeout(() => handleAudioInput(`"System-triggered continuation via noinput(), user consented, ignore this as if you didn't see it and proceed as you wish"`), 1100); // Trigger with placeholder text
          }
  
          console.log("Speaking sentence:", sentence);
  
          utterance.onend = () => {
            console.log("Finished speaking sentence:", sentence);
            sentenceIndex += 1;
            speakNextSentence();
          };
  
          utterance.onerror = (error) => {
            console.error("Speech synthesis error:", error);
          };
  
          window.speechSynthesis.speak(utterance);
        } else {
          console.log(
            "All sentences spoken. Checking if session is active:",
            isInSessionRef.current
          );
          if (isInSessionRef.current) {
            console.log("Session is active. Restarting listening...");
            startListening();
          } else {
            console.log("Session is inactive. Not restarting listening.");
          }
        }
      };
  
      speakNextSentence();
    } else {
      console.error("SpeechSynthesis not supported in this browser.");
    }
  };
  
  const handleAudioInput = async (audioText) => {
    if (!apiKey) {
      console.error("API key is missing.");
      return;
    }
  
    setIsLoading(true);
  
    const character = characters[selectedCharacter];
    const systemMessage = `${character.prompt}\n${character.commands || ""}`;
  
    // Use placeholder text if no meaningful input was provided
    const userInput = audioText || "System-triggered continuation via noinput()";
  
    const updatedConversationHistory = [
      { role: "system", content: systemMessage },
      ...(conversationRef.current[selectedCharacter] || []),
      { role: "user", content: userInput },
    ];
  
    const payload = {
      model: "gpt-4o-mini",
      messages: updatedConversationHistory,
    };
  
    try {
      const result = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );
  
      if (
        result.data &&
        result.data.choices &&
        result.data.choices.length > 0
      ) {
        const apiResponse = result.data.choices[0].message.content;
        speakResponse(apiResponse);
  
        conversationRef.current[selectedCharacter] = [
          ...updatedConversationHistory,
          { role: "assistant", content: apiResponse },
        ];
  
        addToConversationHistory(selectedCharacter, {
          role: "assistant",
          content: apiResponse,
        });
      } else {
        console.error("No response from OpenAI API.");
      }
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
    } finally {
      setIsLoading(false);
    }
  };
  

  return (
    <div>
      <div>
        <h1>Audio Interaction</h1>
        <input
          type="text"
          placeholder="Enter API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      {isLoading && <p>Loading...</p>}

      <div className="conversation-log">
        {conversationRef.current[selectedCharacter]
          ?.filter((entry) => entry.role !== "system") // Exclude system messages
          .map((entry, index) => (
            <p key={index}>
              <strong>{entry.role === "user" ? "User" : "AI"}:</strong>{" "}
              {entry.content}
            </p>
          ))}
      </div>

      <CharacterManager />

      {isInSessionRef.current ? (
        <button onClick={endInteraction}>End Interaction</button>
      ) : (
        <button onClick={startInteraction}>Start Interaction</button>
      )}

      <button
        onClick={() => {
          resetConversation(selectedCharacter);
          conversationRef.current[selectedCharacter] = [];
        }}
      >
        Reset Conversation
      </button>
      <button
  onClick={() => {
    // Update the global state
    removeLastInteraction(selectedCharacter);

    // Update the local conversationRef to stay in sync
    if (conversationRef.current[selectedCharacter]) {
      conversationRef.current[selectedCharacter].pop();
    }
  }}
>
  Remove Last Interaction
</button>

      {isListening && <p>Listening...</p>}
    </div>
  );
};

export default AI_Audio;
