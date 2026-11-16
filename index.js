const express = require("express");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

// ================================
// CHATBOT API
// ================================

app.post("/api/chat", async (req, res) => {

    try {

        const messages = req.body.messages;

        // Validasi pesan
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "Pesan tidak valid."
            });
        }

        // Validasi API Key
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || !apiKey.trim()) {
            console.error("API KEY TIDAK DITEMUKAN!");

            return res.status(500).json({
                error: "OPENROUTER_API_KEY tidak ditemukan di file .env"
            });
        }

        console.log("Menghubungkan ke OpenRouter...");

        // Request OpenRouter
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey.trim()}`
                },

                body: JSON.stringify({
                    model: "baidu/ernie-5.5-flash-preview:free",
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: true
                })
            }
        );

        // Periksa respons API
        if (!response.ok) {

            const errorText = await response.text();

            console.error("OPENROUTER ERROR:");
            console.error(errorText);

            return res.status(response.status).json({
                error: errorText
            });
        }

        if (!response.body) {
            throw new Error("Respons streaming kosong dari OpenRouter.");
        }

        console.log("OpenRouter berhasil terhubung!");

        // Header streaming
        res.setHeader(
            "Content-Type",
            "text/event-stream; charset=utf-8"
        );

        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";

        // Fungsi membaca SSE
        function processLine(line) {

            const trimmedLine = line.trim();

            if (!trimmedLine || trimmedLine.startsWith(":")) {
                return;
            }

            if (!trimmedLine.startsWith("data:")) {
                return;
            }

            const data = trimmedLine.slice(5).trim();

            if (data === "[DONE]") {
                return;
            }

            try {

                const json = JSON.parse(data);

                if (json.error) {
                    console.error("STREAM ERROR:", json.error);
                    return;
                }

                const content =
                    json.choices?.[0]?.delta?.content;

                if (typeof content === "string" && content.length > 0) {

                    res.write(
                        `data: ${JSON.stringify(content)}\n\n`
                    );
                }

            } catch (error) {

                console.error("Gagal parsing SSE:", error.message);

            }
        }

        // Membaca streaming
        while (true) {

            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, {
                stream: true
            });

            const lines = buffer.split("\n");

            buffer = lines.pop();

            for (const line of lines) {
                processLine(line);
            }
        }

        // Proses sisa data
        buffer += decoder.decode();

        if (buffer.trim()) {
            processLine(buffer);
        }

        res.write("data: [DONE]\n\n");
        res.end();

        console.log("Streaming selesai.");

    } catch (error) {

        console.error("SERVER ERROR:", error);

        if (!res.headersSent) {

            res.status(500).json({
                error: error.message || "Terjadi kesalahan pada server."
            });

        } else if (!res.writableEnded) {

            res.end();

        }

    }

});

// ================================
// SERVER
// ================================

app.listen(PORT, () => {

    console.log("--------------------------------");
    console.log(`Server berjalan di port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log("--------------------------------");

});
