import { createServer } from 'http'
import { Server } from 'socket.io'
import WebSocket from 'ws'
import dotenv from 'dotenv'

dotenv.config()

const httpServer = createServer()
const io = new Server(httpServer, { cors: { origin: "*" } })
const PORT = 3001

const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview"



io.on("connection", (socket) => {
    let ready = false
    const openaiws = new WebSocket(url, {
        headers: {
            Authorization: "Bearer " + process.env.OPENAI_API_KEY,
            "OpenAI-Beta": "realtime=v1"
        }
    })

    openaiws.on("open", () => {
        openaiws.send(
            JSON.stringify({
                type: "session.update",
                session: {
                    modalities: ["text"],
                    instructions: "You are a real-time translator. Translate the user's speech into English. If already in English, return as it is. Return only the translated text",
                    input_audio_format: "pcm16",
                    turn_detection: {
                        type: "server_vad",
                        threshold: 0.5,
                        silence_duration_ms: 500
                    },
                },
            })
        )
    })


    openaiws.on("message", (data) => {
        try {
            const event = JSON.parse(data.toString())
            if (event.type === "session.updated") {
                ready = true
                socket.emit("ready")
            } else if (event.type === "response.text.delta" & event.delta) {
                socket.emit("delta", event.data)
            } else if (event.type === "response.text.done") {
                socket.emit("done", event.text || "")
            } else if (event.type === "error") {
                console.error("OpenAI Error")
            }

        } catch (err) {
            console.log({ err })
        }
    })

    socket.on("audio", (base64) => {
        if (ready) {
            openaiws.send(
                JSON.stringify({ type: "input_audio_buffer.append", audio: base64 })
            )
        }
    })


    socket.on("disconnect", () => {
        if (openaiws.readyState === WebSocket.OPEN || openaiws.readyState === WebSocket.CONNECTING) {
            openaiws.close()
        }
    })

})

httpServer.listen(PORT, () => console.log("Server running on port", PORT))