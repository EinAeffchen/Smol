import React, { useState, useCallback, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Link as RouterLink } from "react-router-dom";
import { Box, useTheme } from "@mui/material";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { API } from "../config";

// Import our new custom components/hooks
import { useGridClustering } from "../hooks/useGridClustering";
import { ClusterMarker } from "../components/ClusterMarker";
import { getMediaLocations } from "../services/media";

export interface MediaLocation {
  id: number;
  latitude: number;
  longitude: number;
  thumbnail: string;
}

function MapController({
  onLocationsChange,
  onMapChange,
}: {
  onLocationsChange: (locs: MediaLocation[]) => void;
  onMapChange: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onMapChange(map);
  }, [map, onMapChange]);

  const fetchLocationsForView = useCallback(() => {
    const bounds = map.getBounds();
    getMediaLocations(
      bounds.getNorth(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getWest()
    )
      .then(onLocationsChange)
      .catch(console.error);
  }, [map, onLocationsChange]);

  useMapEvents({
    load: fetchLocationsForView,
    moveend: fetchLocationsForView,
  });

  return null;
}

export default function MapPage() {
  const [locations, setLocations] = useState<MediaLocation[]>([]);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const theme = useTheme();

  // Our custom hook processes the raw locations into clusters
  const clusters = useGridClustering({ locations, map: mapInstance });

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
          backgroundColor: theme.palette.background.default,
        }}
      >
        <TileLayer
          url={
            theme.palette.mode === "dark"
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <MapController
          onLocationsChange={setLocations}
          onMapChange={setMapInstance}
        />

        {clusters.map((point) => {
          if (point.count > 1) {
            return <ClusterMarker key={point.id} cluster={point} />;
          }
          return (
            <Marker key={point.id} position={[point.lat, point.lon]}>
              <Popup>
                <RouterLink to={`/medium/${point.baseId}`}>
                  <Box
                    component="img"
                    src={`${API}/thumbnails/${point.thumbnail}`}
                    alt=""
                    sx={{
                      width: 96,
                      height: 96,
                      objectFit: "cover",
                      borderRadius: 1,
                    }}
                  />
                </RouterLink>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
}
