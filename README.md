# AikoOS — Your Playful AI Companion

AikoOS is a modular AI operating system with agents, memory, plugins, and a browser companion — designed to feel personal, warm, and human instead of robotic. 

This project is a rebranded fork of [ElizaOS](https://github.com/elizaOS/eliza) for the backend architecture and [Yumi Extension](https://github.com/RyuuTheChosen/yumi-extension) for the Chrome companion.

## Identity
- **Name:** AikoOS
- **Tagline:** Cute Companion AI Operating System
- **Personality:** Playful Aiko (cheerful, warm, encouraging)

## Features
- **Memory Engine:** Persistent session memory with context awareness.
- **Voice Synthesis:** Natural voice replies with intelligent fallback.
- **Plugin System:** Modular tools and extensible agents.
- **Personality V1:** Playful Aiko: warm, encouraging, and helpful.

## Backend Setup (AikoOS Core)
1. Navigate to `backend/`
2. Install dependencies: `npm install`
3. Configure `.env`:
   - `AIKO_API_KEY=your_gemini_api_key`
   - `ELEVENLABS_API_KEY=optional`
4. Run server: `npm run dev`

## Chrome Extension Setup
1. Navigate to `chrome://extensions` in your browser.
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `extension/` folder.
4. Open the Aiko icon in your toolbar to start chatting.

## Chrome Web Store Description
**Title:** AikoOS – Your Cute AI Companion
**Short Description:** A friendly, playful AI companion with memory, voice, and personality — right in your browser.

## Attribution & Compliance
- Core logic and agent architecture forked from **ElizaOS**.
- UI/UX inspiration for the companion forked from **Yumi Extension**.
- This project preserves all original licenses (MIT).

---
*Built for people who want AI that feels personal, not robotic.*