/// <reference types="google.maps" />
import { useEffect, useRef, useCallback } from "react";
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
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript().then(() => {
      if (cancelled || !inputRef.current || autocompleteRef.current) return;

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["establishment", "geocode"],
        fields: ["formatted_address", "name"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const display =
          place.name && place.formatted_address && !place.formatted_address.startsWith(place.name)
            ? `${place.name}, ${place.formatted_address}`
            : place.formatted_address || place.name || "";
        onChangeRef.current(display);
      });

      autocompleteRef.current = autocomplete;
    });
    return () => { cancelled = true; };
  }, []);

  // Sync React state → DOM when value changes externally
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      onChange={handleInput}
      placeholder={placeholder}
      className={cn(className)}
    />
  );
};

export default PlacesAutocomplete;
