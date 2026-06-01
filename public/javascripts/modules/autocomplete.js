async function autocomplete(input, latInput, lngInput) {
  if (!input) return; // skip this fn from running if there is no address input on the page

  const { PlaceAutocompleteElement } =
    await google.maps.importLibrary("places");

  const placeAutocomplete = new PlaceAutocompleteElement();

  input.parentNode.insertBefore(placeAutocomplete, input);
  input.type = "hidden";

  placeAutocomplete.addEventListener("gmp-select", async (event) => {
    const place = event.placePrediction.toPlace();

    await place.fetchFields({
      fields: ["formattedAddress", "location"],
    });

    input.value = place.formattedAddress;
    latInput.value = place.location.lat();
    lngInput.value = place.location.lng();
  });
  // If someone hits the enter key on the address field, don't submit the form
  input.on("keydown", (e) => {
    if (e.KeyCode === 13) e.preventDefault();
  });
}

export default autocomplete;
