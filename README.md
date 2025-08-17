# Artisan Mapping Application with Environmental Data

A React application that visualizes artisan locations with real-time environmental data using ArcGIS JS API.
<img width="1440" height="900" alt="Screenshot 2025-08-17 at 4 02 40 PM" src="https://github.com/user-attachments/assets/ee042ea2-38c7-4af1-b3f6-b7d183965044" />
<img width="1440" height="900" alt="Screenshot 2025-08-17 at 4 02 33 PM" src="https://github.com/user-attachments/assets/d89ed599-9670-4c5c-b6b0-47d0d51dea99" />


## Features

- 🗺️ Interactive map of artisan clusters
- 🌱 Soil quality data (pH, organic content)
- ⛅ Current weather conditions
- 🎨 Color-coded by craft type
- 💬 Detailed popup information
- 🔄 Real-time data updates

## Prerequisites

- Node.js v16+
- Supabase account
- ArcGIS developer account (optional)

## Installation

```bash
git clone https://github.com/yourusername/artisan-gis.git
cd artisan-gis
npm install
```

## Configuration
- set .env
```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_KEY=your-anon-key
```

- set db, see below for usage

## DB Schema
```bash
-- Enable PostGIS for maps
CREATE EXTENSION IF NOT EXISTS postgis;

-- Simple artisans table
CREATE TABLE artisans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  craft_type TEXT NOT NULL, -- 'eri_silk', 'bamboo', 'naga_weave'
  location GEOGRAPHY(POINT, 4326),
  cluster_name TEXT -- Optional grouping
);

```

## RPC function to get GEO LOCATION
```bash
CREATE OR REPLACE FUNCTION get_artisans_with_coords()
RETURNS TABLE (
  id UUID,
  name TEXT,
  craft_type TEXT,
  cluster_name TEXT,
  lat FLOAT,
  lng FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.craft_type,
    a.cluster_name,
    ST_Y(a.location::geometry) as lat,
    ST_X(a.location::geometry) as lng
  FROM artisans a;
END;
$$ LANGUAGE plpgsql;
```

## API Endpoints Used

| Service       | URL                          | Data Collected                |
|---------------|------------------------------|-------------------------------|
| SoilGrids     | `https://rest.isric.org`     | pH levels, Organic Carbon     |
| Open-Meteo    | `https://api.open-meteo.com` | Temperature, Precipitation     |

## Project Structure

```text
/src
├── components/
│   ├── Map.jsx           # Main map visualization component
│   └── Legend.jsx        # Interactive map legend
├── lib/
│   └── supabase.js       # Supabase client configuration
└── App.jsx               # Application root component
```
