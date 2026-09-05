import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Browser speech recognition for dictating theory answers.
 *
 * Entirely optional. `supported` is false wherever the Web Speech API is
 * absent (Firefox, most in-app browsers), and the calling screen falls back to
 * typing without comment. Permission refusal, no-speech and network errors each
 * get a message a candidate can act on rather than a console error.
 */

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const speechRecognitionSupported = Boolean(SpeechRecognition);

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings, or type your answer instead.',
  'service-not-allowed': 'Your browser would not start speech recognition. You can type your answer instead.',
  'no-speech': 'We did not hear anything. Try speaking a little closer to the microphone.',
  'audio-capture': 'No microphone was found. Connect one, or type your answer instead.',
  network: 'Speech recognition needs an internet connection. You can type your answer instead.',
  aborted: '',
};

export function useSpeechRecognition({ lang = 'en-GB', continuous = true } = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);

  const recognitionRef = useRef(null);
  const finalRef = useRef('');
  const timerRef = useRef(null);
  // Chrome ends recognition after a pause; restart while the user is still recording.
  const wantsToListenRef = useRef(false);

  useEffect(() => {
    if (!SpeechRecognition) return undefined;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += `${result[0].transcript.trim()} `;
        else interimText += result[0].transcript;
      }
      setTranscript(finalRef.current.trim());
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      const message = ERROR_MESSAGES[event.error] ?? 'Speech recognition stopped unexpectedly. You can type your answer instead.';
      if (message) setError(message);
      if (event.error === 'not-allowed' || event.error === 'audio-capture' || event.error === 'service-not-allowed') {
        wantsToListenRef.current = false;
        setListening(false);
      }
    };

    recognition.onend = () => {
      if (wantsToListenRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* Fall through to stopping. */
        }
      }
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    return () => {
      wantsToListenRef.current = false;
      try {
        recognition.stop();
      } catch {
        /* Already stopped. */
      }
      recognitionRef.current = null;
    };
  }, [lang, continuous]);

  useEffect(() => {
    if (!listening) {
      clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [listening]);

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      setError('This browser does not support voice input. You can type your answer instead.');
      return;
    }
    setError(null);
    setSeconds(0);
    wantsToListenRef.current = true;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // start() throws if it is already running; treat that as already listening.
      setListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    wantsToListenRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* Already stopped. */
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalRef.current = '';
    setTranscript('');
    setInterim('');
    setSeconds(0);
    setError(null);
  }, []);

  /** Lets the screen seed the transcript from an already-typed answer. */
  const setValue = useCallback((value) => {
    finalRef.current = value ? `${value} ` : '';
    setTranscript(value || '');
  }, []);

  return {
    supported: speechRecognitionSupported,
    listening,
    transcript,
    interim,
    error,
    seconds,
    start,
    stop,
    reset,
    setValue,
  };
}
