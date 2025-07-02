# Rishi Biry - Space-Themed Portfolio

A modern, space-themed portfolio website with user authentication, blog, projects showcase, and hours tracking system.

## Features

- **Interactive Space Theme**: Engaging space-themed UI with animated elements
- **User Authentication**: Role-based access control with specialized tokens
- **Projects Showcase**: Display and manage portfolio projects
- **Blog System**: Create and manage blog posts with comments
- **Hours Tracking**: Track work hours with statistics and achievements
- **Responsive Design**: Fully responsive across all device sizes

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **State Management**: React Context API
- **Icons**: Lucide React
- **Deployment**: Netlify

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Start the development server: `npm run dev`

## User Roles

- **Regular**: Basic access to view blog and projects
- **Specialized**: Access to hours tracking and commenting (requires token)
- **Admin**: Full access to all features and content management

## Project Structure

- `/src/components`: Reusable UI components
- `/src/contexts`: React context providers
- `/src/lib`: Utility functions and API clients
- `/src/pages`: Main application pages
- `/supabase/migrations`: Database schema migrations

## Database Setup

The application uses Supabase for authentication and data storage. The database schema is defined in the `supabase/migrations/consolidated_schema.sql` file, which includes:

- User profiles with role-based access control
- Blog posts and comments
- Projects portfolio
- Hours tracking system with subjects and work entries
- Achievements and statistics

## License

MIT