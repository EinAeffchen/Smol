import React from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LatLngExpression } from 'leaflet';

// Define the structure of our cluster data point
export interface ClusterPoint {
  id: string; // Unique ID for the cluster or point
  count: number;
  lat: number;
  lon: number;
  baseId: number; // The ID of one of the original media items in the cluster
  thumbnail: string;
  bounds: L.LatLngBoundsExpression;
}

interface ClusterMarkerProps {
  cluster: ClusterPoint;
}

export function ClusterMarker({ cluster }: ClusterMarkerProps) {
  const map = useMap();
  const position: LatLngExpression = [cluster.lat, cluster.lon];

  // Create a custom HTML icon for the cluster
  const clusterIcon = L.divIcon({
    html: `<span>${cluster.count}</span>`,
    className: 'custom-marker-cluster',
    iconSize: L.point(40, 40, true),
  });

  const handleClick = () => {
    // On click, zoom the map to fit the bounds of the cluster
    map.fitBounds(cluster.bounds, { padding: [50, 50] });
  };

  return (
    <Marker
      position={position}
      icon={clusterIcon}
      eventHandlers={{ click: handleClick }}
    />
  );
}