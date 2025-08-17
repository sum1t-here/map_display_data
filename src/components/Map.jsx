import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { supabase } from "../supabaseClient";

function ArtisanMap() {
  const mapRef = useRef(null);
  const viewRef = useRef(null);
  const layerRef = useRef(null);
  const [mode, setMode] = useState("cluster"); // "cluster" | "heatmap"

  useEffect(() => {
    let view;
    let map;
    let summaryNode;

    const init = async () => {
      // 1) Map + View (once)
      map = new Map({ basemap: "streets-vector" });
      view = new MapView({
        container: mapRef.current,
        map,
        center: [92.5, 26.0],
        zoom: 7,
      });
      viewRef.current = view;

      // 2) Fetch artisans (keep your RPC the same)
      const { data: artisans, error } = await supabase.rpc("get_artisans_with_coords");
      if (error) {
        console.error("Supabase RPC Error:", error);
        return;
      }
      if (!artisans || artisans.length === 0) return;

      // 3) Fetch weather for each artisan (Open-Meteo)
      const withWeather = await Promise.all(
        artisans.map(async (a) => {
          try {
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lng}&current=temperature_2m,precipitation`
            );
            const w = await res.json();
            return {
              ...a,
              weather_temp: w?.current?.temperature_2m ?? null,
              weather_precip: w?.current?.precipitation ?? null,
              weather_time: w?.current?.time ?? null,
            };
          } catch (e) {
            console.warn("Weather fetch failed", e);
            return { ...a, weather_temp: null, weather_precip: null, weather_time: null };
          }
        })
      );

      // 4) Build client-side features
      const features = withWeather.map((a, idx) => ({
        geometry: { type: "point", longitude: a.lng, latitude: a.lat },
        attributes: {
          ObjectID: idx + 1,
          id: a.id,
          name: a.name,
          craft_type: a.craft_type,
          cluster_name: a.cluster_name,
          weather_temp: a.weather_temp,
          weather_precip: a.weather_precip,
          weather_time: a.weather_time,
        },
      }));

      // 5) Popup template (includes weather)
      const popupTemplate = {
        title: "{name}",
        content: `
          <div style="min-width:220px">
            <p><b>Craft:</b> {craft_type}</p>
            <p><b>Cluster:</b> {cluster_name}</p>
            <hr/>
            <p><b>Current Temp:</b> {weather_temp} °C</p>
            <p><b>Precipitation:</b> {weather_precip} mm</p>
            <p style="font-size:12px;color:#666"><i>{weather_time}</i></p>
          </div>
        `,
        outFields: ["*"],
      };

      // 6) Create FeatureLayer
      const layer = new FeatureLayer({
        source: features,
        objectIdField: "ObjectID",
        fields: [
          { name: "ObjectID", type: "oid" },
          { name: "id", type: "string" },
          { name: "name", type: "string" },
          { name: "craft_type", type: "string" },
          { name: "cluster_name", type: "string" },
          { name: "weather_temp", type: "double" },
          { name: "weather_precip", type: "double" },
          { name: "weather_time", type: "string" },
        ],
        popupTemplate,
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-marker",
            size: 10,
            color: [226, 119, 40],
            outline: { color: [255, 255, 255], width: 1 },
          },
        },
      });

      layerRef.current = layer;
      map.add(layer);

      // 7) Apply initial mode
      applyMode(layer, mode);

      // 8) Summary widget (weather of all)
      summaryNode = document.createElement("div");
      summaryNode.className =
        "bg-white/90 rounded-md px-3 py-2 text-sm shadow";
      summaryNode.style.margin = "10px";
      const temps = withWeather.map((x) => x.weather_temp).filter((v) => typeof v === "number");
      const precs = withWeather.map((x) => x.weather_precip).filter((v) => typeof v === "number");
      const avg = (arr) => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : "—");
      summaryNode.innerHTML = `
        <div><b>Artisans:</b> ${withWeather.length}</div>
        <div><b>Avg Temp:</b> ${avg(temps)} °C</div>
        <div><b>Avg Precip:</b> ${avg(precs)} mm</div>
      `;
      view.ui.add(summaryNode, "top-right");
    };

    // helper: set cluster/heatmap on the same layer
    const applyMode = (layer, m) => {
      if (!layer) return;
      if (m === "cluster") {
        layer.renderer = {
          type: "simple",
          symbol: {
            type: "simple-marker",
            size: 10,
            color: [226, 119, 40],
            outline: { color: [255, 255, 255], width: 1 },
          },
        };
        layer.featureReduction = {
          type: "cluster",
          clusterRadius: "60px",
          popupTemplate: {
            title: "Cluster summary",
            content: "This cluster contains {cluster_count} artisans.",
          },
        };
      } else if (m === "heatmap") {
        layer.featureReduction = null;
        layer.renderer = {
          type: "heatmap",
          colorStops: [
            { ratio: 0, color: "rgba(63, 40, 102, 0)" },
            { ratio: 0.1, color: "#4771FA" },
            { ratio: 0.2, color: "#39CCA0" },
            { ratio: 0.35, color: "#A6FF4D" },
            { ratio: 0.5, color: "#FCFF4D" },
            { ratio: 0.7, color: "#FFB600" },
            { ratio: 1, color: "#FF4A00" },
          ],
          maxPixelIntensity: 50,
          minPixelIntensity: 0,
        };
      }
    };

    init();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  // update mode on the same layer (no remount)
  useEffect(() => {
    if (layerRef.current) {
      // re-apply mode settings
      if (mode === "cluster") {
        layerRef.current.featureReduction = {
          type: "cluster",
          clusterRadius: "60px",
          popupTemplate: {
            title: "Cluster summary",
            content: "This cluster contains {cluster_count} artisans.",
          },
        };
        layerRef.current.renderer = {
          type: "simple",
          symbol: {
            type: "simple-marker",
            size: 10,
            color: [226, 119, 40],
            outline: { color: [255, 255, 255], width: 1 },
          },
        };
      } else {
        layerRef.current.featureReduction = null;
        layerRef.current.renderer = {
          type: "heatmap",
          colorStops: [
            { ratio: 0, color: "rgba(63, 40, 102, 0)" },
            { ratio: 0.1, color: "#4771FA" },
            { ratio: 0.2, color: "#39CCA0" },
            { ratio: 0.35, color: "#A6FF4D" },
            { ratio: 0.5, color: "#FCFF4D" },
            { ratio: 0.7, color: "#FFB600" },
            { ratio: 1, color: "#FF4A00" },
          ],
          maxPixelIntensity: 50,
          minPixelIntensity: 0,
        };
      }
    }
  }, [mode]);

  return (
    <div className="relative w-full flex flex-col items-center gap-2">
      {/* Toggle */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setMode("cluster")}
          className={`px-3 py-1.5 rounded-md text-sm ${
            mode === "cluster" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Cluster
        </button>
        <button
          onClick={() => setMode("heatmap")}
          className={`px-3 py-1.5 rounded-md text-sm ${
            mode === "heatmap" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Heatmap
        </button>
      </div>

      {/* Map */}
      <div
        className="h-96 w-11/12 rounded-lg shadow-lg"
        ref={mapRef}
      ></div>
    </div>
  );
}

export default ArtisanMap;
