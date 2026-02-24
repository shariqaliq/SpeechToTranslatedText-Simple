import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { io, Socket } from 'socket.io-client'

interface Ctx {
    lines: string[];
    current: string;
    recording: boolean;
    start: () => void;
    stop: () => void

}

// Converts Float32Array of audio data to PCM16 ArrayBuffer
function floatTo16BitPCM(float32Array: Float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
}

// Converts a Float32Array to base64-encoded PCM16 data
function base64EncodeAudio(float32Array: Float32Array): string {
    const arrayBuffer = floatTo16BitPCM(float32Array);
    let binary = '';
    let bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000; // 32KB chunk size
    for (let i = 0; i < bytes.length; i += chunkSize) {
        let chunk = Array.from(bytes.subarray(i, i + chunkSize));
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}


const TranslationCtx = createContext<Ctx>(null!)

export function TranslationProvider({ children }: { children: ReactNode }) {

    const [lines, setLines] = useState<string[]>([])
    const [current, setCurrent] = useState("")
    const [recording, setRecording] = useState(false)

    const socketRef = useRef<Socket | null>(null)
    const ctxRef = useRef<AudioContext | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const procRef = useRef<ScriptProcessorNode | null>(null)

    const start = useCallback(async () => {
        try {
            const socket = io("http://localhost:3001", { transports: ["websocket"] })
            socketRef.current = socket

            socket.on("delta", (delta: string) => setCurrent(p => p + delta))
            socket.on("done", (text: string) => setLines((p) => [...p, text]));
            setCurrent("")


            await new Promise<void>((r) => socket.on("ready", r))

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, sampleRate: 24000, echoCancellation: true, noiseSuppression: true }
            })
            streamRef.current = stream;

            const ac = new AudioContext({ sampleRate: 24000 });
            ctxRef.current = ac
            const proc = ac.createScriptProcessor(4096, 1, 1)
            procRef.current = proc

            proc.onaudioprocess = (e) => socket.emit("audio", base64EncodeAudio(e.inputBuffer.getChannelData(0)))

            ac.createMediaStreamSource(stream).connect(proc)
            proc.connect(ac.destination)
            setRecording(true)
        } catch (err) {
            console.log(err)
            // setRecording(false)
        }

    }, [])

    const stop = useCallback(() => {
        procRef.current?.disconnect()
        streamRef.current?.getTracks().forEach(t => t.stop())
        ctxRef.current?.close()
        socketRef.current?.disconnect()
        procRef.current = streamRef.current = ctxRef.current = socketRef.current = null
        setRecording(false)

    }, [])

    return (
        <TranslationCtx value={{ lines, recording, current, start, stop }} >
            {children}
        </TranslationCtx>
    )
}

export const useTranslation = () => useContext(TranslationCtx)