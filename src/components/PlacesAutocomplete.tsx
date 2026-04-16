/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

// ---------------------------------------------------------------------------
// Script + library loader
// Loads the Maps JS script once and resolves via importLibrary("places").
// The new Places API (AutocompleteSuggestion, Place) requires importLibrary
// rather than the deprecated libraries=places query param.
// ---------------------------------------------------------------------------
let placesLibraryPromise: Promise<google.maps.PlacesLibrary> | null = null;

function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  if (placesLibraryPromise) return placesLibraryPromise;

  placesLibraryPromise = new Promise((resolve, reject) => {
    // Already fully loaded (e.g. hot reload)
    if (window.google?.maps?.importLibrary) {
      (window.google.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>)
        .then(resolve)
        .catch(reject);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-places="true"]'
    );

    const importLib = () => {
      (window.google.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>)
        .then(resolve)
        .catch((err) => {
          placesLibraryPromise = null;
          reject(err);
        });
    };

    const handleError = () => {
      placesLibraryPromise = null;
      reject(new Error("Failed to load Google Maps."));
    };

    if (existing) {
      existing.addEventListener("load", importLib, { once: true });
      existing.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.googleMapsPlaces = "true";
    // v=weekly gets the current stable release of the new Places API.
    // No `libraries=places` needed — importLibrary handles that.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = importLib;
    script.onerror = handleError;
    document.head.appendChild(script);
  });

  return placesLibraryPromise;
}

// ---------------------------------------------------------------------------
// Format helper
// ---------------------------------------------------------------------------
function formatPlace(
  displayName: string | null | undefined,
  formattedAddress: string | null | undefined,
  fallback: string
): string {
  if (displayName && formattedAddress && !formattedAddress.startsWith(displayName)) {
    return `${displayName}, ${formattedAddress}`;
  }
  return formattedAddress ?? displayName ?? fallback;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const PlacesAutocomplete = ({
  value,
  onChange,
  placeholder,
  className,
}: PlacesAutocompleteProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<google.maps.PlacesLibrary | null>(null);
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
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);

  // Load the Places library on mount
  useEffect(() => {
    let cancelled = false;

    console.log("[Places] loading library, API key present:", !!GOOGLE_MAPS_API_KEY, "key prefix:", GOOGLE_MAPS_API_KEY?.slice(0, 8));
    loadPlacesLibrary()
      .then((lib) => {
        if (cancelled) return;
        libRef.current = lib;
        sessionTokenRef.current = new lib.AutocompleteSessionToken();
        console.log("[Places] library ready, available keys:", Object.keys(lib));
        setIsReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Places] library load failed:", err);
        setLoadError(true);
      });

    return () => {
      cancelled = true;
      if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions whenever value changes while focused
  useEffect(() => {
    const query = value.trim();

    if (!isReady || !isFocused || loadError || query.length < 2 || !libRef.current) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setActiveIndex(-1);
      setIsLoadingPredictions(false);
      if (query.length < 2) setIsOpen(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoadingPredictions(true);

    const timeoutId = window.setTimeout(async () => {
      console.log("[Places] calling fetchAutocompleteSuggestions with input:", JSON.stringify(query), "hasSessionToken:", !!sessionTokenRef.current);
      try {
        const response =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            sessionToken: sessionTokenRef.current ?? undefined,
          });

        console.log("[Places] fetchAutocompleteSuggestions response:", response);
        console.log("[Places] suggestion count:", response.suggestions.length);
        response.suggestions.forEach((s, i) => {
          console.log(`[Places]   [${i}]`, s.placePrediction?.text?.text, "|", s.placePrediction?.mainText?.text, "|", s.placePrediction?.secondaryText?.text);
        });

        if (requestId !== requestIdRef.current) return;

        setIsLoadingPredictions(false);

        if (!response.suggestions.length) {
          setSuggestions([]);
          setActiveIndex(-1);
          setIsOpen(false);
          return;
        }

        setSuggestions(response.suggestions);
        setActiveIndex(-1);
        setIsOpen(true);
      } catch (err) {
        console.error("[Places] fetchAutocompleteSuggestions error:", err);
        if (requestId !== requestIdRef.current) return;
        setIsLoadingPredictions(false);
        setSuggestions([]);
        setIsOpen(false);
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [isFocused, isReady, loadError, value]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      const prediction = suggestion.placePrediction;
      if (!prediction) return;

      // Optimistically close the dropdown and show the text prediction
      const fallback = prediction.text.text;
      requestIdRef.current += 1;
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      setIsLoadingPredictions(false);
      onChange(fallback);

      // Fetch full place details to get the canonical formatted address.
      // The session token from fetchAutocompleteSuggestions is automatically
      // carried through toPlace(), so we don't need to pass it again here.
      setIsLoadingSelection(true);
      try {
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ["displayName", "formattedAddress"] });
        onChange(formatPlace(place.displayName, place.formattedAddress, fallback));
      } catch {
        // Keep the fallback text already set above
      } finally {
        setIsLoadingSelection(false);
        // Session is closed by fetchFields — start a fresh one
        if (libRef.current) {
          sessionTokenRef.current = new libRef.current.AutocompleteSessionToken();
        }
      }
    },
    [onChange]
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
    if (suggestions.length > 0) setIsOpen(true);
  }, [suggestions.length]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
    }, 120);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    },
    [activeIndex, handleSelectSuggestion, isOpen, suggestions]
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

      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <ul role="listbox" className="max-h-64 overflow-auto py-1">
            {suggestions.map((suggestion, index) => {
              const prediction = suggestion.placePrediction;
              if (!prediction) return null;
              const isActive = index === activeIndex;
              const mainText = prediction.mainText?.text ?? prediction.text.text;
              const secondaryText = prediction.secondaryText?.text;

              return (
                <li key={prediction.placeId}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      isActive ? "bg-secondary" : "hover:bg-secondary/70"
                    )}
                  >
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {mainText}
                      </span>
                      {secondaryText && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {secondaryText}
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
          Address suggestions are temporarily unavailable, but you can still type the location
          manually.
        </p>
      )}
    </div>
  );
};

export default PlacesAutocomplete;
