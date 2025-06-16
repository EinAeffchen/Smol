import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import { Box, useTheme } from "@mui/material";
import { API } from "../config";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

interface MediaLocation {
  id: number;
  latitude: number;
  longitude: number;
  thumbnail: string;
}

function FocusHandler({ locations }: { locations: MediaLocation[] }) {
  const map = useMap();
  const [params] = useSearchParams();
  const focusId = params.get("focus");

  useEffect(() => {
    if (!focusId) return;
    const id = Number(focusId);
    const loc = locations.find((l) => l.id === id);
    if (loc) {
      const center: LatLngExpression = [loc.latitude, loc.longitude];
      map.setView(center, 15, { animate: true });
    }
  }, [focusId, locations, map]);

  return null;
}

export default function MapPage() {
  const [locations, setLocations] = useState<MediaLocation[]>([]);
  const theme = useTheme(); // 1. Get the current theme

  useEffect(() => {
    fetch(`${API}/api/media/locations`)
      .then((res) => res.json())
      .then(setLocations)
      .catch(console.error);
  }, []);

  const center: LatLngExpression = [20, 0];

  return (
    <Box sx={{ height: "calc(100vh - 64px)", width: "100%" }}>
      <MapContainer
        center={center}
        zoom={2}
        scrollWheelZoom
        style={{
          height: "100%",
          width: "100%",
          // 2. Set background color to match the theme and avoid flashes
          backgroundColor: theme.palette.background.default,
        }}
      >
        {/* 3. Conditionally render the map tiles based on theme */}
        <TileLayer
          url={
            theme.palette.mode === "dark"
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <FocusHandler locations={locations} />

        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude] as LatLngExpression}
          >
            <Popup>
              <Box
                component={RouterLink}
                to={`/medium/${loc.id}`}
                sx={{
                  display: "block",
                  width: 96,
                  height: 96,
                  textDecoration: "none",
                }}
              >
                <Box
                  component="img"
                  src={`${API}/thumbnails/${loc.id}.jpg`}
                  alt=""
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 1,
                  }}
                />
              </Box>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  );
}
