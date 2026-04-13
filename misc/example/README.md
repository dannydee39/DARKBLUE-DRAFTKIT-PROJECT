# Fantasy Baseball Draft Kit

A comprehensive draft kit application for fantasy baseball with player valuation API powered by real MLB statistics.

## Features

- **Player Valuation API**: Evaluates players based on MLB statistics
- **Live Draft Board**: Real-time auction draft with Socket.io
- **Keeper League Support**: Track players kept across multiple seasons
- **Budget Management**: $260 budget per owner with smart tracking
- **Position Scarcity**: Intelligent position-based valuations
- **Configurable Scoring**: Customize statistical categories
- **Real MLB Data**: Integration with MLB Stats API

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Express.js, Node.js, Socket.io
- **Database**: MongoDB with Mongoose
- **External API**: MLB Stats API (free)

## Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB (local or Atlas)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your MongoDB connection string
```

3. Start MongoDB (if running locally)

4. Run the development server:
```bash
# Terminal 1 - Next.js frontend
npm run dev

# Terminal 2 - Express backend + Socket.io
npm run server
```

5. Open [http://localhost:3000](http://localhost:3000)

## League Configuration

- 12 Owners (configurable)
- $260 budget per owner
- 23 roster spots:
  - 9 Pitchers
  - 14 Hitters (C, 1B, 2B, 3B, SS, OF, etc.)
- Auction-style draft
- Keeper league support (3-year max)

## API Endpoints

### Players
- `GET /api/players` - Get all available players
- `GET /api/players/:id` - Get player details
- `GET /api/players/valuation/:id` - Get player valuation

### Leagues
- `POST /api/leagues` - Create new league
- `GET /api/leagues/:id` - Get league details
- `PUT /api/leagues/:id` - Update league settings

### Draft
- `POST /api/draft/nominate` - Nominate player for auction
- `POST /api/draft/bid` - Place bid on player
- `POST /api/draft/complete` - Complete player purchase

## Project Structure

```
Attempt2/
├── app/                  # Next.js app directory
├── components/           # React components
├── server/              # Express backend
│   ├── models/         # MongoDB models
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   └── socket/         # Socket.io handlers
├── types/              # TypeScript definitions
└── utils/              # Helper functions
```

## Client Source Material

- Imported scope/spec document: `../docs/client-input/client_scope_notes_2026-02-20.txt`
- Imported product sketch PDF: `../docs/client-input/product_sketch.pdf`
- Source link index: `../docs/client-input/README.md`

## License

MIT
