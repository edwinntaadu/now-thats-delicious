import axios from "axios";

const BERLIN_CENTER = { lat: 52.52, lng: 13.405 };
const SEARCH_RADIUS_KM = 10;

const mapOptions = {
  center: BERLIN_CENTER,
  zoom: 11,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  gestureHandling: "cooperative",
};

function setStatus(statusElement, message, state = "loading") {
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function getPhotoSrc(photo) {
  if (!photo) return "/uploads/store.png";
  if (/^https?:\/\//i.test(photo)) return photo;
  return `/uploads/${photo}`;
}

function createPopup(place) {
  const [lng, lat] = place.location.coordinates;
  const storeUrl = `/stores/${encodeURIComponent(place.slug)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const popup = document.createElement("article");
  popup.className = "popup";

  const imageLink = document.createElement("a");
  imageLink.className = "popup__image-link";
  imageLink.href = storeUrl;
  imageLink.setAttribute("aria-label", `View ${place.name}`);

  const image = document.createElement("img");
  image.className = "popup__image";
  image.src = getPhotoSrc(place.photo);
  image.alt = place.name;
  image.loading = "lazy";
  imageLink.appendChild(image);

  const content = document.createElement("div");
  content.className = "popup__content";

  const title = document.createElement("h3");
  title.className = "popup__title";

  const titleLink = document.createElement("a");
  titleLink.href = storeUrl;
  titleLink.textContent = place.name;
  titleLink.className = "popup__link";
  title.appendChild(titleLink);

  const address = document.createElement("p");
  address.className = "popup__address";
  address.textContent = place.location.address || "Address unavailable";

  const actions = document.createElement("div");
  actions.className = "popup__actions";

  const storeLink = document.createElement("a");
  storeLink.className = "popup__link";
  storeLink.href = storeUrl;
  storeLink.textContent = "View store";

  const mapsLink = document.createElement("a");
  mapsLink.className = "popup__link";
  mapsLink.href = mapsUrl;
  mapsLink.target = "_blank";
  mapsLink.rel = "noopener noreferrer";
  mapsLink.textContent = "Google Maps";

  actions.append(storeLink, mapsLink);
  content.append(title, address, actions);
  popup.append(imageLink, content);

  return popup;
}

async function loadPlaces({
  map,
  infoWindow,
  markers,
  statusElement,
  lat = BERLIN_CENTER.lat,
  lng = BERLIN_CENTER.lng,
}) {
  setStatus(
    statusElement,
    `Searching for stores within ${SEARCH_RADIUS_KM} km…`,
  );

  infoWindow.close();
  markers.splice(0).forEach((marker) => marker.setMap(null));

  try {
    const { data: places } = await axios.get("/api/stores/near", {
      params: { lat, lng },
    });

    if (!places.length) {
      map.setCenter({ lat, lng });
      map.setZoom(13);
      setStatus(
        statusElement,
        `No stores found within ${SEARCH_RADIUS_KM} km of this location.`,
        "empty",
      );
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    places.forEach((place) => {
      const [placeLng, placeLat] = place.location.coordinates;
      const position = { lat: placeLat, lng: placeLng };
      bounds.extend(position);

      const marker = new google.maps.Marker({
        map,
        position,
        title: place.name,
      });

      marker.addListener("click", () => {
        infoWindow.setContent(createPopup(place));
        infoWindow.open({ map, anchor: marker });
      });

      markers.push(marker);
    });

    map.fitBounds(bounds, 48);
    google.maps.event.addListenerOnce(map, "idle", () => {
      if (map.getZoom() > 15) map.setZoom(15);
    });

    setStatus(
      statusElement,
      `${places.length} ${places.length === 1 ? "store" : "stores"} found nearby.`,
      "success",
    );
  } catch (error) {
    console.error(error);
    setStatus(
      statusElement,
      "Nearby stores could not be loaded. Please try again.",
      "error",
    );
  }
}

async function setupLocationSearch({
  map,
  infoWindow,
  markers,
  statusElement,
}) {
  const searchHost = document.querySelector("#map-search");
  const fallbackInput = searchHost?.querySelector(".map-search__fallback");
  const resetButton = document.querySelector("[data-map-reset]");

  if (!searchHost) return;

  const { PlaceAutocompleteElement } =
    await google.maps.importLibrary("places");
  const placeAutocomplete = new PlaceAutocompleteElement();

  placeAutocomplete.placeholder = "Search anywhere";

  if (fallbackInput) fallbackInput.remove();
  searchHost.appendChild(placeAutocomplete);

  placeAutocomplete.addEventListener(
    "gmp-select",
    async ({ placePrediction }) => {
      try {
        setStatus(statusElement, "Finding stores near that location…");
        const place = placePrediction.toPlace();

        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location"],
        });

        if (!place.location) {
          setStatus(
            statusElement,
            "That location could not be placed on the map.",
            "error",
          );
          return;
        }

        await loadPlaces({
          map,
          infoWindow,
          markers,
          statusElement,
          lat: place.location.lat(),
          lng: place.location.lng(),
        });
      } catch (error) {
        console.error(error);
        setStatus(
          statusElement,
          "That location could not be searched. Please try another.",
          "error",
        );
      }
    },
  );

  resetButton?.addEventListener("click", () => {
    placeAutocomplete.value = "";
    map.setCenter(BERLIN_CENTER);
    map.setZoom(mapOptions.zoom);
    loadPlaces({ map, infoWindow, markers, statusElement });
  });
}

async function makeMap(mapDiv) {
  if (!mapDiv) return;

  const statusElement = document.querySelector("#map-status");

  try {
    const map = new google.maps.Map(mapDiv, mapOptions);
    const infoWindow = new google.maps.InfoWindow({
      ariaLabel: "Store details",
    });
    const markers = [];

    await Promise.all([
      loadPlaces({ map, infoWindow, markers, statusElement }),
      setupLocationSearch({ map, infoWindow, markers, statusElement }),
    ]);
  } catch (error) {
    console.error(error);
    setStatus(
      statusElement,
      "The map could not be initialized. Please refresh the page.",
      "error",
    );
  }
}

export default makeMap;
