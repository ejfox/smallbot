# Smallbot

A simple, modular server for Smallweb applications. Smallbot helps users create and understand Smallweb applications through an AI assistant interface.

## Project Structure

The project has been modularized for better maintainability:

```
smallbot/
├── main.ts                 # Entry point
├── deno.json               # Deno configuration
├── deno.lock               # Deno lock file
├── src/
│   ├── app.ts              # Main application setup
│   ├── config/
│   │   └── systemPrompt.ts # System prompt for AI
│   ├── handlers/
│   │   ├── chatApi.ts      # Chat API handler
│   │   └── staticFiles.ts  # Static file handler
│   ├── middleware/
│   │   ├── cors.ts         # CORS middleware
│   │   └── logger.ts       # Logger middleware
│   ├── types/
│   │   └── index.ts        # Type definitions
│   └── utils/
│       ├── contentType.ts  # Content type utilities
│       └── validation.ts   # Response validation
├── frontend/               # Frontend assets
└── public/                 # Public assets
```

## Development

To run the development server:

```bash
deno task dev
```

This will start the server at http://localhost:8000 with hot reloading enabled.

## Environment Variables

- `OPENROUTER_API_KEY`: API key for OpenRouter (required for AI functionality)

## Features

- Static file serving
- AI-powered chat API
- CORS support
- Error handling
- Response validation

## License

MIT 