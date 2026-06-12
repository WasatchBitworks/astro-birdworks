/**
 * Client-side audio playback for detection recordings, ported from
 * birdworks species-detail.js / live-refresh.js.
 *
 * Each play button lazily fetches a pre-signed S3 URL from the audio
 * endpoint on first click; only one recording plays at a time.
 */
import { toMountainTime } from "./datetime";
import { absoluteAudioUrl } from "./client-api";

export interface AudioDetection {
  id: number;
  detected_at: string;
  confidence: number;
  audio_url: string | null;
  preserve_reason?: string | null;
}

type AudioButton = HTMLButtonElement & { _audio?: HTMLAudioElement };

let currentlyPlayingAudio: HTMLAudioElement | null = null;

const PLAY_ICON = `
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
  <span>Play</span>
`;

/** Numbered audio row used by Today's Detections and Best Preserved Recordings */
export function createAudioItem(detection: AudioDetection, number: number): HTMLElement {
  const div = document.createElement("div");
  div.className = "bg-white rounded-lg shadow-md p-4 flex items-center justify-between gap-4";

  const leftDiv = document.createElement("div");
  leftDiv.className = "flex items-center gap-4 flex-1";

  const numberSpan = document.createElement("span");
  numberSpan.className = "text-lg font-bold text-gray-400";
  numberSpan.textContent = `#${number}`;

  const metadataDiv = document.createElement("div");
  metadataDiv.className = "flex-1";

  const dateTime = toMountainTime(detection.detected_at);
  const confidencePercent = Math.round(detection.confidence * 100);

  metadataDiv.innerHTML = `
    <div class="text-sm font-medium text-gray-900">${dateTime}</div>
    <div class="text-xs text-gray-600">
      <span class="font-semibold text-green-700">${confidencePercent}% confidence</span>
      ${detection.preserve_reason ? ` • ${formatPreserveReason(detection.preserve_reason)}` : ""}
    </div>
  `;

  leftDiv.appendChild(numberSpan);
  leftDiv.appendChild(metadataDiv);

  const playButton = document.createElement("button") as AudioButton;
  playButton.className =
    "audio-play-btn px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition inline-flex items-center gap-2";
  playButton.dataset.audioUrl = detection.audio_url ?? "";
  playButton.dataset.detectionId = String(detection.id);
  playButton.innerHTML = PLAY_ICON;
  playButton.addEventListener("click", () => handleAudioPlay(playButton));

  div.appendChild(leftDiv);
  div.appendChild(playButton);

  return div;
}

export function handleAudioPlay(button: AudioButton): void {
  const audioUrl = button.dataset.audioUrl;
  if (!audioUrl) return;

  // If this button's audio is already playing, pause it
  if (button._audio && !button._audio.paused) {
    button._audio.pause();
    return;
  }

  // Pause any other playing audio
  if (currentlyPlayingAudio && currentlyPlayingAudio !== button._audio) {
    currentlyPlayingAudio.pause();
  }

  if (!button._audio) {
    setButtonLoading(button);

    fetch(absoluteAudioUrl(audioUrl))
      .then((response) => response.json())
      .then((data) => {
        if (!data.url) {
          throw new Error("No audio URL returned");
        }

        const audio = new Audio(data.url);
        button._audio = audio;

        audio.addEventListener("loadeddata", () => {
          setButtonReady(button);
          audio.play();
        });

        audio.addEventListener("play", () => {
          currentlyPlayingAudio = audio;
          setButtonPlaying(button);
        });

        audio.addEventListener("pause", () => {
          setButtonReady(button);
        });

        audio.addEventListener("ended", () => {
          setButtonReady(button);
          currentlyPlayingAudio = null;
        });

        audio.addEventListener("error", () => {
          setButtonError(button);
        });
      })
      .catch((error) => {
        console.error("Error loading audio:", error);
        setButtonError(button);
      });
  } else {
    button._audio.play();
  }
}

function formatPreserveReason(reason: string): string {
  const reasons: Record<string, string> = {
    high_confidence: "High Confidence",
    building_collection: "Building Collection",
    manual: "Manually Preserved",
    first_of_species: "First of Species",
  };
  return reasons[reason] ?? reason;
}

function setButtonLoading(button: AudioButton) {
  button.disabled = true;
  button.innerHTML = `
    <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>Loading...</span>
  `;
}

function setButtonReady(button: AudioButton) {
  button.disabled = false;
  button.className =
    "audio-play-btn px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition inline-flex items-center gap-2";
  button.innerHTML = PLAY_ICON;
}

function setButtonPlaying(button: AudioButton) {
  button.disabled = false;
  button.className =
    "audio-play-btn px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition inline-flex items-center gap-2";
  button.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
    <span>Pause</span>
  `;
}

function setButtonError(button: AudioButton) {
  button.disabled = true;
  button.className =
    "audio-play-btn px-4 py-2 bg-red-500 text-white rounded-lg cursor-not-allowed inline-flex items-center gap-2";
  button.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
    </svg>
    <span>Unavailable</span>
  `;
}
