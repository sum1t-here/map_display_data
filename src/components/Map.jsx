import { useEffect, useRef } from "react";
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';

function ArtisanMap() {
  const mapRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    const initialiseMap = async () => {
      try {
        const map = new Map({
          basemap: "topo-vector"
        });

        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [92.5, 26.0], // Assam coordinates
          zoom: 7
        });
        viewRef.current = view;

      } catch (error) {
        console.error("Initialization error:", error);
      }
    }

    initialiseMap();
  }, []);
  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0" ref={mapRef}></div>
    </div>
  )
}

export default ArtisanMap
