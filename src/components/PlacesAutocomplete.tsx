/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const GOOGLE_MAPS_API_KEY = "AIzaSyBdR6f7V35-rpYIfMB4SXJqr7NrcjyoIaM";

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-places="true"]'
    );

    const handleLoad = () => {
      if (window.google?.maps?.places) {
        resolve();
        return;
      }

      googleMapsPromise = null;
      reject(new Error("Google Places did not initialize correctly."));
    };

    const handleError = () => {
      googleMapsPromise = null;
      reject(new Error("Failed to load Google Places."));
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.googleMapsPlaces = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = handleLoad;
    script.onerror = handleError;
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function formatPlace(place: google.maps.places.PlaceResult | null | undefined, fallback: string) {
  if (!place) return fallback;

  if (place.name && place.formatted_address && !place.formatted_address.startsWith(place.name)) {
    return `${place.name}, ${place.formatted_address}`;
  }

  return place.formatted_address || place.name || fallback;
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const PlacesAutocomplete = ({ value, onChange, placeholder, className }: PlacesAutocompleteProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestIdRef = useRef(0);
  const blurTimeoutRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [isLoadingSelection, setIsLoadingSelection] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMapsScript()
      .then(() => {
        if (cancelled) return;

        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        placesServiceRef.current = new google.maps.places.PlacesService(document.createElement("div"));
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        setIsReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
      });

    return () => {
      cancelled = true;
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = value.trim();

    if (!isReady || !isFocused || !autocompleteServiceRef.current || loadError || query.length < 2) {
      requestIdRef.current += 1;
      setPredictions([]);
      setActiveIndex(-1);
      setIsLoadingPredictions(false);
      if (query.length < 2) setIsOpen(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoadingPredictions(true);

    const timeoutId = window.setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: query,
          sessionToken: sessionTokenRef.current ?? undefined,
        },
        (results, status) => {
          if (requestId !== requestIdRef.current) return;

          setIsLoadingPredictions(false);

          if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
            setPredictions([]);
            setActiveIndex(-1);
            setIsOpen(false);
            return;
          }

          setPredictions(results);
          setActiveIndex(-1);
          setIsOpen(true);
        }
      );
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [isFocused, isReady, loadError, value]);

  const handleSelectPrediction = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      const finishSelection = (nextValue: string) => {
        requestIdRef.current += 1;
        onChange(nextValue);
        setPredictions([]);
        setIsOpen(false);
        setActiveIndex(-1);
        setIsLoadingPredictions(false);
        sessionTokenRef.current = isReady
          ? new google.maps.places.AutocompleteSessionToken()
          : null;
      };

      if (!placesServiceRef.current) {
        finishSelection(prediction.description);
        return;
      }

      setIsLoadingSelection(true);

      placesServiceRef.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: ["formatted_address", "name"],
          sessionToken: sessionTokenRef.current ?? undefined,
        },
        (place, status) => {
          setIsLoadingSelection(false);

          if (status !== google.maps.places.PlacesServiceStatus.OK) {
            finishSelection(prediction.description);
            return;
          }

          finishSelection(formatPlace(place, prediction.description));
        }
      );
    },
    [isReady, onChange]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setIsOpen(e.target.value.trim().length >= 2);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    setIsFocused(true);
    if (predictions.length > 0) setIsOpen(true);
  }, [predictions.length]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
    }, 120);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || predictions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % predictions.length);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? predictions.length - 1 : prev - 1));
        return;
      }

      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        handleSelectPrediction(predictions[activeIndex]);
        return;
      }

      if (e.key === "Escape") {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    },
    [activeIndex, handleSelectPrediction, isOpen, predictions]
  );

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-busy={isLoadingPredictions || isLoadingSelection}
        className={cn(className, (isLoadingPredictions || isLoadingSelection) && "pr-11")}
      />

      {(isLoadingPredictions || isLoadingSelection) && (
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        </div>
      )}

      {isOpen && predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <ul role="listbox" className="max-h-64 overflow-auto py-1">
            {predictions.map((prediction, index) => {
              const isActive = index === activeIndex;

              return (
                <li key={prediction.place_id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectPrediction(prediction)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      isActive ? "bg-secondary" : "hover:bg-secondary/70"
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {prediction.structured_formatting.main_text}
                      </span>
                      {prediction.structured_formatting.secondary_text && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {prediction.structured_formatting.secondary_text}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {loadError && (
        <p className="mt-2 text-xs text-muted-foreground">
          Address suggestions are temporarily unavailable, but you can still type the location manually.
        </p>
      )}
    </div>
  );
};

export default PlacesAutocomplete;
