# Signal Web

A modern Next.js web application for connecting people nearby, built with TypeScript, Tailwind CSS, and modern web technologies.

## Features

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for modern, responsive design
- **Supabase** for backend services
- **Zod** for schema validation
- **Geolib** for location calculations
- **Date-fns** for date manipulation
- **Clsx** for conditional CSS classes

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deployment

This project is configured for easy deployment on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically on every push

## Project Structure

```
src/
├── app/           # App Router pages and layouts
├── components/    # Reusable React components
├── lib/          # Utility functions and configurations
└── types/        # TypeScript type definitions
```

## Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase
- **Validation**: Zod
- **Utilities**: Geolib, Date-fns, Clsx
