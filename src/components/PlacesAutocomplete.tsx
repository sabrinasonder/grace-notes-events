import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const GOOGLE_MAPS_API_KEY = "AIzaSyBdR6f7V35-rpYIfMB4SXJqr7NrcjyoIaM";

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMapsScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    if (scriptLoading) {
      loadCallbacks.push(resolve);
      return;
    }
    scriptLoading = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const PlacesAutocomplete = ({ value, onChange, placeholder, className }: PlacesAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(scriptLoaded);

  useEffect(() => {
    loadGoogleMapsScript().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["establishment", "geocode"],
      fields: ["formatted_address", "name"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const display = place.name && place.formatted_address && !place.formatted_address.startsWith(place.name)
        ? `${place.name}, ${place.formatted_address}`
        : place.formatted_address || place.name || "";
      onChange(display);
    });

    autocompleteRef.current = autocomplete;
  }, [ready]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(className)}
    />
  );
};

export default PlacesAutocomplete;
