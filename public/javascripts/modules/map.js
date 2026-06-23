import axios from "axios";
import { $ } from "./bling";

const mapOptions = {
  center: { lat: 52.52, lng: 13.405 },
  zoom: 10,
};

function loadPlaces(map, lat = 52.52, lng = 13.405) {
  axios.get(`/api/stores/near?lat=${lat}&lng=${lng}`).then((res) => {
    const places = res.data;
    if (!places.length) {
      alert("no places found");
      return;
    }
    // create a bounds
    const bounds = new google.maps.LatLngBounds();
    // create infoWindow
    const infoWindow = new google.maps.InfoWindow();

    const markers = places.map((place) => {
      const [placeLng, placeLat] = place.location.coordinates;
      const position = { lat: placeLat, lng: placeLng };
      bounds.extend(position);
      const marker = new google.maps.Marker({ map, position });
      marker.place = place;
      return marker;
    });

    // when someone clicks on a marker, show the details of the place
    markers.forEach((marker) =>
      marker.addListener("click", function () {
        const [lng, lat] = this.place.location.coordinates;
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

        const html = `
            <div class="popup">
                <a href="/stores/${this.place.slug}">
                    <img src="/uploads/${this.place.photo || "store.png"}" alt="${this.place.name}" />
                    <p>${this.place.name} - ${this.place.location.address}</p>
                </a>

                <a
                  href="${googleMapsUrl}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="popup__maps-link"
                >
                  View on Google Maps
                </a>
            </div>
        `;
        infoWindow.setContent(html);
        infoWindow.open(map, this);
      }),
    );

    // then zoom the map to fit all the markers perfectly
    map.setCenter(bounds.getCenter());
    map.fitBounds(bounds);
  });
}

function makeMap(mapDiv) {
  if (!mapDiv) return;
  // make the map
  const map = new google.maps.Map(mapDiv, mapOptions);
  loadPlaces(map);

  const input = $('[name="geolocate"]');
  const autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    loadPlaces(
      map,
      place.geometry.location.lat(),
      place.geometry.location.lng(),
    );
  });
}

export default makeMap;
